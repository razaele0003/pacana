const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pacanaDesktop", {
  // Audio Persistence APIs
  saveAudio: (name, arrayBuffer, mimeType) =>
    ipcRenderer.invoke("audio:save", { name, data: arrayBuffer, type: mimeType }),
  deleteAudio: (id) => ipcRenderer.invoke("audio:delete", id),
  getAudioUrl: (id) => ipcRenderer.invoke("audio:url", id),

  // Fullscreen Window Management APIs
  setFullscreen: (flag) => ipcRenderer.invoke("window:setFullscreen", flag),
  isFullscreen: () => ipcRenderer.invoke("window:isFullscreen"),
  onFullscreenChange: (callback) => {
    const handler = (_event, isFull) => callback(isFull);
    ipcRenderer.on("window:fullscreen-change", handler);
    return () => ipcRenderer.removeListener("window:fullscreen-change", handler);
  },

  // Desktop Behavior & System Tray APIs
  setMinimizeToTray: (enabled) => ipcRenderer.invoke("desktop:setMinimizeToTray", Boolean(enabled)),
  getMinimizeToTray: () => ipcRenderer.invoke("desktop:getMinimizeToTray"),
  updateTimerStatus: (status) => ipcRenderer.send("timer:status-update", status),
  onMinimizeToTrayChange: (callback) => {
    const handler = (_event, enabled) => callback(enabled);
    ipcRenderer.on("desktop:minimize-to-tray-change", handler);
    return () => ipcRenderer.removeListener("desktop:minimize-to-tray-change", handler);
  },
  restoreWindow: () => ipcRenderer.invoke("window:restore"),
  showNotification: (options) => ipcRenderer.send("desktop:show-notification", options),
  onTimerCommand: (callback) => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on("timer:command", handler);
    return () => ipcRenderer.removeListener("timer:command", handler);
  },
});
