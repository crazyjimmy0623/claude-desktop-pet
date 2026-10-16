// 16x16 helmet icon for the tray, built from a pixel map so no image file is needed.
const { nativeImage } = require('electron');

const MAP = [
  '................',
  '......####......',
  '.....#OOOO#.....',
  '...##########...',
  '..#WWWWWWWWWW#..',
  '..#WWWWWWWWWW#..',
  '..#WWWWWWWWWW#..',
  '..#WW#######W#..',
  '..#WW#######W#..',
  '..#WWWWW##WWW#..',
  '..#WWWWW##WWW#..',
  '..#WWWWW##WWW#..',
  '...#WWWW##WW#...',
  '....####..##....',
  '................',
  '................',
];

const COLORS = {
  '#': [0x1d, 0x1b, 0x26, 255],
  W: [0xf1, 0xf1, 0xf4, 255],
  O: [0xe8, 0x6a, 0x3a, 255],
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
