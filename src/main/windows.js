// All Deskmates windows: the taskbar strip, the room, settings and the guild book.
const { BrowserWindow, screen } = require('electron');
const path = require('path');

const PRELOAD = path.join(__dirname, '..', 'preload.js');
const page = (...p) => path.join(__dirname, '..', 'renderer', ...p);
const STRIP_HEIGHT = 300;
const DEBUG = !!process.env.DESKMATES_DEBUG;

function wireDebug(w, name) {
  if (!DEBUG) return;
  w.webContents.on('console-message', (e) => console.log(`[${name}] ${e.level}: ${e.message} (${e.sourceId?.split('/').pop()}:${e.lineNumber})`));
  w.webContents.on('render-process-gone', (_e, d) => console.log(`[${name}] renderer gone: ${d.reason}`));
  w.webContents.on('did-fail-load', (_e, code, desc) => console.log(`[${name}] load failed: ${code} ${desc}`));
  w.on('show', () => console.log(`[${name}] shown at ${JSON.stringify(w.getBounds())}`));
}
const TOP_LEVEL = 'screen-saver';

class Windows {
  constructor(store) {
    this.store = store;
    this.strip = null;
    this.room = null;
    this.settings = null;
    this.guild = null;
    this.fullscreen = false;
    this.hiddenByUser = false;
    // Windows sometimes pushes topmost windows down (e.g. after clicking the taskbar); keep reclaiming the top.
    setInterval(() => this.reassertTop(), 3000);
  }

  all() {
    return [this.strip, this.room, this.settings, this.guild].filter((w) => w && !w.isDestroyed());
  }

  broadcast(channel, data) {
    for (const w of this.all()) w.webContents.send(channel, data);
  }

  // ---- Mode & visibility ----------------------------------------------------

  applyMode() {
    if (this.store.settings.mode === 'room') {
      this.close('strip');
      this.openRoom();
    } else {
      this.close('room');
      this.openStrip();
    }
    this.applyTop();
  }

  close(name) {
    const w = this[name];
    if (w && !w.isDestroyed()) w.close();
    this[name] = null;
  }

  get overlays() {
    return [this.strip, this.room].filter((w) => w && !w.isDestroyed());
  }

  shouldShow() {
    return !this.hiddenByUser && !(this.fullscreen && this.store.settings.hideInFullscreen);
  }

  refreshVisibility() {
    const show = this.shouldShow();
    for (const w of this.overlays) {
      if (show && !w.isVisible()) w.showInactive();
      if (!show && w.isVisible()) w.hide();
    }
  }

  setHidden(hidden) {
    this.hiddenByUser = hidden;
    this.refreshVisibility();
  }

  setFullscreen(full) {
    if (this.fullscreen === full) return;
    if (DEBUG) console.log(`[deskmates] fullscreen=${full}`);
    this.fullscreen = full;
    this.refreshVisibility();
  }

  applyTop() {
    const top = this.store.settings.alwaysOnTop;
    for (const w of this.overlays) w.setAlwaysOnTop(top, TOP_LEVEL);
  }

  reassertTop() {
    if (!this.store.settings.alwaysOnTop) return;
    for (const w of this.overlays) {
      if (!w.isVisible()) continue;
      w.setAlwaysOnTop(true, TOP_LEVEL);
      w.moveTop();
    }
  }

  // ---- Strip ----------------------------------------------------------------

  placeStrip() {
    this.placeRoom();
    if (!this.strip || this.strip.isDestroyed()) return;
    const { workArea } = screen.getPrimaryDisplay();
    this.strip.setBounds({ x: workArea.x, y: workArea.y + workArea.height - STRIP_HEIGHT, width: workArea.width, height: STRIP_HEIGHT });
  }

  openStrip() {
    if (this.strip && !this.strip.isDestroyed()) return;
    const w = new BrowserWindow({
      show: false, transparent: true, backgroundColor: '#00000000', frame: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true,
      webPreferences: { preload: PRELOAD },
    });
    this.strip = w;
    wireDebug(w, 'strip');
    this.placeStrip();
    // Clicks pass through the strip except over a character (the renderer flips this on hover).
    w.setIgnoreMouseEvents(true, { forward: true });
    w.loadFile(page('strip', 'index.html'));
    w.once('ready-to-show', () => this.shouldShow() && w.showInactive());
    w.on('closed', () => { if (this.strip === w) this.strip = null; });
  }

  // ---- Room -----------------------------------------------------------------

  // The room is docked above the taskbar like the strip; its height comes from the renderer.
  placeRoom() {
    if (!this.room || this.room.isDestroyed()) return;
    const { workArea } = screen.getPrimaryDisplay();
    const height = this.roomHeight || 256;
    this.room.setBounds({ x: workArea.x, y: workArea.y + workArea.height - height, width: workArea.width, height });
  }

  openRoom() {
    if (this.room && !this.room.isDestroyed()) return;
    const w = new BrowserWindow({
      show: false, transparent: true, backgroundColor: '#00000000', frame: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true,
      webPreferences: { preload: PRELOAD },
    });
    this.room = w;
    wireDebug(w, 'room');
    this.placeRoom();
    w.loadFile(page('room', 'index.html'));
    w.once('ready-to-show', () => this.shouldShow() && w.showInactive());
    w.on('closed', () => { if (this.room === w) this.room = null; });
    if (DEBUG) {
      // Dump what the room canvas actually contains, for debugging without looking at the screen.
      setTimeout(async () => {
        if (w.isDestroyed()) return;
        const out = require('path').join(require('os').tmpdir(), 'deskmates-room.png');
        const url = await w.webContents.executeJavaScript('document.getElementById("room").toDataURL("image/png")').catch((e) => String(e));
        if (url.startsWith('data:')) require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
        console.log(`[room] canvas dump -> ${url.startsWith('data:') ? out : url}`);
      }, 6000);
    }
  }

  resizeRoom(_width, height) {
    if (DEBUG) console.log(`[deskmates] room height ${height}`);
    this.roomHeight = Math.round(height);
    this.placeRoom();
  }

  // ---- Normal windows -------------------------------------------------------

  openPanel(name, file, opts) {
    const existing = this[name];
    if (existing && !existing.isDestroyed()) {
      existing.show();
      existing.focus();
      return existing;
    }
    const w = new BrowserWindow({
      show: false, autoHideMenuBar: true, backgroundColor: '#f6f2ea', title: 'Deskmates',
      webPreferences: { preload: PRELOAD }, ...opts,
    });
    this[name] = w;
    wireDebug(w, name);
    w.loadFile(page(file, 'index.html'));
    w.once('ready-to-show', () => w.show());
    w.on('closed', () => { if (this[name] === w) this[name] = null; });
    return w;
  }

  openSettings() {
    return this.openPanel('settings', 'settings', { width: 820, height: 720, minWidth: 640, minHeight: 480 });
  }

  openGuild(tab) {
    const fresh = !this.guild || this.guild.isDestroyed();
    const w = this.openPanel('guild', 'guild', { width: 960, height: 720, minWidth: 720, minHeight: 520 });
    if (tab && fresh) w.webContents.once('did-finish-load', () => w.webContents.send('guild:tab', tab));
    else if (tab) w.webContents.send('guild:tab', tab);
    return w;
  }
}

module.exports = { Windows };
