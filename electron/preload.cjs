const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workstation", {
  chooseVaultFolder: () => ipcRenderer.invoke("workstation:choose-vault"),
  saveMedia: (input) => ipcRenderer.invoke("workstation:save-media", input),
  removeMedia: (id) => ipcRenderer.invoke("workstation:remove-media", id),
  createDesktopShortcut: () => ipcRenderer.invoke("workstation:create-shortcut"),
});
