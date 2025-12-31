const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Starting preload script');

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config')
});

console.log('[Preload] API exposed to window');

