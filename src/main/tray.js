// System tray icon and menu.
const { app, Menu, Tray } = require('electron');
const { buildTrayIcon } = require('./tray-icon');

function loginItemOptions() {
  // In dev the app runs as electron.exe + project path, so both must be registered.
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function createTray(ctx) {
  const { store, windows, focus, progress } = ctx;
  const tray = new Tray(buildTrayIcon());
  tray.setToolTip('Deskmates');

  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  const build = () => {
    const s = store.settings;
    const snap = progress.snapshot();
    const f = focus.state;
    return Menu.buildFromTemplate([
      { label: `Deskmates · Lv.${snap.level} · ${snap.coins} 🪙`, enabled: false },
      { type: 'separator' },
      s.mode === 'room'
        ? { label: '🧍 切換到工作列', click: () => store.updateSettings({ mode: 'strip' }) }
        : { label: '🏠 切換到房間', click: () => store.updateSettings({ mode: 'room' }) },
      { label: windows.hiddenByUser ? '顯示夥伴' : '暫時隱藏', click: () => windows.setHidden(!windows.hiddenByUser) },
      { type: 'separator' },
      f
        ? { label: `🍅 停止番茄鐘（${f.phase === 'focus' ? '專注' : '休息'} ${mmss(Math.max(0, f.endsAt - Date.now()))}）`, click: () => focus.stop() }
        : { label: `🍅 開始專注 ${s.pomodoro.focus} 分鐘`, click: () => focus.start() },
      { label: '📖 公會手冊（收集・招募・成就）', click: () => windows.openGuild() },
      { label: '⚙️ 設定…', click: () => windows.openSettings() },
      { type: 'separator' },
      { label: '結束', click: () => app.quit() },
    ]);
  };

  const popup = () => tray.popUpContextMenu(build());
  tray.on('click', popup);
  tray.on('right-click', popup);
  return tray;
}

module.exports = { createTray, loginItemOptions };
