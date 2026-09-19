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
});
