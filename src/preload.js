const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onEvent: (cb) => ipcRenderer.on('pet-event', (_e, ev) => cb(ev)),
  onCommand: (cb) => ipcRenderer.on('pet-command', (_e, cmd) => cb(cmd)),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  knightMenu: (info) => ipcRenderer.send('knight-menu', info),
  reportCount: (n) => ipcRenderer.send('knight-count', n),
});
