const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, powerMonitor, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');

app.setName('Deskmates');
if (process.platform === 'win32') app.setAppUserModelId('com.crazyjimmy0623.deskmates');
if (!app.requestSingleInstanceLock()) app.exit(0);

const { Store } = require('./store');
const { Actors, MAX_RESIDENTS } = require('./actors');
const { Progress, dayKey } = require('./progress');
const { Fx } = require('./fx');
const { Focus } = require('./focus');
const { ActivityMonitor } = require('./activity');
const { Windows, note } = require('./windows');

// A mistake somewhere in the main process is written down, not allowed to take the whole app out.
process.on('uncaughtException', (err) => note(`main error: ${err?.stack || err}`));
process.on('unhandledRejection', (err) => note(`main promise: ${err?.stack || err}`));

// A dress-up recipe, keeping only known kinds of fields (it can come from a friend's card).
const RECIPE_COLORS = ['skin', 'body', 'leg', 'boot', 'hair', 'cape'];
function cleanRecipe(recipe) {
  const clean = {};
  for (const k of ['head', 'hat', 'body', 'extra']) if (typeof recipe?.[k] === 'string') clean[k] = recipe[k].slice(0, 20);
  clean.colors = {};
  for (const k of RECIPE_COLORS) {
    const v = recipe?.colors?.[k];
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) clean.colors[k] = v;
  }
  return clean;
}

// Only a real local folder: the path comes from whoever posted the event, and opening a file runs it.
function isFolder(p) {
  if (typeof p !== 'string' || /^[\\/]{2}/.test(p)) return false;
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

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
  // Only from the source tree: an installed copy never has a way to unlimited coins.
  const testMode = !app.isPackaged && process.argv.includes('--test-mode');
  const store = new Store({ test: testMode });
  const actors = new Actors(store);
  const progress = new Progress(store);
  const fx = new Fx(store, actors, progress);
  const focus = new Focus(store, actors, progress);
  const activity = new ActivityMonitor();
  const windows = new Windows(store);
  let assets = loadCustomAssets();
  actors.customSkins = new Set(assets.characters.map((c) => c.id));

  const debug = !!process.env.DESKMATES_DEBUG;
  // `demo`: the settings' show-and-tell. Its sessions act out the same, but earn nothing.
  const dispatchClaude = (payload, { demo = false } = {}) => {
    const ev = summarize(payload);
    if (debug) console.log('[deskmates] hook', ev?.event, ev?.project, ev?.tool || '');
    if (ev) actors.claude(demo ? { ...ev, demo: true } : ev);
  };
  ctx = {
    store, actors, progress, fx, focus, activity, windows,
    runDemo: () => runDemo((p) => dispatchClaude(p, { demo: true })),
  };

  // ---- Model → windows ------------------------------------------------------
  actors.on('change', (list) => windows.broadcast('actors', list));
  // Coins, XP and stats for real work only; a demo session just plays it out.
  const real = (fn) => (a, ...rest) => { if (!a?.demo) fn(a, ...rest); };
  actors.on('tool', real((a, ev) => progress.onTool(a, ev)));
  actors.on('turn', real((a) => progress.onTurn(a)));
  actors.on('failure', real(() => progress.onFailure()));
  actors.on('permission', real(() => progress.onPermission()));
  actors.on('helpers', real((a) => progress.onHelpers(a)));
  actors.on('active-minute', (station) => progress.onActiveMinute(station, !!focus.state));
  actors.on('talk', (from, to) => windows.broadcast('fx', { type: 'talk', actorId: from.id, targetId: to.id, duration: 6000 }));
  progress.on('coins', (d) => windows.broadcast('fx', { type: 'coins', ...d }));
  progress.on('toast', (t) => windows.broadcast('fx', { type: 'toast', ...t }));
  fx.on('fx', (f) => windows.broadcast('fx', f));
  store.on('progress', () => windows.broadcast('progress', progress.snapshot()));
  store.on('room', (room) => windows.broadcast('room', room));
  store.on('settings', (s) => {
    windows.broadcast('settings', s);
    windows.applyMode();
    windows.refreshVisibility();
    if (s.sources.activity) activity.start(); else activity.stop();
    actors.updateUser();
    actors.syncResidents();
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
  actors.syncResidents();
  // Opening the app counts as checking in for the day (once the windows are there to show it),
  // and so does being back at the keyboard on a later day with it still running, even with
  // activity tracking off.
  setTimeout(() => progress.checkIn(), 4000);
  setInterval(() => { if (powerMonitor.getSystemIdleTime() < 300) progress.checkIn(); }, 5 * 60 * 1000);

  startServer(PORT, {
    '/event': dispatchClaude,
    '/api/event': (p) => actors.api(p),
    '/codex': (p) => actors.codex(p),
  });

  // ---- IPC --------------------------------------------------------------------
  const handle = (channel, fn) => ipcMain.handle(channel, (e, ...args) => fn(...args, e));
  handle('init', () => ({
    settings: store.settings, progress: progress.snapshot(), actors: actors.list(), room: store.room,
    assets, focus: focus.state, hooks: hooks.status(), version: app.getVersion(), port: PORT, appMapBuiltIn: BUILT_IN,
  }));
  handle('settings:set', (patch) => store.updateSettings(patch));
  handle('room:set', (room) => store.setRoom(room));
  handle('room:resize', (size) => windows.resizeRoom(size.width, size.height, size.drawerH || 0));
  handle('gacha:pull', (count) => progress.pull(count === 10 ? 10 : 1));
  handle('coins:spend', (amount) => progress.spend(amount));
  // Every change to the characters is made on a copy, then saved and sent to every window in one
  // go. `change` returns null when there was nothing to change or { error } to refuse; anything
  // else is the answer, given once the change is saved.
  const editCharacters = (change) => {
    const chars = JSON.parse(JSON.stringify(store.settings.characters));
    const out = change(chars);
    if (out === null || out?.error) return out ?? undefined;
    store.updateSettings({ characters: chars });
    return out;
  };
  const removeResident = (id) => editCharacters((chars) => { chars.residents = (chars.residents || []).filter((x) => x.id !== id); });
  handle('equip', ({ target, skin, accessory }) => editCharacters((chars) => {
    let slot;
    if (target === 'user' || target === 'ai') slot = chars[target];
    else if (target.startsWith('resident:')) slot = (chars.residents || []).find((r) => r.id === target.slice(9));
    else if (target.startsWith('project:')) {
      // Folder names are anything: 'constructor' must not find Object's own, '__proto__' can't be a key.
      const name = target.slice(8);
      if (name === '__proto__') return null;
      if (!Object.hasOwn(chars.projects, name)) chars.projects[name] = { ...chars.ai };
      slot = chars.projects[name];
    }
    if (!slot) return null;
    if (skin !== undefined) slot.skin = skin;
    if (accessory !== undefined) slot.accessory = accessory;
  }));
  // Residents: invite one in (a starter look; change it like any other character), rename, see them out.
  handle('resident:add', (arg) => editCharacters((chars) => {
    const { name, skin } = typeof arg === 'object' && arg ? arg : { name: arg };
    chars.residents ??= [];
    if (chars.residents.length >= MAX_RESIDENTS) return { error: `房間最多住 ${MAX_RESIDENTS} 位居民` };
    const id = Date.now().toString(36);
    const n = String(name || '').trim().slice(0, 12) || `居民 ${chars.residents.length + 1}`;
    chars.residents.push({ id, name: n, skin: typeof skin === 'string' ? skin.slice(0, 40) : 'office', accessory: null });
    return { id };
  }));
  handle('resident:rename', ({ id, name }) => editCharacters((chars) => {
    const r = (chars.residents || []).find((x) => x.id === id);
    if (!r) return null;
    r.name = String(name || '').trim().slice(0, 12) || r.name;
  }));
  handle('resident:remove', (id) => removeResident(id));
  // The character studio: save a home-made character (new or edited), or throw one away.
  handle('custom:save', ({ id, name, recipe }) => editCharacters((chars) => {
    chars.customs ??= [];
    const clean = cleanRecipe(recipe);
    const n = String(name || '').trim().slice(0, 12) || '我的角色';
    let m = id && chars.customs.find((x) => x.id === id);
    if (m) Object.assign(m, { name: n, recipe: clean });
    else {
      if (chars.customs.length >= 12) return { error: '最多做 12 個角色，先刪掉一個吧' };
      m = { id: Date.now().toString(36), name: n, recipe: clean };
      chars.customs.push(m);
    }
    return { id: m.id };
  }));
  handle('custom:remove', (id) => editCharacters((chars) => { chars.customs = (chars.customs || []).filter((x) => x.id !== id); }));
  // Drawn characters, and friends who arrived on a character card.
  handle('drawing:save', ({ id, name, art, recipe, friend }) => editCharacters((chars) => {
    chars.drawings ??= [];
    const entry = { name: String(name || '').trim().slice(0, 12) || (friend ? '新朋友' : '我畫的角色') };
    const cleanArt = {};
    for (const k of ['base', 'walk', 'work', 'sleep', 'happy']) {
      const a = art?.[k];
      if (a && typeof a.px === 'string' && a.px.length <= 6000 && /^[0-9.a-zA-Z]*$/.test(a.px)
        && Array.isArray(a.pal) && a.pal.length <= 52 && a.pal.every((c) => /^#[0-9a-f]{6}$/i.test(c))) cleanArt[k] = { pal: a.pal, px: a.px };
    }
    if (cleanArt.base) entry.art = cleanArt;
    else if (recipe) entry.recipe = cleanRecipe(recipe);
    else return { error: '這張圖是空的' };
    let m = id && chars.drawings.find((x) => x.id === id);
    if (m) {
      delete m.art;
      delete m.recipe;
      Object.assign(m, entry);
    } else {
      const mine = chars.drawings.filter((x) => !!x.friend === !!friend).length;
      if (!friend && mine >= 12) return { error: '最多畫 12 個角色，先刪掉一個吧' };
      if (friend && mine >= 40) return { error: '朋友圖鑑滿了（40 位），先送走一位吧' };
      m = { id: Date.now().toString(36), ...entry, ...(friend ? { friend: true } : {}) };
      chars.drawings.push(m);
    }
    return { id: m.id };
  }));
  handle('drawing:remove', (id) => editCharacters((chars) => { chars.drawings = (chars.drawings || []).filter((x) => x.id !== id); }));
  // A picture to keep (a card, the weekly card): into Pictures\Deskmates, then shown there.
  const savePicture = (fileName, dataUrl) => {
    const dir = path.join(app.getPath('pictures'), 'Deskmates');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${fileName}-${Date.now() % 100000}.png`);
    fs.writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
    shell.showItemInFolder(file);
    return file;
  };
  handle('card:save', ({ dataUrl, name, kind }) => {
    // Names come from cards too: nothing a file name can't hold, control characters included.
    const safe = String(name || '角色').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 12) || '角色';
    return savePicture(`${safe}-${kind === 'room' ? '房間卡' : '角色卡'}`, dataUrl);
  });
  handle('project:forget', (name) => editCharacters((chars) => { delete chars.projects[name]; }));
  handle('chest:open', (id) => fx.openChest(id));
  handle('focus:start', () => focus.start());
  handle('focus:stop', () => focus.stop());
  handle('focus:toggle', () => (focus.state ? focus.stop() : focus.start()));
  handle('hooks:install', () => hooks.install());
  handle('hooks:uninstall', () => hooks.uninstall());
  handle('assets:reload', () => {
    assets = loadCustomAssets();
    actors.customSkins = new Set(assets.characters.map((c) => c.id));
    windows.broadcast('assets', assets);
    actors.changed();
    return assets;
  });
  handle('assets:open-folder', () => openCustomFolder());
  handle('demo', () => ctx.runDemo());
  handle('autostart:get', () => app.getLoginItemSettings(loginItemOptions()).openAtLogin);
  handle('autostart:set', (on) => app.setLoginItemSettings({ openAtLogin: !!on, ...loginItemOptions() }));
  handle('actors:clear', () => actors.clearAll());
  handle('actors:regroup', () => windows.broadcast('command', { type: 'regroup' }));
  handle('share:save', (dataUrl) => savePicture(`deskmates-${dayKey()}`, dataUrl));
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
    if (isFolder(a.cwd)) items.push({ label: '開啟專案資料夾', click: () => shell.openPath(a.cwd) });
    const equip = a.kind === 'user' ? 'equip:user' : a.kind === 'resident' ? `equip:${a.id}` : `equip:project:${a.name}`;
    items.push({ label: '換角色…', click: () => windows.openGuild(equip) });
    if (a.kind === 'user') {
      items.push(focus.state ? { label: '🍅 停止番茄鐘', click: () => focus.stop() } : { label: '🍅 開始專注', click: () => focus.start() });
    } else if (a.kind === 'resident') {
      items.push({ label: '請他搬走', click: () => removeResident(a.id.slice('resident:'.length)) });
    } else {
      items.push({ label: '叫他下班', click: () => actors.remove(id) });
    }
    Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(e.sender) });
  });

  const modeArg = process.argv.find((arg) => /^--mode=(room|strip)$/.test(arg));
  if (modeArg) store.updateSettings({ mode: modeArg.slice(7) });
  windows.applyMode();
  if (testMode) setTimeout(() => windows.broadcast('fx', { type: 'toast', text: '🧪 測試模式：金幣無限、全部解鎖（玩的是存檔副本）' }), 2500);
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
// If starting up fails, say so and quit: a process with no windows still holds the single-instance
// lock, so every later launch would quietly do nothing.
app.whenReady().then(boot).catch((err) => {
  note(`boot failed: ${err?.stack || err}`);
  dialog.showErrorBox('Deskmates 開不起來', `${err?.message || err}\n\n詳細記錄在 ${path.join(app.getPath('userData'), 'deskmates.log')}`);
  app.exit(1);
});
// Keep running in the taskbar when panels close.
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  ctx?.store.flush();
  ctx?.activity.stop();
});
