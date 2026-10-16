// Renders scripts/preview/preview.html offscreen and saves a PNG: electron scripts/preview/capture.js <mode> <out.png>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const [mode = 'chars', out = 'preview.png'] = process.argv.slice(2).filter((a) => !a.startsWith('-') && !a.endsWith('capture.js') && a !== '.');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, 'preview.html'), { query: { mode } });
  await new Promise((r) => setTimeout(r, 300));
  // Export the canvas itself; capturePage is clipped to the screen size.
  const dataUrl = await win.webContents.executeJavaScript('document.getElementById("c").toDataURL("image/png")');
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('saved', out);
  app.quit();
});
