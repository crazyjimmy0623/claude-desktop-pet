// Bridge between the sandboxed pages and the main process. Only whitelisted channels pass.
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = new Set([
  'init', 'settings:set', 'room:set', 'room:resize', 'gacha:pull', 'equip', 'project:forget', 'chest:open',
  'focus:start', 'focus:stop', 'hooks:install', 'hooks:uninstall', 'hooks:status', 'assets:reload',
  'assets:open-folder', 'window:open', 'demo', 'share:save', 'share:copy',
  'autostart:get', 'autostart:set', 'actors:clear', 'actors:regroup', 'app:quit', 'focus:toggle',
]);
const SEND = new Set(['mouse:ignore', 'room:hide', 'room:drag', 'actor:pat', 'actor:menu']);
const LISTEN = new Set(['actors', 'progress', 'settings', 'room', 'fx', 'assets', 'command', 'guild:tab']);

contextBridge.exposeInMainWorld('desk', {
  invoke: (channel, ...args) => (INVOKE.has(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.reject(new Error(`blocked: ${channel}`))),
  send: (channel, ...args) => SEND.has(channel) && ipcRenderer.send(channel, ...args),
  on: (channel, cb) => LISTEN.has(channel) && ipcRenderer.on(channel, (_e, data) => cb(data)),
});
