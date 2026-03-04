const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shortcutsAPI', {
  platform: process.platform,
  getAll:   ()           => ipcRenderer.invoke('shortcuts:get-all'),
  set:      (id, accel)  => ipcRenderer.invoke('shortcuts:set', id, accel),
  reset:    (id)         => ipcRenderer.invoke('shortcuts:reset', id),
  resetAll: ()           => ipcRenderer.invoke('shortcuts:reset-all'),
  setRecording: (active) => ipcRenderer.send('shortcuts:recording', active),
});
