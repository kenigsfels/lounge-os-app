const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('loungeOS', Object.freeze({
  schedule: Object.freeze({
    load: () => ipcRenderer.invoke('schedule:load')
  })
}));
