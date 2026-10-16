// The app's taskbar button. Clicking it pops a small control panel up above the taskbar;
// clicking away (or the button again) tucks it back into the taskbar. Closing it quits.
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { buildIcon } = require('./icon');

const SIZE = { width: 300, height: 330 };

function loginItemOptions() {
  // In dev the app runs as electron.exe + project path, so both must be registered.
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function createHub(ctx) {
  const { store, windows, focus, progress } = ctx;
  const icon = buildIcon(4);
  const w = new BrowserWindow({
    ...SIZE, show: false, frame: false, resizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: true, backgroundColor: '#211e29', title: 'Deskmates', icon,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
  });
  w.loadFile(path.join(__dirname, '..', 'renderer', 'hub', 'index.html'));

  const place = () => {
    const { workArea } = screen.getPrimaryDisplay();
    w.setBounds({ x: workArea.x + workArea.width - SIZE.width - 12, y: workArea.y + workArea.height - SIZE.height - 12, ...SIZE });
  };
  // Clicking the taskbar button while the panel is open first blurs it (we minimise), then Windows
  // restores it again; treat a restore right after our own minimise as the user closing it.
  let tuckedAt = 0;
  const tuck = () => {
    if (w.isDestroyed() || w.isMinimized()) return;
    tuckedAt = Date.now();
    w.minimize();
  };
  w.on('blur', tuck);
  w.on('restore', () => {
    if (Date.now() - tuckedAt < 300) { w.minimize(); return; }
    place();
    w.webContents.send('hub:refresh');
  });
  w.on('close', () => { app.isQuitting = true; app.quit(); });
  w.once('ready-to-show', () => { place(); w.minimize(); });

  const state = () => {
    const snap = progress.snapshot();
    const s = store.settings;
    return {
      level: snap.level, coins: snap.coins, mode: s.mode, hidden: windows.hiddenByUser,
      focus: focus.state ? { phase: focus.state.phase, endsAt: focus.state.endsAt } : null, focusMinutes: s.pomodoro.focus,
    };
  };
  const actions = {
    mode: () => store.updateSettings({ mode: store.settings.mode === 'room' ? 'strip' : 'room' }),
    hide: () => windows.setHidden(!windows.hiddenByUser),
    focus: () => (focus.state ? focus.stop() : focus.start()),
    guild: () => { tuck(); windows.openGuild(); },
    settings: () => { tuck(); windows.openSettings(); },
    quit: () => app.quit(),
  };
  return {
    window: w,
    state,
    action: (name) => { actions[name]?.(); return state(); },
    show: () => { if (w.isMinimized()) w.restore(); else { place(); w.show(); } w.focus(); },
  };
}

module.exports = { createHub, loginItemOptions };
