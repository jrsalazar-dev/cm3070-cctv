import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type { Api } from '../types'

// Custom APIs for renderer
const api: Api = {
  requestDetections() {
    return ipcRenderer.invoke('request-detections')
  },
  getAlerts() {
    return ipcRenderer.invoke('get-alerts')
  },
  deleteAlert(id: string) {
    return ipcRenderer.invoke('delete-alert', id)
  },
  deleteLiveFeed(id: string) {
    return ipcRenderer.invoke('delete-live-feed', id)
  },
  setLiveFeedAlerting(id: number, enabled: boolean) {
    return ipcRenderer.invoke('set-live-feed-alerting', id, enabled)
  },
  setLiveFeedDetecting(id: number, enabled: boolean) {
    return ipcRenderer.invoke('set-live-feed-detecting', id, enabled)
  },
  getLiveFeeds() {
    return ipcRenderer.invoke('get-live-feeds')
  },
  addLiveFeed(liveFeed) {
    return ipcRenderer.invoke('add-live-feed', liveFeed)
  },
  start() {
    return ipcRenderer.invoke('start')
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
