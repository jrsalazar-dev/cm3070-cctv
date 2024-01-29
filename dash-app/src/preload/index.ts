import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

import type { Api } from "../types";

// Custom APIs for renderer
const api: Api = {
	startCamera(url: string) {
		ipcRenderer.send("start-camera", url);
	},
	startWebcam(cam: number) {
		ipcRenderer.send("start-webcam", cam);
	},
	requestDetections() {
		return ipcRenderer.invoke("request-detections");
	},
	getAlerts() {
		return ipcRenderer.invoke("get-alerts");
	},
	deleteAlert(id: string) {
		return ipcRenderer.invoke("delete-alert", id);
	},
	getLiveFeeds() {
		return ipcRenderer.invoke("get-live-feeds");
	},
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("electron", electronAPI);
		contextBridge.exposeInMainWorld("api", api);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI;
	// @ts-ignore (define in dts)
	window.api = api;
}
