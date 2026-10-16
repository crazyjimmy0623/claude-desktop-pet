// 16x16 knight's helm for the tray, built from a pixel map so no image file is needed.
const { nativeImage } = require('electron');

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

function buildTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  MAP.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const [r, g, b, a] = COLORS[ch] || COLORS['.'];
      const i = (y * size + x) * 4;
      // createFromBitmap expects BGRA
      buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = a;
    });
  });
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

module.exports = { buildTrayIcon };
