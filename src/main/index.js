const { app, BrowserWindow, Menu, clipboard, ipcMain, nativeImage, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');

app.setName('Deskmates');
if (process.platform === 'win32') app.setAppUserModelId('com.crazyjimmy0623.deskmates');
if (!app.requestSingleInstanceLock()) app.exit(0);

const { Store } = require('./store');
const { Actors } = require('./actors');
const { Progress, dayKey } = require('./progress');
const { Fx } = require('./fx');
const { Focus } = require('./focus');
const { ActivityMonitor } = require('./activity');
const { Windows } = require('./windows');

function loginItemOptions() {
  // In dev the app runs as electron.exe + project path, so both must be registered.
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}
const { startServer } = require('./server');
const { summarize } = require('./summarize');
const { runDemo } = require('./demo');
const { loadCustomAssets, openCustomFolder } = require('./assets');
const hooks = require('./hooks-install');
const { BUILT_IN } = require('./app-map');

const PORT = Number(process.env.DESKMATES_PORT) || 47321;

let ctx = null;

function boot() {
  const store = new Store();
  const actors = new Actors(store);
  const progress = new Progress(store);
  const fx = new Fx(store, actors, progress);
  const focus = new Focus(store, actors, progress);
  const activity = new ActivityMonitor();
  const windows = new Windows(store);
  let assets = loadCustomAssets();
  actors.customSkins = new Set(assets.characters.map((c) => c.id));

  const debug = !!process.env.DESKMATES_DEBUG;
  const dispatchClaude = (payload) => {
    const ev = summarize(payload);
    if (debug) console.log('[deskmates] hook', ev?.event, ev?.project, ev?.tool || '');
    if (ev) actors.claude(ev);
  };
  ctx = {
    store, actors, progress, fx, focus, activity, windows,
    runDemo: () => runDemo(dispatchClaude, { chest: (id) => { const a = actors.map.get(id); if (a) fx.chest(a); } }),
  };

  // ---- Model → windows ------------------------------------------------------
  actors.on('change', (list) => windows.broadcast('actors', list));
  actors.on('tool', (a, ev) => progress.onTool(a, ev));
  actors.on('turn', (a) => progress.onTurn(a));
  actors.on('failure', () => progress.onFailure());
  actors.on('permission', () => progress.onPermission());
  actors.on('helpers', (a) => progress.onHelpers(a));
  actors.on('active-minute', () => progress.onActiveMinute());
  actors.on('talk', (from, to) => windows.broadcast('fx', { type: 'talk', actorId: from.id, targetId: to.id, duration: 6000 }));
  progress.on('coins', (d) => windows.broadcast('fx', { type: 'coins', ...d }));
  progress.on('toast', (t) => windows.broadcast('fx', { type: 'toast', ...t }));
  fx.on('fx', (f) => windows.broadcast('fx', f));
  focus.on('change', () => actors.changed());
  store.on('progress', () => windows.broadcast('progress', progress.snapshot()));
  store.on('room', (room) => windows.broadcast('room', room));
  store.on('settings', (s) => {
    windows.broadcast('settings', s);
    windows.applyMode();
    windows.refreshVisibility();
    if (s.sources.activity) activity.start(); else activity.stop();
    actors.updateUser();
    actors.changed();
  });

  // ---- Inputs ---------------------------------------------------------------
  activity.on('foreground', ({ app: name, fullscreen }) => {
    actors.setForeground(name);
    windows.setFullscreen(fullscreen && !/^(electron|deskmates)$/i.test(name));
  });
  activity.on('idle', (seconds) => actors.setIdle(seconds));
  if (store.settings.sources.activity) activity.start();
  actors.updateUser();

  startServer(PORT, {
    '/event': dispatchClaude,
    '/api/event': (p) => actors.api(p),
    '/codex': (p) => actors.codex(p),
  });

  // ---- IPC --------------------------------------------------------------------
  const handle = (channel, fn) => ipcMain.handle(channel, (e, ...args) => fn(...args, e));
  handle('init', () => ({
    settings: store.settings, progress: progress.snapshot(), actors: actors.list(), room: store.room,
    assets, focus: focus.state, hooks: hooks.status(), version: app.getVersion(), port: PORT,
    userData: app.getPath('userData'), appMapBuiltIn: BUILT_IN,
  }));
  handle('settings:set', (patch) => store.updateSettings(patch));
  handle('room:set', (room) => store.setRoom(room));
  handle('room:resize', (size) => windows.resizeRoom(size.width, size.height));
  handle('gacha:pull', (count) => progress.pull(count === 10 ? 10 : 1));
  handle('room:upgrade', () => progress.upgradeRoom());
  handle('equip', ({ target, skin, accessory }) => {
    const chars = JSON.parse(JSON.stringify(store.settings.characters));
    let slot;
    if (target === 'user' || target === 'ai') slot = chars[target];
    else if (target.startsWith('project:')) {
      const name = target.slice(8);
      chars.projects[name] ??= { ...chars.ai };
      slot = chars.projects[name];
    }
    if (!slot) return;
    if (skin !== undefined) slot.skin = skin;
    if (accessory !== undefined) slot.accessory = accessory;
    store.updateSettings({ characters: chars });
  });
  handle('project:forget', (name) => {
    const chars = JSON.parse(JSON.stringify(store.settings.characters));
    delete chars.projects[name];
    store.updateSettings({ characters: chars });
  });
  handle('chest:open', (id) => fx.openChest(id));
  handle('focus:start', () => focus.start());
  handle('focus:stop', () => focus.stop());
  handle('focus:toggle', () => (focus.state ? focus.stop() : focus.start()));
  handle('hooks:install', () => hooks.install());
  handle('hooks:uninstall', () => hooks.uninstall());
  handle('hooks:status', () => hooks.status());
  handle('assets:reload', () => {
    assets = loadCustomAssets();
    actors.customSkins = new Set(assets.characters.map((c) => c.id));
    windows.broadcast('assets', assets);
    actors.changed();
    return assets;
  });
  handle('assets:open-folder', () => openCustomFolder());
  handle('window:open', (name, tab) => {
    if (name === 'settings') windows.openSettings();
    if (name === 'guild') windows.openGuild(tab);
  });
  handle('demo', () => ctx.runDemo());
  handle('autostart:get', () => app.getLoginItemSettings(loginItemOptions()).openAtLogin);
  handle('autostart:set', (on) => app.setLoginItemSettings({ openAtLogin: !!on, ...loginItemOptions() }));
  handle('actors:clear', () => actors.clearAll());
  handle('actors:regroup', () => windows.broadcast('command', { type: 'regroup' }));
  handle('share:save', (dataUrl) => {
    const dir = path.join(app.getPath('pictures'), 'Deskmates');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `deskmates-${dayKey()}-${Date.now() % 100000}.png`);
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    shell.showItemInFolder(file);
    return file;
  });
  handle('share:copy', (dataUrl) => {
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
    return true;
  });

  ipcMain.on('mouse:ignore', (e, ignore) => {
    BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on('room:hide', () => store.updateSettings({ mode: 'strip' }));
  ipcMain.on('room:drag', (_e, on) => windows.dragRoom(!!on));
  ipcMain.on('actor:pat', (_e, id) => {
    const a = actors.map.get(id);
    if (!a) return;
    actors.say(a, ['❤️', '嘿嘿', '好舒服～', '再摸一下！'][Math.floor(Math.random() * 4)], 1500);
    windows.broadcast('fx', { type: 'heart', actorId: id });
  });
  ipcMain.on('actor:menu', (e, id) => {
    const a = actors.map.get(id);
    if (!a) return;
    const items = [{ label: a.name || 'Deskmate', enabled: false }, { type: 'separator' }];
    if (a.cwd) items.push({ label: '開啟專案資料夾', click: () => shell.openPath(a.cwd) });
    items.push({ label: '換角色…', click: () => windows.openGuild(a.kind === 'user' ? 'equip:user' : `equip:project:${a.name}`) });
    if (a.kind === 'user') {
      items.push(focus.state ? { label: '🍅 停止番茄鐘', click: () => focus.stop() } : { label: '🍅 開始專注', click: () => focus.start() });
    } else {
      items.push({ label: '叫他下班', click: () => actors.remove(id) });
    }
    Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(e.sender) });
  });

  const modeArg = process.argv.find((arg) => /^--mode=(room|strip)$/.test(arg));
  if (modeArg) store.updateSettings({ mode: modeArg.slice(7) });
  windows.applyMode();
  handle('app:quit', () => app.quit());
  screen.on('display-metrics-changed', () => windows.placeStrip());
  screen.on('display-added', () => windows.placeStrip());
  screen.on('display-removed', () => windows.placeStrip());

  if (process.argv.includes('--demo')) setTimeout(() => ctx.runDemo(), 1500);
  for (const arg of process.argv) {
    const m = /^--open=(settings|guild)$/.exec(arg);
    if (m) m[1] === 'settings' ? windows.openSettings() : windows.openGuild();
  }
}

app.on('second-instance', () => ctx?.windows.bringUp());
app.whenReady().then(boot);
// Keep running in the taskbar when panels close.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  ctx?.store.flush();
  ctx?.activity.stop();
});
