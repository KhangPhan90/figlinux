const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shell', {
  newTab:          ()           => ipcRenderer.send('new-tab'),
  closeTab:        (index)      => ipcRenderer.send('close-tab', index),
  switchTab:       (index)      => ipcRenderer.send('switch-tab', index),
  pinTab:          (index)      => ipcRenderer.send('pin-tab', index),
  duplicateTab:    (index)      => ipcRenderer.send('duplicate-tab', index),
  closeOtherTabs:  (index)      => ipcRenderer.send('close-other-tabs', index),
  reorderTab:      (from, to)   => ipcRenderer.send('reorder-tab', from, to),
  goBack:          (index)      => ipcRenderer.send('go-back', index),
  goForward:       (index)      => ipcRenderer.send('go-forward', index),
  zoomIn:           ()           => ipcRenderer.send('zoom-in'),
  zoomOut:          ()           => ipcRenderer.send('zoom-out'),
  resetZoom:        ()           => ipcRenderer.send('zoom-reset'),
  openShortcuts:    ()           => ipcRenderer.send('open-shortcuts'),
  onTabsUpdated:   (cb)         => {
    ipcRenderer.removeAllListeners('tabs-updated'); // prevent accumulation on page reload
    ipcRenderer.on('tabs-updated', (_e, tabs) => cb(tabs));
  },
});
