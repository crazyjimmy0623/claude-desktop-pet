// Room mode art: 16px floor/wall tiles and furniture, all drawn in code on a 2x fine grid.
// Furniture coordinates are pixels relative to the footprint's top-left; negative y rises above it.
(function (root, factory) {
  root.Furniture = factory(root.Sprites);
})(typeof self !== 'undefined' ? self : this, (Sprites) => {
  const T = 16;
  const { PAL, RES } = Sprites;

  // Shading overlays work in every theme because they only darken or lighten what is underneath.
  const SH = 'rgba(16,12,40,0.22)';
  const SH2 = 'rgba(16,12,40,0.4)';
  const HL = 'rgba(255,255,255,0.3)';
  const HL2 = 'rgba(255,255,255,0.6)';
  const GRAIN = 'rgba(60,30,10,0.16)';

  // ---- Floors & walls --------------------------------------------------------
  // Tiles are drawn on the fine grid: 32x32 per 16px tile, walls 32 wide by wallRows*32 tall.

  const FLOORS = {
    wood: (r, x, y) => {
      r(0, 0, 32, 32, '#b07a48');
      for (let i = 0; i < 4; i++) {
        const top = i * 8;
        const joint = ((i + y + x) % 2) * 16 + 6;
        r(0, top, 32, 1, '#bd8a56');
        r(0, top + 7, 32, 1, '#8a5c33');
        r(joint, top, 1, 7, '#8a5c33');
        r(joint + 1, top + 1, 1, 6, '#c08d5a');
        r((i * 11 + x * 5 + y * 3) % 22 + 2, top + 3, 6, 1, GRAIN);
        r((i * 7 + x * 3 + y * 5) % 20 + 6, top + 5, 4, 1, GRAIN);
        r(joint + 3, top + 2, 1, 1, '#7a522c');
        r(joint - 3, top + 4, 1, 1, '#7a522c');
      }
    },
    tile: (r, x, y) => {
      const a = '#ece7dd';
      const b = '#d8d1c4';
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const light = (x + y + qx + qy) % 2 === 0;
          r(qx * 16, qy * 16, 16, 16, light ? a : b);
          r(qx * 16 + 2, qy * 16 + 2, 4, 1, HL2);
          r(qx * 16 + 2, qy * 16 + 3, 1, 2, HL2);
          r(qx * 16 + 15, qy * 16, 1, 16, '#c3bcae');
          r(qx * 16, qy * 16 + 15, 16, 1, '#c3bcae');
        }
      }
    },
    carpet: (r, x, y) => {
      r(0, 0, 32, 32, '#7a5aa0');
      for (let i = 0; i < 8; i++) {
        r((i * 4 + (y % 2) * 2) % 32, i * 4, 2, 1, '#8a6ab2');
        r((i * 4 + 17 + (x % 2) * 2) % 32, i * 4 + 2, 1, 1, '#6a4b8e');
      }
      if ((x + y) % 2 === 0) {
        r(14, 12, 4, 1, '#9b7fc4'); r(13, 13, 6, 6, '#9b7fc4'); r(14, 19, 4, 1, '#9b7fc4'); r(15, 15, 2, 2, '#ffd08a');
      }
    },
    stone: (r, x, y) => {
      r(0, 0, 32, 32, '#5f646d');
      const stones = (x + y) % 2
        ? [[1, 1, 18, 13], [20, 1, 11, 13], [1, 15, 11, 16], [13, 15, 18, 16]]
        : [[1, 1, 11, 16], [13, 1, 18, 12], [1, 18, 17, 13], [19, 14, 12, 17]];
      stones.forEach(([sx, sy, w, h], i) => {
        r(sx, sy, w, h, i % 2 ? '#868c95' : '#8f959e');
        r(sx, sy, w, 1, '#a3a9b1');
        r(sx, sy, 1, h, '#9aa0a8');
        r(sx, sy + h - 1, w, 1, '#73787f');
        if ((x * 7 + y * 3 + i) % 4 === 0) { r(sx + 3, sy + 4, 3, 1, '#73787f'); r(sx + 5, sy + 5, 2, 1, '#73787f'); }
      });
    },
    marble: (r, x, y) => {
      r(0, 0, 32, 32, '#f2f2f4');
      r(0, 31, 32, 1, '#d6d9e0'); r(31, 0, 1, 32, '#d6d9e0'); r(0, 0, 32, 1, '#ffffff');
      const s = (x * 3 + y * 5) % 7;
      for (let i = 0; i < 6; i++) r(4 + s + i * 3, 6 + i * 2 + (i % 2), 3, 1, '#d4d7de');
      r(18 - s, 22, 6, 1, '#dcdfe5'); r(23 - s, 23, 4, 1, '#dcdfe5');
    },
    cyber: (r, x, y) => {
      r(0, 0, 32, 32, '#0f1424');
      r(0, 0, 32, 1, '#1e2745'); r(0, 0, 1, 32, '#1e2745');
      r(0, 31, 32, 1, '#090c18'); r(31, 0, 1, 32, '#090c18');
      r(2, 2, 2, 2, '#25304f'); r(28, 28, 2, 2, '#080b16');
      const k = (x * 5 + y * 3) % 4;
      if (k === 0) { r(5, 10, 12, 1, '#19284a'); r(16, 10, 1, 10, '#19284a'); r(16, 19, 11, 1, '#19284a'); r(25, 18, 3, 3, '#1e3358'); }
      if (k === 2) { r(6, 24, 16, 1, '#19284a'); r(6, 14, 1, 10, '#19284a'); r(5, 12, 3, 3, '#1e3358'); }
      if ((x * 7 + y * 3) % 11 === 0) r(26, 19, 1, 1, '*#36f9ff');
      if ((x * 5 + y * 9) % 17 === 0) r(6, 13, 1, 1, '*#ff3ea5');
      if ((x + y * 2) % 9 === 0) r(0, 0, 1, 1, '*#36f9ff');
    },
    neon: (r, x, y) => {
      r(0, 0, 32, 32, '#150f24');
      r(0, 0, 32, 1, '#2a1a4a'); r(0, 0, 1, 32, '#2a1a4a');
      r(0, 31, 32, 1, '#0c0816'); r(31, 0, 1, 32, '#0c0816');
      if ((x + y) % 2 === 0) { r(12, 12, 8, 8, '#1f1536'); r(12, 12, 8, 1, '#2c1e4c'); }
      if ((x * 3 + y * 5) % 13 === 0) r(0, 0, 1, 1, '*#ff3ea5');
      if ((x * 5 + y * 3) % 11 === 0) r(16, 16, 1, 1, '*#9b5cff');
    },
    grass: (r, x, y) => {
      r(0, 0, 32, 32, '#6db85a');
      for (let i = 0; i < 9; i++) {
        const bx = (x * 13 + y * 7 + i * 11) % 30 + 1;
        const by = (x * 5 + y * 11 + i * 7) % 28 + 2;
        r(bx, by, 1, 3, i % 3 ? '#5aa84a' : '#86cc6e');
        r(bx + 1, by + 1, 1, 2, '#5aa84a');
      }
      if ((x + y) % 4 === 0) { r(20, 8, 2, 2, '#ffe066'); r(20, 8, 1, 1, '#ffffff'); }
      if ((x * 3 + y) % 5 === 0) { r(7, 22, 2, 2, '#ff8fb1'); }
    },
  };

  const WALLS = {
    cream: { base: '#f3e6cf', draw: (r, x, h) => {
      r(0, 0, 1, h, '#ead9bc'); r(16, 0, 2, h - 28, '#efe0c5');
      for (let k = 0; k < (h - 30) / 12; k++) { r(8, k * 12 + 8, 1, 1, '#e2cfae'); r(24, k * 12 + 14, 1, 1, '#e2cfae'); }
      r(0, h - 28, 32, 2, '#c9a77c'); r(0, h - 28, 32, 1, '#dcbc90');
      r(0, h - 26, 32, 18, '#eadbc0'); r(3, h - 23, 26, 12, '#e3d1b2'); r(3, h - 23, 26, 1, '#d6c19c'); r(3, h - 12, 26, 1, '#f5ead8');
    } },
    brick: { base: '#b5523b', draw: (r, x, h) => {
      for (let row = 0; row < h / 8; row++) {
        const off = ((row + x) % 2) * 16;
        r(0, row * 8 + 7, 32, 1, '#8f3f2d');
        r(off + 7, row * 8, 1, 7, '#8f3f2d');
        r(off + 23 > 31 ? off - 9 : off + 23, row * 8, 1, 7, '#8f3f2d');
        r(0, row * 8, 32, 1, '#c4644a');
        if ((row * 5 + x * 3) % 7 === 0) r(off + 9, row * 8 + 1, 12, 6, '#a54a35');
      }
    } },
    navy: { base: '#2f3e66', draw: (r, x, h) => {
      r(x % 2 ? 4 : 20, 0, 4, h - 28, '#36477a'); r(x % 2 ? 5 : 21, 0, 1, h - 28, '#3f5290');
      r(0, h - 28, 32, 2, '#c9a77c'); r(0, h - 26, 32, 18, '#26345a'); r(3, h - 23, 26, 12, '#2b3a63');
    } },
    cyber: { base: '#141a2e', neon: true, draw: (r, x, h) => {
      r(0, 0, 1, h, '#0a0e1b'); r(31, 0, 1, h, '#1b2240');
      r(0, 9, 32, 3, '#0e1324'); r(0, 9, 32, 1, '#1e2745');
      r(3, 15, 26, h - 34, '#182038'); r(3, 15, 26, 1, '#26305a'); r(3, h - 20, 26, 1, '#0d1222');
      r(4, 16, 1, 1, '#2f3a66'); r(27, 16, 1, 1, '#2f3a66'); r(4, h - 22, 1, 1, '#2f3a66'); r(27, h - 22, 1, 1, '#2f3a66');
      if (x % 3 === 1) for (let i = 0; i < 6; i++) r(8, 24 + i * 4, 16, 2, '#0d1222');
      if (x % 3 === 0) { r(7, 22, 2, h - 48, '#0d1222'); r(11, 22, 2, h - 48, '#101629'); r(24, 19, 2, 1, '*#36f9ff'); }
      if (x % 5 === 2) r(24, 24, 2, 1, '*#ff3ea5');
      if (x % 4 === 3) { r(6, h - 30, 20, 5, '#0d1222'); for (let i = 0; i < 5; i++) r(7 + i * 4, h - 29, 2, 3, '#3a3418'); }
    } },
    mint: { base: '#a8e0cf', draw: (r, x, h) => {
      r(0, 20, 32, 2, '#93d0bd'); r(x % 2 ? 8 : 24, 23, 2, 2, '#ffffff');
      r(0, h - 28, 32, 2, '#ffffff'); r(0, h - 26, 32, 18, '#93d0bd');
    } },
  };

  // ---- Furniture -------------------------------------------------------------
  // draw(g, state): g(rects, details, fine, fineRects) — rects/details in 16px-tile pixels (doubled),
  // fine/fineRects in fine pixels (32 per tile) for the small stuff.

  const side = (type, w, dy = 0) => [{ type, dx: -1, dy, facing: 1 }, { type, dx: w, dy, facing: -1 }];

  const OBJECTS = {
    desk: { w: 2, h: 1, stations: side('code', 2), draw: (g, s) => {
      const keys = [];
      for (let i = 0; i < 12; i++) keys.push([19 + i * 2, 3, 1, 1, '#8a91a3'], [20 + i * 2, 5, 1, 1, '#8a91a3']);
      g([[0, 0, 32, 6, '#b88452'], [0, 6, 32, 5, PAL.woodDark], [1, 11, 2, 5, PAL.woodDark], [29, 11, 2, 5, PAL.woodDark]], [[9, 1, 14, 2, '#c9ced8']], [
        [0, 0, 64, 1, '#d09a64'], [6, 8, 10, 1, GRAIN], [42, 9, 12, 1, GRAIN], [0, 12, 64, 1, '#5e3d22'],
        [4, 15, 18, 6, '#8a5e34'], [4, 15, 18, 1, '#a0703f'], [11, 17, 4, 1, PAL.gold], [42, 15, 18, 6, '#8a5e34'], [42, 15, 18, 1, '#a0703f'], [49, 17, 4, 1, PAL.gold],
        ...keys, [18, 2, 28, 1, HL], [50, 3, 4, 5, '#e6e9f0'], [51, 3, 2, 2, '#c9ced8'], [4, 2, 5, 6, '#ffffff'], [9, 3, 2, 3, '#ffffff'], [5, 2, 3, 1, '#7a522c'],
        [6, 22, 2, 10, SH], [60, 22, 2, 10, SH],
      ]);
      g([[15, -4, 2, 4, '#3a3f4c']], [], [[31, -8, 1, 8, HL]], [[24, -2, 16, 2, '#3a3f4c']]);
      const code = [];
      if (s.active) {
        const palette = ['#7cc47f', PAL.screen, '#ffd65a', '#c27bff', PAL.screen, '#ff8fb1', '#7cc47f', PAL.screen];
        for (let i = 0; i < 8; i++) {
          const indent = [0, 2, 4, 4, 2, 4, 6, 0][i];
          const len = 4 + ((i * 5 + Math.floor(s.frame / 2)) % 9);
          code.push([22 + indent, -27 + i * 2, Math.min(len, 20 - indent), 1, palette[i]]);
        }
        code.push([22 + ((s.frame * 3) % 14), -27 + 2 * (s.frame % 8), 1, 1, s.frame % 2 ? PAL.shine : '#16324a']);
      } else {
        code.push([22, -27, 4, 1, HL], [21, -26, 2, 1, HL], [36, -14, 6, 1, 'rgba(255,255,255,0.08)']);
      }
      g([[9, -15, 14, 11, '#2a2f3a']], [[10, -14, 12, 9, s.active ? '#16324a' : '#1b2030']], [...code, [20, -10, 24, 2, '#23272f'], [42, -9, 1, 1, s.active ? '*#7cff8c' : '#3a5a3a'], [18, -30, 28, 1, HL]]);
    } },
    server: { w: 1, h: 1, stations: side('terminal', 1), draw: (g, s) => {
      const parts = [];
      for (let i = 0; i < 8; i++) {
        const y = -30 + i * 7;
        const on = s.active ? (s.frame + i * 2) % 5 !== 0 : i % 3 === 0;
        parts.push([5, y, 22, 5, '#3d4352'], [5, y, 22, 1, '#4c5366'], [7, y + 1, 10, 1, '#22262f'], [7, y + 3, 10, 1, '#22262f'],
          [19, y + 1, 1, 1, on ? (i % 2 ? '#ffb347' : '#7cff8c') : '#2b2f3a'], [21, y + 1, 1, 1, on && (s.frame + i) % 2 ? '#7cff8c' : '#2b2f3a'], [23, y + 1, 3, 3, '#22262f']);
      }
      g([[1, -17, 14, 32, '#2b2f3a']], [[1, -17, 14, 1, '#4a5060']], [...parts, [28, -32, 2, 62, SH], [2, -32, 1, 62, HL], [6, 27, 20, 1, '#22262f'], [6, 29, 20, 1, '#22262f']]);
    } },
    bookshelf: { w: 2, h: 1, stations: [...side('read', 2), { type: 'read', dx: 0, dy: 1, facing: 1 }, { type: 'read', dx: 1, dy: 1, facing: -1 }], draw: (g) => {
      const colors = ['#d9534f', '#5aa7ff', '#7cc47f', '#ffd65a', '#c27bff', '#f0a35e', '#5e8fd9', '#e07a9a'];
      const books = [];
      for (let shelf = 0; shelf < 3; shelf++) {
        const floor = -20 + shelf * 22;
        let x = 5;
        let n = shelf * 5;
        while (x < 57) {
          n += 1;
          const w = 3 + (n * 7 % 3);
          const h = 11 + ((n * 5 + shelf) % 6);
          if (x + w > 58) break;
          if (n % 11 === 4) { // a leaning book
            books.push([x, floor - 9, w + 2, 9, colors[n % colors.length]], [x, floor - 9, 1, 9, SH]);
            x += w + 3;
            continue;
          }
          if (n % 13 === 7) { // a little trinket instead
            books.push([x + 1, floor - 6, 5, 6, '#c46a3c'], [x + 1, floor - 6, 5, 1, '#d98a5a'], [x + 2, floor - 10, 3, 4, '#4f9a4f']);
            x += 8;
            continue;
          }
          const c = colors[n % colors.length];
          books.push([x, floor - h, w, h, c], [x, floor - h + 2, w, 1, 'rgba(0,0,0,0.25)'], [x, floor - 4, w, 1, 'rgba(0,0,0,0.25)'], [x + w - 1, floor - h, 1, h, SH]);
          if (n % 3 === 0) books.push([x + 1, floor - h + 5, 1, 2, PAL.gold]);
          x += w + (n % 5 === 0 ? 2 : 0);
        }
        books.push([4, floor, 56, 4, PAL.woodDark], [4, floor, 56, 1, '#9c6b3c'], [4, floor + 3, 56, 1, SH2]);
      }
      g([[0, -20, 32, 34, PAL.wood]], [[2, -18, 28, 30, '#5e3d22']], [[0, -40, 64, 1, '#b88452'], [4, -36, 56, 3, SH2], ...books, [0, 26, 64, 2, SH], [62, -38, 2, 64, SH]], [[-1, -42, 66, 3, PAL.wood]]);
    } },
    globe: { w: 1, h: 1, stations: side('web', 1), draw: (g, s) => {
      g([[3, 12, 10, 3, PAL.woodDark], [7, 3, 2, 9, PAL.woodDark]], [], [[6, 24, 20, 1, '#9c6b3c'], [15, 6, 1, 18, HL]]);
      const spin = s.active ? s.frame % 4 : 0;
      g([[3, -10, 10, 12, '#4a90d9'], [2, -9, 12, 10, '#4a90d9']], [[3 + spin, -7, 3, 3, '#7cc47f'], [8 - spin, -3, 4, 2, '#7cc47f'], [6, -9, 2, 1, '#ffffff']], [
        [8 + spin * 2, -12, 3, 2, '#6cc06c'], [18 - spin * 2, -2, 2, 2, '#6cc06c'], [6, 2, 20, 1, 'rgba(0,0,0,0.2)'], [4, -16, 1, 14, 'rgba(0,0,0,0.12)'],
        [9, -17, 3, 1, HL2], [7, -16, 2, 2, HL], [26, -14, 1, 14, SH],
      ], [[5, -19, 22, 1, '#4a90d9'], [5, 4, 22, 1, '#4a90d9']]);
      g([], [[1, -4, 1, 2, PAL.gold], [14, -6, 1, 2, PAL.gold]], [[3, -12, 1, 2, PAL.gold], [28, -14, 1, 4, PAL.gold], [15, -21, 2, 2, PAL.gold]]);
    } },
    table: { w: 3, h: 2, stations: [
      { type: 'meeting', dx: -1, dy: 0, facing: 1 }, { type: 'meeting', dx: -1, dy: 1, facing: 1 },
      { type: 'meeting', dx: 3, dy: 0, facing: -1 }, { type: 'meeting', dx: 3, dy: 1, facing: -1 },
      { type: 'meeting', dx: 0, dy: 2, facing: 1 }, { type: 'meeting', dx: 2, dy: 2, facing: -1 },
    ], draw: (g) => {
      g([[0, 2, 48, 20, '#b88452'], [0, 22, 48, 5, PAL.woodDark], [2, 27, 3, 5, PAL.woodDark], [43, 27, 3, 5, PAL.woodDark]],
        [[8, 8, 4, 3, '#ffffff'], [9, 7, 2, 1, PAL.grip], [30, 12, 6, 4, PAL.page], [20, 6, 4, 3, '#ffffff']], [
          [0, 4, 96, 1, '#d09a64'], [8, 26, 20, 1, GRAIN], [50, 18, 24, 1, GRAIN], [20, 36, 30, 1, GRAIN], [66, 30, 18, 1, GRAIN], [0, 44, 96, 1, '#5e3d22'],
          [62, 26, 8, 1, PAL.ink], [62, 28, 9, 1, PAL.ink], [62, 30, 6, 1, PAL.ink], [64, 34, 7, 1, '#5aa7ff'], [22, 22, 3, 1, '#7a522c'], [44, 16, 3, 1, '#7a522c'],
          [56, 22, 3, 3, '#c9ced8'], [57, 23, 1, 1, '#e0405a'], [24, 26, 12, 8, '#3a3f4c'], [25, 27, 10, 5, '#16324a'], [26, 28, 6, 1, '#7ad1ff'], [8, 54, 2, 10, SH], [88, 54, 2, 10, SH],
        ]);
    } },
    bell: { w: 2, h: 1, stations: side('wait', 2), draw: (g, s) => {
      g([[0, -4, 32, 20, '#c98b5a']], [[0, -4, 32, 3, '#e0a878'], [4, 2, 24, 1, '#a86f45'], [4, 8, 24, 1, '#a86f45']], [
        [0, -8, 64, 1, '#f0c090'], [0, -2, 64, 1, SH2], [21, 0, 1, 30, '#a86f45'], [42, 0, 1, 30, '#a86f45'], [8, 8, 10, 1, GRAIN], [46, 20, 10, 1, GRAIN],
        [44, -7, 12, 2, '#ffffff'], [45, -6, 10, 1, '#c9ced8'], [62, -6, 2, 36, SH], [6, 6, 12, 8, '#d9a070'], [7, 7, 10, 1, PAL.ink], [7, 9, 8, 1, PAL.ink],
      ]);
      g([[13, -10, 6, 5, PAL.gold]], [[14, -9, 1, 1, PAL.shine]], [[31, -22, 2, 2, '#c9ced8'], [32, -18, 4, 1, HL2], [36, -18, 2, 8, SH]], [[27, -21, 10, 2, PAL.gold], [24, -10, 16, 2, PAL.woodDark]]);
      if (s.active && s.frame % 2) g([], [], [...[[10, -13], [21, -13], [16, -14]].flatMap(([x, y]) => [[x * 2, y * 2, 1, 3, PAL.spark], [x * 2 - 1, y * 2 + 1, 3, 1, PAL.spark]])]);
    } },
    sofa: { w: 2, h: 1, stations: [{ type: 'rest', dx: 0, dy: 1, facing: 1, seat: -10 }, { type: 'rest', dx: 1, dy: 1, facing: -1, seat: -10 }], draw: (g) => {
      g([[1, -10, 30, 12, '#5a7bd6'], [0, -2, 5, 16, '#4a68bd'], [27, -2, 5, 16, '#4a68bd'], [4, 2, 24, 10, '#6a8ae0']], [[5, 3, 22, 1, '#8aa6f0'], [15, -8, 1, 9, '#4a68bd']], [
        [2, -20, 60, 1, '#7a98e8'], [14, -12, 2, 2, '#3e5aa8'], [46, -12, 2, 2, '#3e5aa8'], [14, -11, 1, 1, HL], [46, -11, 1, 1, HL],
        [8, 16, 20, 1, '#7a98e8'], [36, 16, 20, 1, '#7a98e8'], [31, 6, 1, 18, '#5574c8'], [8, 22, 48, 2, SH], [0, -4, 10, 1, '#6a8ae0'], [54, -4, 10, 1, '#6a8ae0'],
        [2, 26, 6, 2, SH2], [56, 26, 6, 2, SH2], [6, 28, 2, 3, '#3a2a20'], [56, 28, 2, 3, '#3a2a20'],
      ]);
      g([], [], [[18, -14, 8, 7, '#ffd08a'], [18, -14, 8, 1, HL2], [20, -11, 4, 1, '#e0a050']]);
    } },
    coffee: { w: 1, h: 1, stations: side('coffee', 1), draw: (g, s) => {
      g([[2, -12, 12, 26, '#444a56'], [1, -14, 14, 3, '#2f343e']], [[4, -9, 8, 5, '#2b2f3a'], [11, -11, 1, 1, '#ff5f5f'], [6, 1, 4, 4, '#ffffff'], [6, 1, 4, 1, PAL.grip]], [
        [6, -38, 18, 10, '#6b4423'], [6, -38, 18, 2, '#8a5a30'], [8, -35, 2, 1, '#3a2010'], [14, -34, 2, 1, '#3a2010'], [19, -36, 2, 1, '#3a2010'],
        [9, -17, 10, 6, '#16324a'], [10, -16, 5, 1, '#7ad1ff'], [10, -14, 3, 1, '#7ad1ff'], [16, -14, 2, 2, '#7cc47f'],
        [9, -6, 3, 2, '#5a6070'], [14, -6, 3, 2, '#5a6070'], [11, -2, 6, 2, '#2b2f3a'], [12, 0, 1, 2, '#6b4423'], [6, 18, 20, 2, '#2b2f3a'], [7, 18, 18, 1, '#5a6070'],
        [25, -26, 2, 52, SH], [4, -26, 1, 52, HL], [13, 4, 4, 1, HL2], [19, 4, 2, 4, '#ffffff'],
      ], [[6, -38, 18, 10, '#6b4423']]);
      if (s.active) g([], [], [[14, -8 + (s.frame % 2) * 2, 1, 3, '#e6e9f0'], [17, -10 + ((s.frame + 1) % 2) * 2, 1, 3, '#e6e9f0'], [15, -12 + (s.frame % 2) * 2, 1, 2, '#e6e9f0']]);
    } },
    plant: { w: 1, h: 1, draw: (g) => {
      g([[2, -10, 12, 12, '#4f9a4f'], [5, -14, 6, 5, '#4f9a4f']], [[4, -8, 2, 2, '#6cc06c'], [9, -12, 2, 2, '#6cc06c'], [10, -4, 2, 2, '#3f7f3f']], [
        [14, -26, 1, 10, '#3f7f3f'], [8, -14, 1, 6, '#3f7f3f'], [22, -12, 1, 8, '#3f7f3f'], [6, -6, 4, 1, '#3f7f3f'], [18, -18, 4, 1, '#6cc06c'],
        [12, -24, 2, 1, '#8ad88a'], [6, -16, 2, 1, '#8ad88a'], [20, -8, 2, 1, '#8ad88a'], [24, -16, 2, 1, '#8ad88a'], [16, -2, 1, 6, '#3f7f3f'],
      ], [[3, -18, 3, 4, '#4f9a4f'], [26, -14, 3, 5, '#4f9a4f'], [13, -30, 6, 3, '#4f9a4f']]);
      g([[4, 2, 8, 12, '#c46a3c']], [[4, 2, 8, 2, '#d98a5a']], [[8, 8, 16, 1, '#a85a30'], [10, 10, 12, 1, SH], [22, 8, 2, 20, SH], [9, 9, 1, 16, HL], [10, 5, 12, 2, '#5a3a20'], [8, 26, 16, 1, SH2]], [[7, 4, 18, 3, '#c46a3c']]);
    } },
    window: { w: 2, h: 2, wall: true, draw: (g, s) => {
      const night = s.hour < 6 || s.hour >= 18;
      g([[3, 4, 26, 22, '#ffffff']], [[5, 6, 22, 18, night ? '#1d2a4d' : '#9fd4ff'], [15, 6, 2, 18, '#ffffff'], [5, 14, 22, 2, '#ffffff']], night
        ? [[16, 16, 1, 1, '#ffffff'], [44, 20, 1, 1, '#ffffff'], [22, 36, 1, 1, '#ffe066'], [50, 40, 1, 1, '#ffffff'], [12, 42, 1, 1, '#ffffff'],
          [42, 16, 6, 6, '#f5f0c8'], [42, 16, 2, 2, '#1d2a4d'], [45, 19, 1, 1, '#d8d2a8'], [10, 40, 20, 8, '#16203c'], [36, 42, 18, 6, '#16203c'], [14, 42, 1, 1, '#ffd65a'], [40, 44, 1, 1, '#ffd65a']]
        : [[12, 17, 10, 3, '#ffffff'], [14, 16, 6, 1, '#ffffff'], [40, 36, 10, 3, '#ffffff'], [42, 35, 5, 1, '#ffffff'], [44, 14, 6, 6, '#fff3a0'], [10, 40, 20, 8, '#8fc77a'], [34, 42, 20, 6, '#7cb86a'],
          [12, 13, 4, 1, HL2], [11, 14, 1, 3, HL2], [38, 33, 3, 1, HL2]], [[2, 52, 60, 3, '#e6e9f0']]);
      g([], [], [[4, 52, 56, 1, PAL.shine], [4, 54, 56, 1, SH]]);
    } },
    easel: { w: 1, h: 1, stations: side('art', 1), draw: (g, s) => {
      g([[3, -4, 1, 18, PAL.wood], [12, -4, 1, 18, PAL.wood], [7, -6, 2, 20, PAL.woodDark]], [], [[4, 4, 24, 2, PAL.woodDark]]);
      g([[1, -14, 14, 12, PAL.page]], [[3, -12, 4, 2, '#e0405a'], [8, -9, 5, 2, '#5aa7ff'], [4, -6, 3 + (s.active ? s.frame % 3 : 0), 1, '#7cc47f']], [
        [2, -28, 28, 1, HL2], [28, -28, 2, 24, SH], [2, -6, 28, 2, SH], [14, -22, 3, 2, '#ffd65a'], [20, -24, 4, 1, '#c27bff'], [6, -16, 2, 2, '#ff8fb1'], [22, -14, 3, 3, '#5aa7ff'],
      ]);
      g([], [], [[20, 8, 8, 4, '#d9b07a'], [21, 8, 2, 2, '#e0405a'], [24, 9, 2, 2, '#5aa7ff'], [22, 10, 2, 1, '#ffd65a']]);
    } },
    rug: { w: 3, h: 2, flat: true, draw: (g) => {
      const fringe = [];
      for (let i = 0; i < 23; i++) fringe.push([4 + i * 4, 2, 2, 2, '#ffd08a'], [4 + i * 4, 60, 2, 2, '#ffd08a']);
      g([[1, 2, 46, 28, '#c25b56']], [[4, 5, 40, 22, '#d9776f'], [8, 9, 32, 14, '#c25b56'], [14, 13, 20, 6, '#ffd08a']], [
        ...fringe, [10, 12, 76, 1, '#c25b56'], [10, 50, 76, 1, '#c25b56'], [30, 28, 36, 6, '#e0905a'], [46, 26, 4, 10, '#c25b56'], [20, 30, 4, 2, '#ffd08a'], [72, 30, 4, 2, '#ffd08a'],
      ]);
    } },
    lamp: { w: 1, h: 1, draw: (g, s) => {
      const on = s.hour >= 17 || s.hour < 7;
      g([[7, -10, 2, 22, '#3a3f4c'], [4, 12, 8, 3, '#3a3f4c']], [], [[15, -20, 1, 44, HL], [8, 24, 16, 1, HL], [8, 28, 16, 1, SH2]]);
      g([[2, -18, 12, 8, on ? '#ffe9a8' : '#e6d8b8']], on ? [[3, -10, 10, 1, '#fff6d0']] : [], [
        [4, -36, 24, 1, HL2], [6, -30, 20, 1, 'rgba(0,0,0,0.08)'], [6, -26, 20, 1, 'rgba(0,0,0,0.08)'], [24, -36, 4, 16, SH], ...(on ? [[10, -20, 12, 2, '*#fff6d0']] : []),
      ], [[5, -37, 22, 1, on ? '#ffe9a8' : '#e6d8b8']]);
    } },
    clock: { w: 1, h: 1, wall: true, draw: (g, s) => {
      const d = new Date(s.now);
      const hand = (v, len) => {
        const a = v * Math.PI * 2;
        const pts = [];
        for (let i = 1; i <= len; i++) pts.push([16 + Math.round(Math.sin(a) * i), 24 - Math.round(Math.cos(a) * i), 1, 1]);
        return pts;
      };
      const ticks = [[16, 14], [26, 24], [16, 34], [6, 24]].map(([x, y]) => [x, y, 1, 1, '#8a91a3']);
      g([[3, 6, 10, 12, '#ffffff'], [2, 7, 12, 10, '#ffffff']], [], [
        ...ticks, ...hand((d.getHours() % 12 + d.getMinutes() / 60) / 12, 5).map((r) => [...r, PAL.line]), ...hand(d.getMinutes() / 60, 8).map((r) => [...r, '#e0405a']),
        [15, 23, 3, 3, PAL.line], [6, 14, 4, 1, HL2], [5, 15, 1, 3, HL2], [26, 18, 2, 14, SH],
      ], [[5, 13, 22, 22, '#ffffff']]);
    } },
    poster: { w: 1, h: 1, wall: true, draw: (g) => {
      g([[2, 4, 12, 16, '#ffd65a']], [[4, 6, 8, 6, '#5aa7ff']], [
        [9, 16, 6, 4, '#ffffff'], [16, 18, 6, 6, '#7cc47f'], [10, 28, 12, 1, PAL.line], [10, 31, 9, 1, PAL.line], [10, 34, 6, 1, PAL.line], [14, 8, 4, 1, '#e0405a'], [4, 8, 2, 2, '#c9ced8'], [26, 8, 2, 2, '#c9ced8'], [26, 10, 2, 28, SH],
      ]);
    } },
    whiteboard: { w: 2, h: 1, wall: true, draw: (g, s) => {
      const content = s.meeting
        ? [[16, 28, 6, 8, '#5aa7ff'], [26, 22, 6, 14, '#7cc47f'], [36, 16, 6, 20, '#e0405a'], [14, 36, 32, 1, PAL.line], [48, 14, 8, 1, PAL.line], [48, 18, 6, 1, PAL.line], [48, 22, 9, 1, PAL.line]]
        : [[14, 18, 20, 1, '#5aa7ff'], [14, 24, 28, 1, PAL.line], [14, 30, 16, 1, '#e0405a'], [46, 16, 8, 8, '#ffe066'], [47, 17, 6, 1, '#d9b84a']];
      g([[2, 4, 28, 18, '#ffffff']], [[2, 21, 28, 1, '#c9ced8']], [...content, [6, 10, 6, 1, HL2], [56, 10, 2, 32, SH], [8, 40, 6, 2, '#e0405a'], [16, 40, 6, 2, '#5aa7ff']]);
    } },
    vending: { w: 1, h: 1, stations: side('coffee', 1), draw: (g, s) => {
      const cans = [];
      const colors = ['#5aa7ff', '#7cc47f', '#ffd65a', '#c27bff', '#ff8fb1', '#ff9a3c'];
      for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) cans.push([8 + i * 4, -26 + row * 8, 3, 5, colors[(row * 3 + i) % colors.length]], [8 + i * 4, -26 + row * 8, 1, 5, HL]);
      g([[1, -18, 14, 32, '#d9534f']], [[3, -15, 7, 20, '#2b2f3a'], [11, -12, 2, 4, '#ffd65a'], [3, 8, 8, 3, '#2b2f3a'], [11, -15, 2, 1, s.frame % 2 ? '#7cff8c' : '#2b2f3a']], [
        ...cans, [6, -28, 14, 1, HL], [4, -34, 24, 1, '#f07a6f'], [27, -34, 2, 62, SH], [22, -20, 4, 1, '#2b2f3a'], [22, -12, 4, 6, '#2b2f3a'], [23, -11, 2, 4, '#5a6070'], [7, 18, 14, 1, '#5a6070'],
      ]);
    } },
    catbed: { w: 1, h: 1, draw: (g, s) => {
      g([[1, 4, 14, 10, '#8a6fb5']], [[3, 6, 10, 6, '#b49ad8']], [[2, 8, 28, 1, '#a48ad0'], [4, 26, 24, 1, SH2]], [[3, 7, 26, 2, '#8a6fb5']]);
      g([[4, 3, 8, 6, '#f0a35e']], [[5, 3, 2, 1, '#c97c3a'], [9, 3, 2, 1, '#c97c3a']], [
        [14, 6, 1, 4, '#c97c3a'], [18, 6, 1, 4, '#c97c3a'], [19, 11, 3, 1, PAL.line], [10, 11, 3, 1, PAL.line], [22, 13, 2, 1, '#e07a7a'], [8, 14, 16, 1, '#fbe3c4'],
        ...(s.frame % 4 === 0 ? [[22, 0, 2, 1, '#dfe6ff'], [25, -3, 3, 1, '#dfe6ff'], [26, -4, 1, 1, '#dfe6ff']] : []),
      ], [[9, 4, 3, 2, '#f0a35e'], [19, 4, 3, 2, '#f0a35e']]);
    } },
    arcade: { w: 1, h: 1, stations: side('game', 1), draw: (g, s) => {
      const screen = s.active ? ['#ff5f87', '#5ef0ff', '#ffe066'][s.frame % 3] : '#1b1530';
      g([[1, -18, 14, 32, '#3d2f7a']], [[3, -15, 10, 9, screen], [4, -3, 2, 2, '#e0405a'], [9, -3, 2, 2, '#5aa7ff'], [1, -18, 14, 2, '#ffe066']], [
        ...(s.active ? [[10, -26, 4, 4, '#1b1530'], [18, -22, 4, 2, '#1b1530'], [12, -18, 8, 1, '#1b1530']] : [[8, -28, 3, 1, HL], [7, -27, 1, 2, HL]]),
        [4, -32, 6, 1, '#e0405a'], [12, -32, 6, 1, '#5aa7ff'], [20, -32, 6, 1, '#7cc47f'], [4, -10, 24, 2, '#2a1f5a'], [9, -9, 1, 3, '#c9ced8'], [8, -10, 3, 2, '#e0405a'],
        [6, 4, 20, 10, '#2a1f5a'], [12, 6, 8, 2, '#ffe066'], [27, -32, 2, 60, SH], [2, -32, 1, 60, HL],
      ]);
    } },
    piano: { w: 2, h: 1, stations: side('music', 2), draw: (g, s) => {
      const keys = [];
      for (let i = 0; i < 14; i++) keys.push([5 + i * 4, -4, 3, 10, s.active && (s.frame + i) % 7 === 0 ? '#ffe066' : '#ffffff']);
      const black = [];
      for (let i = 0; i < 13; i++) if (i % 7 !== 2 && i % 7 !== 6) black.push([7 + i * 4, -4, 2, 6, '#1b1b22']);
      g([[1, -14, 30, 26, '#2b2b33']], [[2, -12, 28, 8, '#3a3a44']], [
        ...keys, ...black, [4, -6, 56, 2, '#1b1b22'], [6, 16, 4, 8, '#1b1b22'], [54, 16, 4, 8, '#1b1b22'], [24, -20, 16, 6, PAL.page], [26, -18, 3, 1, PAL.line], [31, -17, 3, 1, PAL.line], [35, -18, 3, 1, PAL.line],
        [4, -26, 56, 1, HL], [60, -26, 2, 50, SH], [24, 18, 16, 2, PAL.gold],
      ]);
    } },
    aquarium: { w: 2, h: 1, draw: (g, s) => {
      const fx = (s.now / 100) % 44;
      const bubbles = [];
      for (let i = 0; i < 4; i++) bubbles.push([14 + i * 10, -6 - ((Math.floor(s.now / 120) + i * 5) % 18), 1, 1, '#d8f0ff']);
      g([[1, -14, 30, 18, '#5aa7ff'], [3, 4, 26, 10, '#3a3f4c']], [[2, -13, 28, 2, '#9fd4ff']], [
        [4, 2, 56, 4, '#e8d8a8'], [10, 2, 3, 2, '#c9b080'], [40, 3, 4, 2, '#c9b080'], [12, -10, 1, 12, '#4f9a4f'], [13, -6, 1, 6, '#6cc06c'], [44, -12, 1, 14, '#4f9a4f'], [45, -8, 1, 8, '#6cc06c'],
        [6 + fx, -16, 6, 3, '#ff9a3c'], [5 + fx, -15, 1, 1, '#ff9a3c'], [11 + fx, -15, 1, 1, PAL.line], [48 - fx, -6, 5, 3, '#ffe066'], [53 - fx, -5, 2, 1, '#ffe066'], [48 - fx, -5, 1, 1, PAL.line],
        ...bubbles, [4, -24, 2, 20, HL], [8, 10, 48, 1, '#4a5060'], [26, 16, 12, 4, '#2b2f3a'], [27, 17, 2, 1, '*#7cff8c'],
      ]);
    } },
    trophy: { w: 1, h: 1, draw: (g) => {
      g([[1, -18, 14, 32, PAL.wood]], [[3, -16, 10, 26, '#5e3d22'], [3, -2, 10, 1, PAL.woodDark]], [
        [11, -28, 10, 6, PAL.gold], [12, -27, 2, 3, PAL.shine], [9, -27, 2, 3, PAL.gold], [21, -27, 2, 3, PAL.gold], [15, -22, 2, 3, PAL.gold], [12, -19, 8, 2, PAL.gold],
        [7, -10, 6, 6, '#c0c6d0'], [8, -9, 2, 2, PAL.shine], [18, -10, 6, 6, '#cd7f32'], [19, -9, 2, 2, '#e8a060'], [8, -4, 4, 2, '#5a6070'], [19, -4, 4, 2, '#5a6070'],
        [7, 4, 18, 14, '#4a2e18'], [9, 6, 6, 4, '#ffffff'], [9, 6, 6, 1, '#e0405a'], [17, 8, 6, 8, '#ffd65a'], [2, -34, 1, 60, HL], [28, -34, 2, 60, SH],
      ]);
    } },
    fireplace: { w: 2, h: 1, draw: (g, s) => {
      const f = s.frame % 2;
      const bricks = [];
      for (let row = 0; row < 7; row++) for (let i = 0; i < 4; i++) bricks.push([((row % 2) * 8 + i * 16) % 64, -34 + row * 6, 1, 5, '#737983']);
      g([[0, -20, 32, 34, '#8d939c']], [[0, -20, 32, 3, '#737983'], [6, -8, 20, 18, '#2b2f3a']], [
        ...bricks, ...[0, 1, 2, 3, 4, 5, 6].map((row) => [0, -35 + row * 6, 64, 1, '#7d838c']), [12, -16, 40, 36, '#2b2f3a'],
        [18, 4 - f * 2, 8, 12 + f * 2, '*#ff9a3c'], [28, 0 + f * 2, 10, 16 - f * 2, '*#ffd65a'], [40, 6 - f * 2, 6, 10 + f * 2, '*#ff5f3c'], [30, 6 + f, 4, 6, '#fff3b0'],
        [16, 16, 32, 4, '#6b4423'], [20, 14, 24, 2, '#8a5a30'], [-1, -42, 66, 3, '#6b4423'], [-1, -42, 66, 1, '#8a5a30'], [6, -46, 4, 4, '#ffd65a'], [50, -48, 6, 6, '#7cc47f'],
      ]);
    } },
    neon: { w: 2, h: 1, wall: true, draw: (g, s) => {
      const on = s.frame % 6 !== 0;
      const c = on ? '*#ff5fc8' : '#7a3a66';
      const strokes = [[4, 8, 1, 7], [4, 8, 3, 1], [4, 14, 3, 1], [7, 9, 1, 5], [10, 8, 1, 7], [10, 8, 4, 1], [10, 11, 3, 1], [10, 14, 4, 1],
        [16, 8, 4, 1], [16, 8, 1, 4], [16, 11, 4, 1], [19, 11, 1, 4], [16, 14, 4, 1], [22, 8, 1, 7], [23, 11, 2, 1], [25, 8, 1, 3], [25, 12, 1, 3]];
      g([], [], [[4, 12, 56, 22, 'rgba(20,10,30,0.35)'], ...strokes.map(([x, y, w, h]) => [x * 2, y * 2, Math.max(1, w * 2 - 1), Math.max(1, h * 2 - 1), c]), [6, 10, 1, 1, '#c9ced8'], [56, 10, 1, 1, '#c9ced8']]);
    } },
  };

  // ---- Cyberpunk theme ----------------------------------------------------------
  // Furniture is drawn in its cozy colours and recoloured here; '*' marks neon that glows.
  const CYBER = {
    '#1d1b26': '#06070e', '#b88452': '#2a3046', '#9c6b3c': '#252b40', '#7a522c': '#161a29', '#5e3d22': '#0f1220',
    '#c98b5a': '#262c42', '#e0a878': '#3a4260', '#a86f45': '#1c2133', '#c9ced8': '*#2bd9ff', '#2a2f3a': '#0e1120',
    '#16324a': '#062438', '#1b2030': '#0a0d18', '#7cc47f': '*#3dffb0', '#7ad1ff': '*#36f9ff', '#ffd65a': '*#ffd23f',
    '#2b2f3a': '#0c0f1c', '#3d4352': '#171c2e', '#4a5060': '#2a3150', '#7cff8c': '*#3dffb0', '#ffb347': '*#ff3ea5',
    '#d9534f': '#ff3ea5', '#5aa7ff': '#2a7ab0', '#c27bff': '#9b5cff', '#f0a35e': '#ff8a3d', '#4a90d9': '*#36f9ff',
    '#ffffff': '#d8e4ff', '#e8b13a': '*#ffd23f', '#5a7bd6': '#7a2a8c', '#4a68bd': '#5c1f6b', '#6a8ae0': '#94349f',
    '#8aa6f0': '*#ff6ad5', '#444a56': '#1c2236', '#2f343e': '#121626', '#ff5f5f': '*#ff3e5f', '#4f9a4f': '#0f6b5c',
    '#6cc06c': '*#3dffb0', '#3f7f3f': '#0a4a40', '#c46a3c': '#2a3150', '#d98a5a': '*#ff3ea5', '#fbf6e6': '#d8e4ff',
    '#c25b56': '#1b1433', '#d9776f': '#2c1a4d', '#ffd08a': '*#ff3ea5', '#3a3f4c': '#1a1f30', '#ffe9a8': '*#ff6ad5',
    '#e6d8b8': '#5c3a66', '#fff6d0': '*#ffb8f0', '#e0405a': '*#ff3e5f', '#3d2f7a': '#2a1850', '#8d939c': '#2a3046',
    '#737983': '#1c2133', '#ff9a3c': '*#ff9a3c', '#ff5fc8': '*#ff5fc8', '#ffe066': '*#ffe066', '#8a6fb5': '#3b1f5c',
    '#b49ad8': '#5c2f8a',
    // detail colours introduced by the fine-grid redraw
    '#d09a64': '#3a4260', '#8a5e34': '#1c2133', '#a0703f': '#2a3150', '#e6e9f0': '#9aa8d0', '#23272f': '#080a14',
    '#4c5366': '#252c46', '#22262f': '#080a14', '#f0c090': '#4a5478', '#d9a070': '#2a3046', '#3e5aa8': '#3a1048',
    '#7a98e8': '*#ff6ad5', '#5574c8': '#4a1858', '#3a2a20': '#06070e', '#6b4423': '#1c2236', '#8a5a30': '#2a3150',
    '#3a2010': '#06070e', '#5a6070': '#2a3150', '#8ad88a': '*#3dffb0', '#a85a30': '#1c2133', '#5a3a20': '#0a0d18',
    '#e8d8a8': '#1c2a4a', '#c9b080': '#14203a', '#9fd4ff': '#3a6aa0', '#d9b07a': '#2a3046', '#e0905a': '#3a1f5c',
    '#a48ad0': '#4a2878', '#2a1f5a': '#1a0f38', '#1b1b22': '#06070e', '#3a3a44': '#1a1f30', '#2b2b33': '#0e1120',
    '#4a2e18': '#0f1220', '#e8a060': '#ff8a3d', '#7d838c': '#252b40', '#f07a6f': '*#ff6ad5', '#d9b84a': '#a08a20',
  };
  const cyberRemap = (c) => CYBER[c] || c;

  // Extra neon trims drawn on top of the recoloured furniture (fine pixels).
  const CYBER_TRIM = {
    desk: (g, st) => g([], [], [[18, 2, 28, 4, '#0c1426'], ...Array.from({ length: 12 }, (_, i) => [19 + i * 2, 3 + (i % 2) * 2, 1, 1, (i + st.frame) % 5 ? '#2bd9ff' : '*#2bd9ff']), [0, 11, 64, 1, '*#36f9ff'], [4, 21, 18, 1, '*#ff3ea5'], [42, 21, 18, 1, '*#ff3ea5']]),
    server: (g) => g([], [], [[2, -34, 28, 1, '*#36f9ff'], [2, 29, 28, 1, '*#ff3ea5'], [3, -32, 1, 60, '*rgba(54,249,255,0.5)']]),
    bookshelf: (g) => g([], [], [[0, -40, 64, 1, '*#ff3ea5'], [4, -20, 56, 1, '*rgba(54,249,255,0.6)'], [4, 2, 56, 1, '*rgba(54,249,255,0.6)'], [4, 24, 56, 1, '*rgba(54,249,255,0.6)']]),
    table: (g, s) => {
      g([], [], [[0, 44, 96, 1, '*#ff3ea5'], [0, 4, 96, 1, '*rgba(54,249,255,0.5)']]);
      if (s.meeting) {
        const f = s.frame % 2;
        g([], [], [[34, -18 + f, 28, 18, '*rgba(54,249,255,0.22)'], [38, -14 + f, 4, 10, '*#36f9ff'], [44, -10 + f, 4, 6, '*#3dffb0'], [50, -16 + f, 4, 12, '*#ff3ea5'],
          [36, -2, 24, 1, '*rgba(54,249,255,0.5)'], [46, 2, 4, 8, 'rgba(54,249,255,0.15)']]);
      }
    },
    bell: (g) => g([], [], [[0, -8, 64, 1, '*#ff3ea5'], [21, 0, 1, 30, '*rgba(54,249,255,0.5)'], [42, 0, 1, 30, '*rgba(54,249,255,0.5)']]),
    sofa: (g) => g([], [], [[2, 28, 60, 1, '*#ff6ad5'], [2, -20, 60, 1, '*rgba(255,106,213,0.6)']]),
    coffee: (g) => g([], [], [[4, -24, 1, 50, '*#ff3e5f'], [9, -17, 10, 6, '#062438'], [10, -16, 6, 1, '*#36f9ff'], [10, -14, 3, 1, '*#36f9ff']]),
    whiteboard: (g, s) => g([], [], [[6, 10, 52, 32, '#0a1426'], [6, 10, 52, 1, '*rgba(54,249,255,0.6)'], ...(s.meeting
      ? [[16, 28, 6, 8, '*#36f9ff'], [26, 22, 6, 14, '*#3dffb0'], [36, 16, 6, 20, '*#ff3ea5'], [14, 36, 32, 1, '#2a3a5a'], [48, 14, 8, 1, '*#36f9ff'], [48, 18, 6, 1, '#2a3a5a']]
      : [[12, 16, 24, 1, '*#36f9ff'], [12, 22, 32, 1, '#2a3a5a'], [12, 28, 18, 1, '*#ff3ea5'], [12, 34, 10, 1, '#2a3a5a'], [46, 16, 6, 6, '*rgba(255,210,63,0.6)']])]),
    plant: (g) => g([], [], [[8, 26, 16, 1, '*#ff3ea5'], [8, 8, 16, 1, '*rgba(255,62,165,0.5)']]),
    clock: (g, s) => {
      const d = new Date(s.now);
      const digits = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      // 3x5 seven-segment-ish digits on a dark panel, colon blinking each second.
      const SEG = { 0: '1111110', 1: '0110000', 2: '1101101', 3: '1111001', 4: '0110011', 5: '1011011', 6: '1011111', 7: '1110000', 8: '1111111', 9: '1111011' };
      const seg = (x, y, n, color) => {
        const on = SEG[n];
        const r = [];
        if (on[0] === '1') r.push([x, y, 3, 1, color]);
        if (on[1] === '1') r.push([x + 2, y, 1, 3, color]);
        if (on[2] === '1') r.push([x + 2, y + 2, 1, 3, color]);
        if (on[3] === '1') r.push([x, y + 4, 3, 1, color]);
        if (on[4] === '1') r.push([x, y + 2, 1, 3, color]);
        if (on[5] === '1') r.push([x, y, 1, 3, color]);
        if (on[6] === '1') r.push([x, y + 2, 3, 1, color]);
        return r;
      };
      const blink = d.getSeconds() % 2 ? '*#36f9ff' : '#0b2a3a';
      g([], [], [
        [2, 16, 28, 11, '#0a0e1c'], [2, 16, 28, 1, '#1e2745'],
        ...seg(4, 19, digits[0], '*#36f9ff'), ...seg(9, 19, digits[1], '*#36f9ff'), [14, 20, 1, 1, blink], [14, 22, 1, 1, blink],
        ...seg(17, 19, digits[2], '*#ff3ea5'), ...seg(22, 19, digits[3], '*#ff3ea5'),
      ], [[1, 15, 30, 13, '#1a1f30']]);
    },
  };

  // Night city through the window, with drifting rain.
  function cyberWindow(g, s) {
    const rain = [];
    for (let i = 0; i < 10; i++) {
      const x = 10 + ((i * 7 + Math.floor(s.now / 90)) % 44);
      const y = 12 + ((i * 5 + Math.floor(s.now / 50)) % 32);
      rain.push([x, y, 1, 3, 'rgba(120,150,230,0.55)']);
    }
    const towers = [[12, 22, 10, 26], [24, 16, 8, 32], [34, 26, 9, 22], [44, 20, 10, 28]];
    const lit = [];
    towers.forEach(([tx, ty, tw, th], k) => {
      for (let wy = ty + 3; wy < ty + th - 2; wy += 3) {
        for (let wx = tx + 2; wx < tx + tw - 1; wx += 3) {
          const seed = (wx * 13 + wy * 7 + k * 31 + Math.floor(s.now / 5000)) % 7;
          if (seed < 2) lit.push([wx, wy, 1, 1, seed ? '*#ffd23f' : '*#36f9ff']);
        }
      }
    });
    g([[3, 4, 26, 22, '#1a1f30']], [], [
      [10, 12, 44, 36, '#0a0e24'], [10, 12, 44, 8, '#1a1440'], [10, 20, 44, 4, '#140f34'],
      [44, 14, 4, 4, '#3a2a60'], [45, 15, 2, 2, '#5a4a8a'],
      ...towers.map(([x, y, w, h], k) => [x, y, w, h, k % 2 ? '#10162c' : '#141a33']),
      [25, 13, 1, 3, '#10162c'], [26, 13, 1, 1, s.frame % 4 ? '*#ff3e5f' : '#3a1020'],
      ...lit, [35, 30, 6, 2, s.frame % 6 ? '*#ff3ea5' : '#5c1f6b'], [13, 26, 4, 1, '*#36f9ff'],
      [10, 44, 44, 4, '#0d1124'], [10, 44, 44, 1, '*rgba(255,62,165,0.5)'],
      ...rain, [30, 12, 4, 36, '#1a1f30'], [10, 28, 44, 2, '#1a1f30'], [31, 12, 1, 36, '#2a3150'], [10, 28, 44, 1, '#2a3150'],
      [2, 52, 60, 3, '#252b40'], [2, 52, 60, 1, '*rgba(54,249,255,0.6)'],
    ]);
  }

  // Objects the cyber theme redraws from scratch instead of recolouring.
  const CYBER_DRAW = { window: cyberWindow, clock: CYBER_TRIM.clock };

  // ---- Rooms -----------------------------------------------------------------

  // A long office docked above the taskbar: 3 wall rows + floor rows, as wide as the screen.
  // Furniture is laid out in repeating zones so any width gets a sensible room.
  const ZONES = [
    { w: 9, objs: [['desk', 1, 0], ['desk', 5, 0], ['plant', 8, 0]], wall: [['window', 3]] },
    { w: 7, objs: [['server', 1, 0], ['server', 3, 0], ['server', 5, 0]], wall: [['clock', 3]] },
    { w: 8, objs: [['bookshelf', 1, 0], ['bookshelf', 4, 0], ['globe', 7, 2]], wall: [] },
    { w: 6, objs: [['table', 1, 2]], wall: [['whiteboard', 2]] },
    { w: 8, objs: [['coffee', 0, 0], ['rug', 2, 1], ['sofa', 2, 3], ['sofa', 5, 3], ['lamp', 7, 0]], wall: [['window', 3]] },
    { w: 4, objs: [['bell', 1, 0]], wall: [] },
    { w: 9, objs: [['desk', 1, 0], ['desk', 5, 0], ['plant', 8, 0]], wall: [['window', 3]] },
    { w: 9, objs: [['desk', 1, 0], ['desk', 5, 0], ['plant', 8, 0]], wall: [['window', 3]] },
  ];

  const THEMES = {
    cyber: { name: '賽博龐克', wall: 'cyber', floor: 'cyber' },
    cozy: { name: '溫馨', wall: 'cream', floor: 'wood' },
  };

  function generateRoom(w, h = 8, theme = 'cyber') {
    const wallRows = 3;
    const t = THEMES[theme] || THEMES.cyber;
    const room = { w, h, wallRows, theme, wall: t.wall, floor: t.floor, tiles: {}, objects: [] };
    const floorRows = h - wallRows;
    let x = 0;
    let i = 0;
    while (x < w) {
      const zone = ZONES[i % ZONES.length];
      if (x + zone.w > w) break;
      for (const [type, dx, dy] of zone.objs) {
        if (dy + (OBJECTS[type].h) + (OBJECTS[type].stations?.some((s) => s.dy > 0) ? 1 : 0) > floorRows) continue;
        if (canPlace(room, type, x + dx, wallRows + dy)) room.objects.push({ type, x: x + dx, y: wallRows + dy });
      }
      for (const [type, dx] of zone.wall) {
        if (canPlace(room, type, x + dx, 1)) room.objects.push({ type, x: x + dx, y: 1 });
      }
      x += zone.w;
      i += 1;
    }
    return room;
  }

  // Resize a saved room to a new width, keeping whatever still fits.
  function fitRoom(room, w) {
    if (room.w === w) return room;
    const out = { ...room, w, objects: room.objects.filter((o) => o.x + (OBJECTS[o.type]?.w || 1) <= w) };
    out.tiles = Object.fromEntries(Object.entries(room.tiles || {}).filter(([k]) => Number(k.split(',')[0]) < w));
    return out;
  }

  const DEFAULT_ROOM = generateRoom(28, 8);

  // Fine-pixel rect painter at a device-pixel origin; edges round to whole device pixels.
  function makeRect(ctx, unit, ox, oy) {
    const f = unit / RES;
    return (x, y, w, h, color) => {
      const glow = color[0] === '*';
      if (glow) {
        color = color.slice(1);
        ctx.shadowColor = color;
        ctx.shadowBlur = unit * 2;
      }
      ctx.fillStyle = color;
      const x0 = Math.round(ox + x * f);
      const y0 = Math.round(oy + y * f);
      ctx.fillRect(x0, y0, Math.round(ox + (x + w) * f) - x0, Math.round(oy + (y + h) * f) - y0);
      if (glow) ctx.shadowBlur = 0;
    };
  }

  function drawFloorTile(ctx, unit, tx, ty, id, customTiles) {
    const ox = tx * T * unit;
    const oy = ty * T * unit;
    if (id && typeof id === 'object') {
      const tile = customTiles?.[id.file];
      if (tile?.img?.complete) {
        const cols = Math.max(1, Math.floor(tile.img.width / T));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tile.img, (id.i % cols) * T, Math.floor(id.i / cols) * T, T, T, ox, oy, T * unit, T * unit);
        return;
      }
      id = 'wood';
    }
    (FLOORS[id] || FLOORS.wood)(makeRect(ctx, unit, ox, oy), tx, ty);
  }

  function drawWall(ctx, unit, room) {
    const wall = WALLS[room.wall] || WALLS.cream;
    const W = T * RES;
    const h = room.wallRows * W;
    for (let x = 0; x < room.w; x++) {
      const r = makeRect(ctx, unit, x * T * unit, 0);
      r(0, 0, W, h, wall.base);
      wall.draw(r, x, h);
      r(0, 0, W, 3, '#00000033');
      r(0, 3, W, 1, '#00000018');
      if (wall.neon) {
        r(0, 6, W, 1, '*#36f9ff');
        r(0, h - 8, W, 8, '#0b0e1a');
        r(0, h - 7, W, 1, '#1e2745');
        r(0, h - 8, W, 1, '*#ff3ea5');
        if (x % 2 === 0) r(14, h - 4, 4, 1, '#1e2745');
      } else {
        r(0, h - 8, W, 8, PAL.woodDark);
        r(0, h - 8, W, 1, '#9a6a3c');
        r(0, h - 7, W, 1, '#8a5e34');
        r(0, h - 1, W, 1, '#5e3d22');
      }
    }
  }

  // Draws one object; returns nothing. `state` carries { frame, active, now, hour, meeting }.
  function drawObject(ctx, unit, obj, state) {
    const def = OBJECTS[obj.type];
    if (!def) return;
    const cyber = state.theme === 'cyber';
    const ox = obj.x * T * unit;
    const oy = obj.y * T * unit;
    const groups = [];
    const g = Sprites.grouper(groups);
    if (cyber && CYBER_DRAW[obj.type]) CYBER_DRAW[obj.type](g, state);
    else {
      def.draw(g, state);
      if (cyber) CYBER_TRIM[obj.type]?.(g, state);
    }
    ctx.save();
    ctx.translate(ox, oy);
    Sprites.paint(ctx, unit, groups, 1, def.w * T, cyber ? cyberRemap : null);
    ctx.restore();
  }

  function footprint(obj) {
    const def = OBJECTS[obj.type];
    return def ? { x: obj.x, y: obj.y, w: def.w, h: def.h } : null;
  }

  // Grid of walkable floor tiles.
  function walkGrid(room) {
    const grid = [];
    for (let y = 0; y < room.h; y++) grid.push(Array.from({ length: room.w }, () => y >= room.wallRows));
    for (const obj of room.objects) {
      const def = OBJECTS[obj.type];
      if (!def || def.wall || def.flat) continue;
      for (let y = obj.y; y < obj.y + def.h; y++) for (let x = obj.x; x < obj.x + def.w; x++) if (grid[y]?.[x] !== undefined) grid[y][x] = false;
    }
    return grid;
  }

  function stationSpots(room) {
    const grid = walkGrid(room);
    const spots = [];
    room.objects.forEach((obj, index) => {
      for (const st of OBJECTS[obj.type]?.stations || []) {
        const x = obj.x + st.dx;
        const y = obj.y + st.dy;
        if (grid[y]?.[x]) spots.push({ type: st.type, x, y, facing: st.facing, seat: st.seat || 0, objIndex: index });
      }
    });
    return spots;
  }

  function canPlace(room, type, x, y, ignoreIndex = -1) {
    const def = OBJECTS[type];
    if (!def) return false;
    if (x < 0 || y < 0 || x + def.w > room.w || y + def.h > room.h) return false;
    if (def.wall ? y + def.h > room.wallRows : y < room.wallRows) return false;
    return room.objects.every((o, i) => {
      if (i === ignoreIndex) return true;
      const od = OBJECTS[o.type];
      if (!od || !!od.wall !== !!def.wall || !!od.flat !== !!def.flat) return true;
      return x + def.w <= o.x || o.x + od.w <= x || y + def.h <= o.y || o.y + od.h <= y;
    });
  }

  // Dev preview: the default room in both themes, then every object on its own.
  function preview(canvas) {
    const unit = 4;
    const names = Object.keys(OBJECTS);
    const roomH = 8 * T * unit;
    canvas.width = 28 * T * unit;
    canvas.height = roomH * 2 + 520;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3b4a5a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const state = { frame: 1, active: true, now: Date.now(), hour: 20, meeting: true };
    ['cozy', 'cyber'].forEach((theme, k) => {
      const room = generateRoom(28, 8, theme);
      ctx.save();
      ctx.translate(0, k * roomH);
      drawWall(ctx, unit, room);
      for (let y = room.wallRows; y < room.h; y++) for (let x = 0; x < room.w; x++) drawFloorTile(ctx, unit, x, y, theme === 'cozy' ? Object.keys(FLOORS)[(x >> 2) % 8] : room.floor);
      [...room.objects].sort((a, b) => (a.y + OBJECTS[a.type].h) - (b.y + OBJECTS[b.type].h)).forEach((o) => drawObject(ctx, unit, o, { ...state, theme }));
      ctx.restore();
    });
    let x = 0;
    let row = 0;
    names.forEach((n) => {
      const def = OBJECTS[n];
      if ((x + def.w * T) * unit > canvas.width - 40) { x = 0; row += 1; }
      ctx.save();
      ctx.translate(20 + x * unit, roomH * 2 + 110 + row * 220 - (def.wall ? 20 : 0));
      drawObject(ctx, unit, { type: n, x: 0, y: 0 }, state);
      ctx.restore();
      x += def.w * T + 8;
    });
  }

  return { T, FLOORS, WALLS, OBJECTS, THEMES, DEFAULT_ROOM, generateRoom, fitRoom, cyberRemap, drawFloorTile, drawWall, drawObject, footprint, walkGrid, stationSpots, canPlace, preview };
});
