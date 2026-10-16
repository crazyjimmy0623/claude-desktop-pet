// 16x16 commander face for the tray, built from a pixel map so no image file is needed.
const { nativeImage } = require('electron');

const MAP = [
  '................',
  '......RRRR......',
  '....RRRRRR......',
  '...KKKKKKKKKK...',
  '..KKKKKGKKKKKK..',
  '.KKKKKKKKKKKKKK.',
  '.KKggggggggggKK.',
  '.KKSSSSSSSSSSKK.',
  '.KSSSSESSSESSSK.',
  '.KSSSSESSSESSSK.',
  '.KSSPSSSSSSPSSK.',
  '..SSSSSSSSSSSS..',
  '...SSSSSSSSSS...',
  '....DDDDDDDD....',
  '....DDDDDDDD....',
  '................',
];

const COLORS = {
  K: [0x2b, 0x2d, 0x3a, 255],
  R: [0xc8, 0x30, 0x3c, 255],
  G: [0xe8, 0xb1, 0x3a, 255],
  g: [0xff, 0x3b, 0x3b, 255],
  S: [0xf6, 0xcf, 0xa6, 255],
  E: [0x2b, 0x22, 0x33, 255],
  P: [0xf5, 0xa3, 0xa3, 255],
  D: [0x30, 0x32, 0x3f, 255],
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
