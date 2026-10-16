// All Deskmates windows: the taskbar strip and the room. Settings and the guild book open in their drawer.
const { app, BrowserWindow, screen } = require('electron');
const { buildIcon } = require('./icon');
const path = require('path');

const PRELOAD = path.join(__dirname, '..', 'preload.js');
const page = (...p) => path.join(__dirname, '..', 'renderer', ...p);
const STRIP_HEIGHT = 380;
const DEBUG = !!process.env.DESKMATES_DEBUG;

// Always: never let a dropped file or link replace a page (that looks like the app vanishing),
// note crashes in deskmates.log, and bring a crashed page straight back.
function wireSafety(w, name) {
  const ours = (url) => url.startsWith('file:') && /\.html(\?|#|$)/.test(url);
  w.webContents.on('will-navigate', (e, url) => { if (!ours(url)) e.preventDefault(); });
  w.webContents.on('will-frame-navigate', (e) => { if (!ours(e.url)) e.preventDefault(); });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('render-process-gone', (_e, d) => {
    note(`${name} page gone: ${d.reason} (${d.exitCode})`);
    if (d.reason !== 'clean-exit' && !w.isDestroyed()) setTimeout(() => { if (!w.isDestroyed()) w.reload(); }, 500);
  });
  w.on('unresponsive', () => note(`${name} page not responding`));
}
function note(text) {
  try {
    const file = path.join(app.getPath('userData'), 'deskmates.log');
    require('fs').appendFileSync(file, `${new Date().toISOString()} ${text}\n`);
  } catch { /* nowhere to write */ }
}

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
    this.fullscreen = false;
    this.hiddenByUser = false;
    // Windows sometimes pushes topmost windows down (e.g. after clicking the taskbar); keep reclaiming the top.
    setInterval(() => this.reassertTop(), 3000);
  }

  all() {
    return [this.strip, this.room].filter((w) => w && !w.isDestroyed());
  }

  // To every frame, so the guild and settings pages inside a drawer hear it too.
  broadcast(channel, data) {
    for (const w of this.all()) {
      for (const f of w.webContents.mainFrame.framesInSubtree) {
        try { f.send(channel, data); } catch { /* frame going away */ }
      }
    }
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
    this[name] = null;
    if (w && !w.isDestroyed()) w.destroy();
  }

  // The strip or room is the app's taskbar window: clicking the taskbar button brings it up,
  // closing it from the taskbar quits.
  overlayWindow(opts) {
    const w = new BrowserWindow({
      show: false, transparent: true, backgroundColor: '#00000000', frame: false, resizable: false, movable: false,
      minimizable: true, maximizable: false, fullscreenable: false, hasShadow: false, alwaysOnTop: this.store.settings.alwaysOnTop,
      title: 'Deskmates', icon: buildIcon(4), webPreferences: { preload: PRELOAD, nodeIntegrationInSubFrames: true }, ...opts,
    });
    w.on('close', () => { if (this.strip === w || this.room === w) app.quit(); });
    return w;
  }

  bringUp() {
    this.setHidden(false);
    const w = this.overlays[0];
    if (!w) return;
    if (w.isMinimized()) w.restore();
    w.show();
    w.moveTop();
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
    const w = this.overlayWindow();
    this.strip = w;
    wireSafety(w, 'strip');
    wireDebug(w, 'strip');
    this.placeStrip();
    // Clicks pass through the strip except over a character (the renderer flips this on hover).
    w.setIgnoreMouseEvents(true, { forward: true });
    w.loadFile(page('strip', 'index.html'));
    w.once('ready-to-show', () => this.shouldShow() && w.showInactive());
    w.on('closed', () => { if (this.strip === w) this.strip = null; });
  }

  // ---- Room -----------------------------------------------------------------

  // The room floats above the taskbar, bottom right unless the user dragged it somewhere.
  // Its size comes from the renderer; the bottom-right corner stays put when it grows. With the
  // drawer open the window reaches down to the taskbar, so the drawer sits on it wherever the room
  // is; the gap under the room is returned for the renderer to keep the room where it was.
  placeRoom() {
    if (!this.room || this.room.isDestroyed()) return 0;
    const width = this.roomWidth || 680;
    const roomH = this.roomHeight || 560;
    const pos = this.store.settings.roomPos;
    const area = pos ? screen.getDisplayNearestPoint({ x: pos.right, y: pos.bottom }).workArea : screen.getPrimaryDisplay().workArea;
    const right = pos ? Math.min(pos.right, area.x + area.width) : area.x + area.width - 8;
    const bottom = pos ? Math.min(pos.bottom, area.y + area.height) : area.y + area.height;
    // Taller than the screen means the toolbar is out of reach: step the zoom down instead.
    if (roomH > area.height && this.store.settings.roomZoom > 1) {
      this.store.updateSettings({ roomZoom: this.store.settings.roomZoom - 1 });
      return 0;
    }
    const gap = this.drawerH ? area.y + area.height - bottom : 0;
    const height = Math.max(roomH + gap, this.drawerH || 0);
    this.gap = gap;
    this.room.setBounds({ x: Math.max(area.x, right - width), y: Math.max(area.y, bottom + gap - height), width, height });
    return gap;
  }

  // Drag the room window with the cursor until the renderer reports the mouse is up.
  dragRoom(on) {
    clearInterval(this.dragTimer);
    if (!this.room || this.room.isDestroyed()) return;
    if (!on) {
      const b = this.room.getBounds();
      this.store.updateSettings({ roomPos: { right: b.x + b.width, bottom: b.y + b.height - (this.gap || 0) } });
      return;
    }
    const start = screen.getCursorScreenPoint();
    const b0 = this.room.getBounds();
    this.dragTimer = setInterval(() => {
      if (!this.room || this.room.isDestroyed()) return clearInterval(this.dragTimer);
      const p = screen.getCursorScreenPoint();
      this.room.setBounds({ ...b0, x: b0.x + p.x - start.x, y: b0.y + p.y - start.y });
    }, 16);
  }

  openRoom() {
    if (this.room && !this.room.isDestroyed()) return;
    const w = this.overlayWindow();
    this.room = w;
    wireSafety(w, 'room');
    wireDebug(w, 'room');
    this.placeRoom();
    // Clicks pass through the empty corners around the diorama (the renderer flips this on hover).
    w.setIgnoreMouseEvents(true, { forward: true });
    w.loadFile(page('room', 'index.html'));
    w.once('ready-to-show', () => this.shouldShow() && w.showInactive());
    w.on('closed', () => { if (this.room === w) this.room = null; });
    if (DEBUG) {
      // Dump what the room canvas actually contains, for debugging without looking at the screen.
      setTimeout(async () => {
        if (w.isDestroyed()) return;
        // DESKMATES_DEBUG_JS: a script to run in the room first (open the editor, pick a tab...).
        if (process.env.DESKMATES_DEBUG_JS) {
          await w.webContents.executeJavaScript(process.env.DESKMATES_DEBUG_JS).catch((e) => console.log(`[room] debug js: ${e}`));
          await new Promise((r) => setTimeout(r, 1500));
        }
        const out =require('path').join(require('os').tmpdir(), 'deskmates-room.png');
        const url = await w.webContents.executeJavaScript('document.getElementById("room").toDataURL("image/png")').catch((e) => String(e));
        if (url.startsWith('data:')) require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
        console.log(`[room] canvas dump -> ${url.startsWith('data:') ? out : url}`);
        // And the whole window as composed, drawer included.
        const shot = require('path').join(require('os').tmpdir(), 'deskmates-window.png');
        require('fs').writeFileSync(shot, (await w.webContents.capturePage()).toPNG());
        console.log(`[room] window dump -> ${shot}`);
        // DESKMATES_DEBUG_STEPS: a JSON list of more scripts, a window dump after each (-1, -2...).
        const steps = (() => { try { return JSON.parse(process.env.DESKMATES_DEBUG_STEPS || '[]'); } catch { return []; } })();
        for (const [i, js] of steps.entries()) {
          if (w.isDestroyed()) return;
          // '@guild ...' runs inside the drawer's guild page.
          const frame = js.startsWith('@guild ') ? w.webContents.mainFrame.framesInSubtree.find((f) => f.url.includes('/guild/')) : null;
          await (frame || w.webContents).executeJavaScript(js.replace(/^@guild /, '')).then((r) => console.log(`[room] debug step ${i + 1} -> ${String(r).slice(0, 300)}`)).catch((e) => console.log(`[room] debug step ${i + 1}: ${e}`));
          await new Promise((r) => setTimeout(r, 1800));
          const file = require('path').join(require('os').tmpdir(), `deskmates-window-${i + 1}.png`);
          require('fs').writeFileSync(file, (await w.webContents.capturePage()).toPNG());
          console.log(`[room] window dump ${i + 1} -> ${file}`);
        }
      }, 6000);
    }
  }

  resizeRoom(width, height, drawerH = 0) {
    if (DEBUG) console.log(`[deskmates] room ${width}x${height} drawer ${drawerH}`);
    this.roomWidth = Math.ceil(width);
    this.roomHeight = Math.ceil(height);
    this.drawerH = drawerH;
    return this.placeRoom();
  }

  // ---- Drawer ---------------------------------------------------------------

  // Settings and the guild book open in the strip's or room's drawer, never a window of their own.
  openDrawer(pane, tab) {
    this.bringUp();
    const w = this.overlays[0];
    if (!w) return;
    const send = () => {
      w.webContents.send('dock:open', { pane, tab });
      w.focus();
    };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send);
    else send();
  }

  openSettings() {
    this.openDrawer('settings');
  }

  openGuild(tab) {
    this.openDrawer('guild', tab);
  }
}

module.exports = { note, Windows };
