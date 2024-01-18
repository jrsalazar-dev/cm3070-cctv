import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type { Api } from '../types'
import { Alert } from '../database/models/Alert'

// Custom APIs for renderer
const api: Api = {
  startCamera(url: string): void {
    ipcRenderer.send('start-camera', url)
  },
  startWebcam(cam: number): void {
    ipcRenderer.send('start-webcam', cam)
  },
  requestDetections(): Promise<string> {
    return ipcRenderer.invoke('request-detections')
  },
  getAlerts(): Promise<Alert[]> {
    return ipcRenderer.invoke('get-alerts')
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
