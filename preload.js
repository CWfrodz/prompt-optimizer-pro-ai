const { contextBridge, ipcRenderer } = require('electron');

// Експортуємо безпечне API для роботи зі сховищем в Renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getStoredData: (key) => ipcRenderer.sendSync('get-data-sync', key),
  saveStoredData: (key, value) => ipcRenderer.sendSync('save-data-sync', key, value),
});
