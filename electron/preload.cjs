const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sylon', Object.freeze({
  desktop: Object.freeze({
    preview: true,
    info: () => ipcRenderer.invoke('app:info')
  }),
  schedule: Object.freeze({
    load: () => ipcRenderer.invoke('schedule:load')
  })
}));
