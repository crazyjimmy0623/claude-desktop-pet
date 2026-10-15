const { app, BrowserWindow, Menu, Tray, ipcMain, screen, shell } = require('electron');
const http = require('http');
const path = require('path');
const { summarize } = require('./summarize');
const { buildTrayIcon } = require('./tray-icon');
const { runDemo } = require('./demo');

const PORT = Number(process.env.DESKMATES_PORT) || 47321;
const STRIP_HEIGHT = 260;
const MAX_BODY = 20 * 1024 * 1024;

let win = null;
let tray = null;
let knightCount = 0;

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

function placeWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win.setBounds({
    x: workArea.x,
    y: workArea.y + workArea.height - STRIP_HEIGHT,
    width: workArea.width,
    height: STRIP_HEIGHT,
  });
}

function createWindow() {
  win = new BrowserWindow({
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  placeWindow();
  win.setAlwaysOnTop(true, 'screen-saver');
  // The strip covers the bottom of the screen, so clicks pass through
  // everywhere except over a knight (the renderer flips this on hover).
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  screen.on('display-metrics-changed', placeWindow);
  screen.on('display-added', placeWindow);
  screen.on('display-removed', placeWindow);
}

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

function dispatch(payload) {
  const ev = summarize(payload);
  if (ev) send('pet-event', ev);
}

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/event') {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size <= MAX_BODY) chunks.push(c);
      });
      req.on('end', () => {
        // Empty 204: an http hook's response body could otherwise steer Claude's decisions.
        res.writeHead(204).end();
        if (size > MAX_BODY) return;
        try {
          dispatch(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          // Ignore malformed payloads; the pet must never get in Claude's way.
        }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    res.writeHead(404).end();
  });
  server.on('error', (err) => console.error(`[pet] server error: ${err.message}`));
  server.listen(PORT, '127.0.0.1', () => console.log(`[pet] listening on http://127.0.0.1:${PORT}/event`));
}

function loginItemOptions() {
  // In dev the app runs as electron.exe + project path, so both must be registered.
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function buildTrayMenu() {
  const autoStart = app.getLoginItemSettings(loginItemOptions()).openAtLogin;
  return Menu.buildFromTemplate([
    { label: `Deskmates — ${knightCount} 位夥伴上工中`, enabled: false },
    { type: 'separator' },
    {
      label: win?.isVisible() ? '隱藏' : '顯示',
      click: () => (win.isVisible() ? win.hide() : win.showInactive()),
    },
    { label: '播放示範', click: () => runDemo(dispatch) },
    { label: '重新排隊', click: () => send('pet-command', { type: 'regroup' }) },
    { label: '全部下班', click: () => send('pet-command', { type: 'clear' }) },
    { type: 'separator' },
    {
      label: '開機自動啟動',
      type: 'checkbox',
      checked: autoStart,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...loginItemOptions() }),
    },
    { type: 'separator' },
    { label: '結束', click: () => app.quit() },
  ]);
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('Deskmates');
  const popup = () => tray.popUpContextMenu(buildTrayMenu());
  tray.on('click', popup);
  tray.on('right-click', popup);
}

ipcMain.on('set-ignore-mouse', (_e, ignore) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});

ipcMain.on('knight-count', (_e, n) => {
  knightCount = n;
});

ipcMain.on('knight-menu', (_e, info) => {
  const menu = Menu.buildFromTemplate([
    { label: info.project || 'Claude', enabled: false },
    { type: 'separator' },
    { label: '開啟專案資料夾', enabled: !!info.cwd, click: () => shell.openPath(info.cwd) },
    { label: '叫他下班', click: () => send('pet-command', { type: 'remove', session: info.session }) },
  ]);
  menu.popup({ window: win });
});

app.on('second-instance', () => win?.showInactive());

app.whenReady().then(() => {
  createWindow();
  createTray();
  startServer();
  if (process.argv.includes('--demo')) {
    win.webContents.once('did-finish-load', () => setTimeout(() => runDemo(dispatch), 500));
  }
});

// Keep running in the tray even if the window goes away.
app.on('window-all-closed', () => {});
