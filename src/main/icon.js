// The knight's helm as the app icon, built from a pixel map. Windows get it straight from the map;
// the installer's build/icon.ico is made from the same map by scripts/make-icon.js (npm run icon,
// which npm run dist runs first).

const MAP = [
  '................',
  '.....pppp.......',
  '...pppppp.......',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '.WWWWWWWWWWWWWW.',
  '.sWWWWWWWWWWWWW.',
  '.sWKKKKKKKKKKKW.',
  '.sWKKKKKKKKKKKW.',
  '.sWWWWWWKKWWWWW.',
  '.sWWWWWWKKWWsWs.',
  '..sWWWWWKKWWWW..',
  '...ssssssssss...',
  '....DDDDDDDD....',
  '...DDDDDDDDDD...',
  '................',
];

const COLORS = {
  W: [0xec, 0xee, 0xf3, 255],
  s: [0xbf, 0xc3, 0xcf, 255],
  K: [0x2b, 0x22, 0x33, 255],
  p: [0x3a, 0x3c, 0x48, 255],
  D: [0x2a, 0x2c, 0x36, 255],
  '.': [0, 0, 0, 0],
};

// The 16x16 map scaled up by whole pixels, so the icon stays crisp at taskbar sizes, as RGBA.
function pixels(scale = 1) {
  const size = 16 * scale;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rgba = COLORS[MAP[Math.floor(y / scale)][Math.floor(x / scale)]] || COLORS['.'];
      buf.set(rgba, (y * size + x) * 4);
    }
  }
  return buf;
}

function buildIcon(scale = 1) {
  const { nativeImage } = require('electron');
  const size = 16 * scale;
  const buf = pixels(scale);
  // createFromBitmap expects BGRA
  for (let i = 0; i < buf.length; i += 4) [buf[i], buf[i + 2]] = [buf[i + 2], buf[i]];
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

module.exports = { buildIcon, pixels };
