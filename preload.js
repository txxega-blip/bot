// preload.js
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  on: (channel, callback) => ipcRenderer.on(channel, (event, data) => callback(data)),
  send: (channel, data) => ipcRenderer.send(channel, data),
});
