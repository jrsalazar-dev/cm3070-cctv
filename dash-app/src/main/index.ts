import 'reflect-metadata'

import Mailjet from 'node-mailjet'
import { app, shell, BrowserWindow, protocol, ipcMain } from 'electron'
import { join } from 'path'
import { glob } from 'glob'
import { statSync } from 'fs'
import { spawn } from 'child_process'
import zmq from 'zeromq'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from '../database/Database'

const mj = new Mailjet({
  apiKey: 'd256a380c25c6877a11f4a9c46d4a095',
  apiSecret: '105f77fdb211e526b1f3e78a18c347f5',
})

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    simpleFullscreen: true,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const getModifiedTime = (filePath: string): number => {
  return statSync(filePath).birthtime.getTime()
}

async function listDetections(): Promise<string> {
  const files = await glob(`${app.getAppPath()}/surveillance-app/output/*.webm`)
  const detections = files
    .sort((a, b) => {
      return getModifiedTime(b) - getModifiedTime(a)
    })
    .map((file) => file.split('/').at(-1))
    .join(',')
  return detections
}

async function registerHandlers(): Promise<void> {
  const db = await new Database().init()
  const sock = new zmq.Request()
  sock.connect('tcp://localhost:5555')

  ipcMain.handle('get-live-feeds', () => {
    return db.fetchLiveFeeds()
  })
  ipcMain.handle('get-alerts', () => {
    return db.fetchAlerts()
  })
  ipcMain.handle('delete-alert', (_, id: string) => {
    return db.deleteAlert(id)
  })
  ipcMain.handle('delete-live-feed', (_, id: string) => {
    return db.deleteLiveFeed(id)
  })
  ipcMain.handle('add-live-feed', async (_, liveFeed) => {
    const result = await db.addLiveFeed(liveFeed)
    const id = result.identifiers[0].id
    await sock.send(`add_feed:${id}`)
    const [response] = await sock.receive()
    console.log(response.toString())
  })
  ipcMain.handle('set-live-feed-detecting', async (_, id: number, enabled: boolean) => {
    await db.setLiveFeedDetecting(id, enabled)

    sock.send(`set_detecting:${id}:${enabled ? 1 : 0}`)

    const [result] = await sock.receive()
    console.log('result', result.toString())
  })
  ipcMain.handle('set-live-feed-alerting', async (_, id: number, enabled: boolean) => {
    await db.setLiveFeedAlerting(id, enabled)
  })
  ipcMain.handle('request-detections', listDetections)
  ipcMain.handle('start', async () => {
    sock.send('start')
    const [result] = await sock.receive()
    return result.toString() === 'started'
  })

  setInterval(async () => {
    const feeds = await db.fetchLiveFeeds()
    const alerts = await db.getUnalerted()
    for (const alert of alerts) {
      const alertFeed = feeds.find((feed) => feed.id === alert.detection_feed?.id)
      if (alertFeed?.is_alerting) {
        await mj.post('send', { version: 'v3.1' }).request({
          Messages: [
            {
              From: {
                Email: 'contact@jrsalazar.dev',
                Name: 'Surveillance App',
              },
              To: [
                {
                  Email: 'jrsalazar.dev@hey.com',
                  Name: 'JR Salazar',
                },
              ],
              Subject: `Intrusion Detected in feed ${alert.detection_feed?.name}`,
              TextPart: `An intrusion was detected at ${new Date(
                alert.detection_time * 1000,
              ).toLocaleString()}. \n \n The objects detected were ${alert.detection_objects}`,
              HtmlPart: `
              <h2>Intrusion Detected</h2>
              <p>An intrusion was detected at ${new Date(alert.detection_time * 1000).toLocaleString()}.<p> <br>
              <p>The objects detected were ${alert.detection_objects}.</p> <br><br>

              Watch the video <a href="http://localhost:3000?alertId=${alert.id}">here</a>
            `,
            },
          ],
        })
      }
      // Set alert to alerted
      await db.setAlerted(alert.id)
    }
  }, 10_000)

  const cameraProcess = spawn('python3', [`${app.getAppPath()}/surveillance-app/surveillance.py`])
  cameraProcess.stdout.on('data', (data) => {
    console.log(`Camera: ${data}`)
  })
  cameraProcess.stderr.on('data', (data) => {
    console.error(`Camera Error: ${data}`)
  })
  cameraProcess.on('close', (code) => {
    console.log(`Camera process exited with code ${code}`)
  })
  const serverProcess = spawn('node', [`${app.getAppPath()}/src/main/server.js`])

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`)
  })

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`)
  })

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`)
  })
  process.on('exit', function () {
    serverProcess.kill()
    cameraProcess.kill()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await registerHandlers()
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  protocol.registerFileProtocol('cmapp', (request, callback) => {
    const file = request.url.replace('cmapp://', '')
    return callback(`${app.getAppPath()}/surveillance-app/output/${file}`)
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
