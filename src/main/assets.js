// User-supplied art in <userData>/custom:
//   characters/<name>/<anything>.png + <anything>.json  (Aseprite "Export Sprite Sheet" JSON with frame tags)
//   tiles/<anything>.png                                  (16x16 cells, painted onto room floors)
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const root = () => path.join(app.getPath('userData'), 'custom');

function ensureFolders() {
  for (const dir of ['characters', 'tiles']) fs.mkdirSync(path.join(root(), dir), { recursive: true });
  const readme = path.join(root(), 'README.txt');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, [
      'Deskmates 自訂素材',
      '',
      'characters/<角色名稱>/  放一張 PNG sprite sheet 和 Aseprite 匯出的 JSON。',
      '  建議每格 32x28，用 frame tag 命名動作：idle, walk, work, type, hammer, read, paint, wait, done, sleep, dangle, dance。',
      '  缺少的動作會用 work 或 idle 代替。',
      '',
      'tiles/  放 PNG，每 16x16 像素一格，會出現在房間編輯器的「自訂地板」。',
      '',
      '改完後在設定或房間編輯器按「重新載入素材」。',
    ].join('\r\n'));
  }
}

const toDataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

function loadCustomAssets() {
  ensureFolders();
  const characters = [];
  const charDir = path.join(root(), 'characters');
  for (const name of fs.readdirSync(charDir)) {
    const dir = path.join(charDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir);
    const png = files.find((f) => f.toLowerCase().endsWith('.png'));
    const json = files.find((f) => f.toLowerCase().endsWith('.json'));
    if (!png || !json) continue;
    try {
      characters.push({ id: `custom:${name}`, name, dataUrl: toDataUrl(path.join(dir, png)), json: JSON.parse(fs.readFileSync(path.join(dir, json), 'utf8')) });
    } catch (err) {
      console.error(`[deskmates] skipped custom character ${name}: ${err.message}`);
    }
  }
  const tiles = [];
  const tileDir = path.join(root(), 'tiles');
  for (const file of fs.readdirSync(tileDir)) {
    if (file.toLowerCase().endsWith('.png')) tiles.push({ file, dataUrl: toDataUrl(path.join(tileDir, file)) });
  }
  return { characters, tiles };
}

function openCustomFolder() {
  ensureFolders();
  shell.openPath(root());
}

module.exports = { loadCustomAssets, openCustomFolder };
