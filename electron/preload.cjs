const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sylon', Object.freeze({
  schedule: Object.freeze({
    load: () => ipcRenderer.invoke('schedule:load')
  })
}));
