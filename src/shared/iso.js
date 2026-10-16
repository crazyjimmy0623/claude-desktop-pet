// Isometric room: a cut-away diorama with two back walls, a loft reached by stairs, and furniture
// drawn pixel by pixel in 2:1 isometric. Loaded by renderers (<script>, exposes window.Iso) and Node.
//
// World units: a floor tile is 16x16 units, z is height in the same units. Screen (fine pixels):
//   sx = x - y,  sy = (x + y) / 2 - z
// so a tile is a 32x16 diamond. Furniture art is drawn once against the back-right wall (y = 0),
// facing +y; mirroring the sprite left-to-right swaps x and y, which puts it on the left wall.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sprites'));
  else root.Iso = factory(root.Sprites);
})(typeof self !== 'undefined' ? self : this, (Sprites) => {
  const TU = 16; // world units per tile
  const WALL_H = 76;
  const LOFT_Z = 32;
  const LOFT_D = 3; // loft depth in tiles, along the back-right wall
  const STAIR_W = 2; // stairs: the last two columns, three rows down from the loft
  const SLAB = 8;
  const N = 10;
  const { shade } = Sprites;

  // ---- Colour steps -------------------------------------------------------------
  const cache = new Map();
  function rgb(c) {
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return [128, 128, 128];
  }
  const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  // Mix toward a tint: darker steps lean violet-blue, lighter steps lean warm.
  function step(c, k) {
    const key = `${c}|${k}`;
    if (cache.has(key)) return cache.get(key);
    const [r, g, b] = rgb(c);
    const out = k < 0
      ? hex(r * (1 + k) + 30 * -k * 0.25, g * (1 + k) + 20 * -k * 0.25, b * (1 + k) + 60 * -k * 0.25)
      : hex(r + (255 - r) * k + 10 * k, g + (255 - g) * k, b + (255 - b) * k * 0.7);
    cache.set(key, out);
    return out;
  }
  const lt = (c, k = 0.18) => step(c, k);
  const dk = (c, k = 0.22) => step(c, -k);

  // ---- Pixel canvas ---------------------------------------------------------------
  // A sprite is painted into a grid of colour strings, then edge-shaded and turned into a canvas.
  class Pix {
    constructor(w, h, ox, oy) {
      this.w = w;
      this.h = h;
      this.ox = ox;
      this.oy = oy;
      this.px = new Array(w * h).fill(null);
      this.glows = [];
    }

    p(x, y, z) {
      return [x - y + this.ox, (x + y) / 2 - z + this.oy];
    }

    set(x, y, c) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.px[y * this.w + x] = c;
    }

    // Fill a convex polygon (screen points) by pixel centres.
    poly(pts, c) {
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        const cy = y + 0.5;
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[(i + 1) % pts.length];
          if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          for (let x = Math.ceil(xs[i] - 0.5); x < Math.ceil(xs[i + 1] - 0.5); x++) this.set(x, y, c);
        }
      }
    }

    // Rectangles on the three visible planes, in world units.
    left(x, z, w, h, c, y) { // plane y = const, facing the viewer's lower left
      this.poly([this.p(x, y, z), this.p(x + w, y, z), this.p(x + w, y, z + h), this.p(x, y, z + h)], c);
    }

    right(y, z, d, h, c, x) { // plane x = const, facing lower right; u runs toward the viewer's right (-y)
      this.poly([this.p(x, y, z), this.p(x, y - d, z), this.p(x, y - d, z + h), this.p(x, y, z + h)], c);
    }

    top(x, y, w, d, c, z) {
      this.poly([this.p(x, y, z), this.p(x + w, y, z), this.p(x + w, y + d, z), this.p(x, y + d, z)], c);
    }

    // A box with lit top, mid left face and dark right face; `c` is one colour or {t, l, r}.
    box(x, y, z, w, d, h, c, rim = true) {
      const col = typeof c === 'string' ? { t: lt(c, 0.12), l: c, r: dk(c, 0.25) } : c;
      this.right(y + d, z, d, h, col.r, x + w);
      this.left(x, z, w, h, col.l, y + d);
      this.top(x, y, w, d, col.t, z + h);
      if (rim) {
        this.left(x, z + h - 1, w, 1, lt(col.l, 0.16), y + d);
        this.right(y + d, z + h - 1, d, 1, lt(col.r, 0.1), x + w);
      }
    }

    disc(x, y, z, r, c) {
      const [cx, cy] = this.p(x, y, z);
      for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
        for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) {
          if ((px + 0.5 - cx) ** 2 + (py + 0.5 - cy) ** 2 <= r * r) this.set(px, py, c);
        }
      }
    }

    dot(x, y, z, c, w = 1, h = 1) {
      const [sx, sy] = this.p(x, y, z);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(sx + i, sy + j, c);
    }

    glow(x, y, z, r, c) {
      const [sx, sy] = this.p(x, y, z);
      this.glows.push({ x: sx, y: sy, r, c });
    }

    // Outer pixels take a deeper shade of their own colour: no black outlines.
    edge() {
      const { w, h, px } = this;
      const out = px.slice();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const c = px[y * w + x];
          if (!c) continue;
          const empty = (dx, dy) => {
            const nx = x + dx;
            const ny = y + dy;
            return nx < 0 || ny < 0 || nx >= w || ny >= h || !px[ny * w + nx];
          };
          if (empty(-1, 0) || empty(1, 0) || empty(0, -1) || empty(0, 1)) out[y * w + x] = shade(c);
        }
      }
      this.px = out;
    }

    canvas(flip = false) {
      const c = makeCanvas(this.w, this.h);
      const g = c.getContext('2d');
      const img = g.createImageData(this.w, this.h);
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const col = this.px[y * this.w + (flip ? this.w - 1 - x : x)];
          if (!col) continue;
          const [r, gg, b] = rgb(col);
          const i = (y * this.w + x) * 4;
          img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return c;
    }
  }
  const makeCanvas = (w, h) => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  // ---- Palettes ---------------------------------------------------------------------
  const WOOD = '#9a6640';
  const WOOD_D = '#6e4428';
  const METAL = '#4a4f5e';
  const SCREEN = '#7ad1ff';

  const FLOORS = {
    wood: { base: '#8a5a38', draw: (P, x, y, z) => { // planks run along x
      const c = (x + y) % 2 ? '#8a5a38' : '#94613c';
      P.top(x * TU, y * TU, TU, TU, c, z);
      P.top(x * TU, y * TU + 7, TU, 1, '#6e4428', z);
      P.top(x * TU, y * TU + 15, TU, 1, '#6e4428', z);
      P.top(x * TU + ((y * 7) % 12) + 2, y * TU, 1, 7, '#74492c', z);
      P.top(x * TU + ((y * 5 + 6) % 12) + 2, y * TU + 8, 1, 7, '#74492c', z);
    } },
    tile: { base: '#d9d2c4', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, (x + y) % 2 ? '#d9d2c4' : '#c9c1b2', z);
      P.top(x * TU, y * TU, TU, 1, '#b3aa99', z);
      P.top(x * TU, y * TU, 1, TU, '#b3aa99', z);
    } },
    carpet: { base: '#5a6fa8', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, '#5a6fa8', z);
      if ((x * 3 + y * 5) % 4 === 0) P.top(x * TU + 6, y * TU + 6, 2, 2, '#6c82bd', z);
    } },
    stone: { base: '#77737a', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, (x * 7 + y * 3) % 3 ? '#77737a' : '#6c6870', z);
      P.top(x * TU, y * TU, TU, 1, '#5a565e', z);
      P.top(x * TU + (y % 2 ? 8 : 0), y * TU, 1, TU, '#5a565e', z);
    } },
    marble: { base: '#e8e4ec', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, (x + y) % 2 ? '#e8e4ec' : '#dcd6e2', z);
      P.top(x * TU + 3, y * TU + ((x * 5) % 10) + 2, 9, 1, '#cfc8d8', z);
    } },
    cyber: { base: '#262b40', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, '#262b40', z);
      P.top(x * TU, y * TU, TU, 1, '#1a1e30', z);
      P.top(x * TU, y * TU, 1, TU, '#1a1e30', z);
      if ((x + y * 3) % 5 === 0) P.top(x * TU + 7, y * TU + 7, 2, 2, '#36f9ff', z);
    } },
    neon: { base: '#2a1f3d', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, (x + y) % 2 ? '#2a1f3d' : '#33264a', z);
      P.top(x * TU, y * TU, TU, 1, '#ff3ea5', z);
    } },
    grass: { base: '#5f9a4e', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, (x * 3 + y) % 4 ? '#5f9a4e' : '#6aa857', z);
      P.top(x * TU + ((x * 7 + y) % 12) + 2, y * TU + ((y * 5) % 12) + 2, 1, 2, '#83c06c', z);
    } },
  };

  // Walls: base colour plus a pattern painter on the inner face (u along the wall, v up).
  const WALLS = {
    plum: { base: '#7a3442', trim: '#4e1f2b', paint: (F, len) => {
      for (let u = 6; u < len; u += 10) F(u, 20, 1, WALL_H - 26, '#70303d');
      F(0, 18, len, 2, '#5e2633');
    } },
    cream: { base: '#e8d9bd', trim: '#a5825a', paint: (F, len) => {
      for (let u = 4; u < len; u += 8) F(u, 20, 1, WALL_H - 24, '#e0cfb0');
      F(0, 18, len, 2, '#c9b08a');
    } },
    brick: { base: '#a14b38', trim: '#5c2a1f', paint: (F, len) => {
      for (let v = 8, row = 0; v < WALL_H - 4; v += 6, row++) {
        F(0, v, len, 1, '#7d3628');
        for (let u = row % 2 ? 4 : 0; u < len; u += 9) F(u, v + 1, 1, 5, '#7d3628');
      }
    } },
    navy: { base: '#2f3e66', trim: '#1b2440', paint: (F, len) => {
      for (let u = 8; u < len; u += 16) F(u, 10, 1, WALL_H - 14, '#36477a');
    } },
    mint: { base: '#a8e0cf', trim: '#5f9c8c', paint: (F, len) => {
      for (let u = 0; u < len; u += 12) F(u, 24, 6, WALL_H - 28, '#9dd6c4');
      F(0, 22, len, 2, '#7fbcaa');
    } },
    cyber: { base: '#161b30', trim: '#0b0e1a', paint: (F, len) => {
      for (let u = 0; u < len; u += 16) { F(u, 8, 1, WALL_H - 10, '#22294a'); F(u + 6, 30, 4, 1, '#22294a'); }
      F(0, WALL_H - 10, len, 1, '*#36f9ff');
      F(0, 12, len, 1, '*#ff3ea5');
    } },
  };

  // ---- Furniture ------------------------------------------------------------------
  // draw(P, s) paints in local world units: footprint x in [0, w*16), y in [0, d*16), facing +y.
  // stations: tiles in front (dx, dy) where a character works; sit: drawn offset once there.
  const front = (w, d) => Array.from({ length: w }, (_, i) => ({ dx: i, dy: d }));

  const OBJECTS = {
    desk: { w: 2, d: 1, h: 40, station: 'code', stations: front(2, 1), draw: (P, s) => {
      P.box(0, 2, 0, 32, 12, 12, WOOD);
      P.box(2, 4, 0, 2, 2, 10, WOOD_D);
      P.left(4, 1, 10, 8, dk(WOOD, 0.35), 14);
      P.left(6, 6, 6, 1, '#d6b36a', 14);
      P.left(20, 1, 10, 8, dk(WOOD, 0.35), 14);
      P.left(22, 6, 6, 1, '#d6b36a', 14);
      // Monitor, keyboard, mug.
      P.box(14, 4, 12, 4, 3, 4, METAL);
      P.box(8, 3, 16, 16, 3, 12, '#2a2f3a');
      P.left(9, 17, 14, 10, s.active ? '#16324a' : '#1b2030', 6);
      if (s.active) {
        const cols = ['#7cc47f', SCREEN, '#ffd65a', '#c27bff', SCREEN];
        for (let i = 0; i < 5; i++) P.left(10 + (i % 3) * 2, 25 - i * 2, 4 + ((i * 5 + s.frame) % 7), 1, cols[i], 6);
        P.glow(16, 6, 22, 14, 'rgba(122,209,255,0.35)');
      }
      P.box(8, 9, 12, 14, 4, 1, '#c9ced8', false);
      for (let i = 0; i < 6; i++) P.top(9 + i * 2, 10, 1, 1, '#8a91a3', 13);
      P.box(26, 6, 12, 3, 3, 4, '#f4f4f6');
      P.top(26, 6, 3, 3, '#7a4a2a', 16);
    } },
    server: { w: 1, d: 1, h: 46, station: 'terminal', stations: front(1, 1), draw: (P, s) => {
      P.box(1, 2, 0, 14, 12, 40, '#2b2f3a');
      for (let i = 0; i < 6; i++) {
        const z = 4 + i * 6;
        P.left(2, z, 12, 4, '#3d4352', 14);
        P.left(3, z + 1, 5, 1, '#22262f', 14);
        const on = s.active ? (s.frame + i * 2) % 5 !== 0 : i % 3 === 0;
        P.left(10, z + 2, 1, 1, on ? (i % 2 ? '#ffb347' : '#7cff8c') : '#2b2f3a', 14);
        P.left(12, z + 2, 1, 1, on && (s.frame + i) % 2 ? '#7cff8c' : '#2b2f3a', 14);
      }
      if (s.active) P.glow(8, 14, 20, 10, 'rgba(124,255,140,0.25)');
    } },
    bookshelf: { w: 2, d: 1, h: 52, station: 'read', stations: front(2, 1), draw: (P) => {
      P.box(0, 4, 0, 32, 10, 46, WOOD_D);
      P.left(2, 2, 28, 42, '#3e2717', 14);
      const colors = ['#c2453f', '#5aa7ff', '#7cc47f', '#ffd65a', '#c27bff', '#f0a35e', '#5e8fd9', '#e07a9a'];
      for (let shelf = 0; shelf < 4; shelf++) {
        const z = 3 + shelf * 11;
        P.left(2, z - 1, 28, 1, WOOD, 14);
        let u = 3;
        let n = shelf * 3;
        while (u < 28) {
          n += 1;
          const bw = 2 + (n % 2);
          const bh = 6 + ((n * 5 + shelf) % 4);
          if ((n * 7) % 11 !== 3) P.left(u, z, bw, bh, colors[(n * 3 + shelf) % colors.length], 14);
          u += bw + (n % 4 === 0 ? 2 : 0);
        }
      }
    } },
    globe: { w: 1, d: 1, h: 30, station: 'web', stations: front(1, 1), draw: (P, s) => {
      P.box(3, 4, 0, 10, 8, 12, WOOD);
      P.box(7, 7, 12, 2, 2, 4, '#c9a24a');
      P.disc(8, 8, 23, 6.5, '#3f7fc4');
      P.disc(6, 8, 25, 3, '#5fa55a');
      P.disc(11, 9, 21, 2, '#5fa55a');
      P.dot(4, 8, 27, 'rgba(255,255,255,0.6)', 2, 1);
      if (s.active) P.glow(8, 8, 23, 10, 'rgba(90,167,255,0.3)');
    } },
    table: { w: 2, d: 2, h: 20, station: 'meeting', stations: [{ dx: -1, dy: 0 }, { dx: -1, dy: 1 }, { dx: 2, dy: 0 }, { dx: 2, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }], draw: (P) => {
      for (const [x, y] of [[3, 3], [27, 3], [3, 27], [27, 27]]) P.box(x, y, 0, 2, 2, 12, WOOD_D);
      P.box(1, 1, 12, 30, 30, 3, WOOD);
      P.top(10, 12, 6, 4, '#fbf6e6', 15);
      P.top(18, 16, 5, 6, '#fbf6e6', 15);
      P.box(22, 8, 15, 3, 3, 3, '#f4f4f6');
    } },
    bell: { w: 2, d: 1, h: 26, station: 'wait', stations: front(2, 1), draw: (P, s) => {
      P.box(0, 3, 0, 32, 11, 16, '#c9a27a');
      P.left(2, 2, 28, 11, '#b08a64', 14);
      P.box(0, 2, 16, 32, 13, 2, WOOD_D);
      P.box(13, 7, 18, 6, 5, 1, '#8a6a20');
      P.disc(16, 9, 21 + (s.active && s.frame % 2 ? 1 : 0), 3, '#e8b13a');
      P.dot(15, 9, 23, '#fff3c4');
    } },
    sofa: { w: 2, d: 1, h: 24, station: 'rest', stations: front(2, 1), sit: [0, -8, 6], draw: (P) => {
      const c = '#5a6fa8';
      P.box(0, 2, 0, 32, 12, 8, dk(c, 0.15));
      P.box(0, 2, 8, 32, 5, 14, c);
      P.box(0, 2, 0, 4, 12, 16, c);
      P.box(28, 2, 0, 4, 12, 16, c);
      P.box(4, 7, 8, 12, 7, 3, lt(c, 0.08));
      P.box(16, 7, 8, 12, 7, 3, lt(c, 0.08));
      P.box(6, 4, 11, 6, 3, 6, '#e8b13a');
    } },
    bed: { w: 3, d: 2, h: 26, station: 'rest', stations: front(3, 2), sit: [0, -12, 10], draw: (P) => {
      P.box(0, 0, 0, 48, 30, 10, WOOD_D);
      P.box(0, 0, 0, 4, 30, 22, WOOD);
      P.box(2, 1, 10, 45, 28, 4, '#e9e4dc');
      P.box(14, 1, 12, 33, 28, 4, '#3d3a5c');
      P.left(14, 13, 33, 3, '#4b4870', 29);
      P.box(4, 4, 14, 9, 10, 3, '#f4f4f6');
      P.box(4, 16, 14, 9, 10, 3, '#f4f4f6');
    } },
    coffee: { w: 1, d: 1, h: 34, station: 'coffee', stations: front(1, 1), draw: (P, s) => {
      P.box(0, 2, 0, 16, 12, 14, WOOD);
      P.left(2, 2, 12, 9, dk(WOOD, 0.3), 14);
      P.box(3, 3, 14, 10, 8, 14, '#2f3340');
      P.left(5, 17, 6, 4, '#16191f', 11);
      P.box(6, 8, 15, 3, 3, 3, '#f4f4f6');
      P.left(4, 24, 2, 2, s.active ? '#ff6b5a' : '#5a2a2a', 11);
      if (s.active && s.frame % 2) P.dot(7, 9, 21, '#e6e9f0', 1, 3);
    } },
    vending: { w: 1, d: 1, h: 48, station: 'coffee', stations: front(1, 1), draw: (P, s) => {
      P.box(0, 2, 0, 16, 12, 42, '#b8323e');
      P.left(2, 12, 9, 26, '#1d2a3a', 14);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) P.left(3 + i * 3, 14 + r * 6, 2, 3, ['#ffd65a', '#7cc47f', '#5aa7ff', '#ff8fb1'][(r + i) % 4], 14);
      P.left(12, 26, 3, 6, '#2a2f3a', 14);
      P.left(2, 4, 9, 4, '#16191f', 14);
      P.glow(6, 14, 26, 14, 'rgba(122,209,255,0.3)');
      if (s.active) P.left(12, 34, 3, 2, '#7cff8c', 14);
    } },
    plant: { w: 1, d: 1, h: 34, draw: (P) => {
      P.box(4, 4, 0, 8, 8, 9, '#c0704a');
      P.top(5, 5, 6, 6, '#5a3a24', 9);
      P.disc(8, 8, 18, 5, '#3f8a4a');
      P.disc(5, 9, 22, 4, '#4f9e57');
      P.disc(11, 7, 23, 4, '#4f9e57');
      P.disc(8, 8, 27, 4, '#62b36a');
      P.dot(6, 8, 26, '#86d08c', 2, 1);
    } },
    lamp: { w: 1, d: 1, h: 46, draw: (P) => {
      P.box(5, 5, 0, 6, 6, 2, '#3a3f4c');
      P.box(7, 7, 2, 2, 2, 30, '#3a3f4c');
      P.box(3, 3, 30, 10, 10, 9, '#f1d9a8');
      P.top(4, 4, 8, 8, '#fff3d0', 39);
      P.glow(8, 8, 32, 26, 'rgba(255,200,120,0.45)');
    } },
    rug: { w: 2, d: 2, h: 1, flat: true, draw: (P) => {
      P.top(1, 1, 30, 30, '#a9483f', 0.5);
      P.top(3, 3, 26, 26, '#c25b4f', 0.5);
      P.top(7, 7, 18, 18, '#e8b13a', 0.5);
      P.top(9, 9, 14, 14, '#c25b4f', 0.5);
    } },
    easel: { w: 1, d: 1, h: 40, station: 'art', stations: front(1, 1), draw: (P, s) => {
      P.box(3, 6, 0, 2, 2, 30, WOOD);
      P.box(11, 6, 0, 2, 2, 30, WOOD);
      P.box(7, 2, 0, 2, 2, 28, WOOD_D);
      P.box(1, 5, 12, 14, 2, 18, '#fbf6e6');
      P.left(3, 22, 6, 3, '#5aa7ff', 7);
      P.left(8, 16, 5, 4, '#e07a9a', 7);
      P.left(4, 15, 3, 3, s.active && s.frame % 2 ? '#ffd65a' : '#7cc47f', 7);
    } },
    arcade: { w: 1, d: 1, h: 44, station: 'game', stations: front(1, 1), draw: (P, s) => {
      P.box(1, 2, 0, 14, 12, 38, '#5b3fa3');
      P.box(1, 8, 14, 14, 6, 4, '#3a2a70');
      P.left(3, 22, 10, 10, '#141826', 14);
      P.left(4, 23, 8, 8, s.active ? ['#ff3ea5', '#36f9ff'][s.frame % 2] : '#1d2240', 14);
      P.top(4, 10, 2, 2, '#e0405a', 18);
      P.top(9, 10, 2, 2, '#5aa7ff', 18);
      P.left(2, 34, 12, 3, '#ffd65a', 14);
      if (s.active) P.glow(8, 14, 27, 12, 'rgba(255,62,165,0.35)');
    } },
    tv: { w: 2, d: 1, h: 34, station: 'game', stations: front(2, 1), draw: (P, s) => {
      P.box(2, 4, 0, 28, 10, 10, WOOD_D);
      P.left(4, 2, 10, 6, dk(WOOD_D, 0.3), 14);
      P.left(18, 2, 10, 6, dk(WOOD_D, 0.3), 14);
      P.box(4, 6, 10, 24, 2, 18, '#1c1f28');
      P.left(5, 11, 22, 16, s.active ? ['#3f7fc4', '#7cc47f'][Math.floor(s.frame / 2) % 2] : '#141826', 8);
      if (s.active) P.glow(16, 8, 19, 16, 'rgba(90,167,255,0.35)');
    } },
    piano: { w: 2, d: 1, h: 34, station: 'music', stations: front(2, 1), draw: (P) => {
      P.box(0, 2, 0, 32, 10, 28, '#2a2530');
      P.box(0, 8, 12, 32, 6, 3, '#2a2530');
      P.top(1, 9, 30, 4, '#f4f4f6', 15);
      for (let i = 0; i < 10; i++) if (i % 7 !== 2 && i % 7 !== 6) P.top(3 + i * 3, 9, 1, 2, '#1c1a20', 15.2);
      P.left(8, 18, 16, 6, '#fbf6e6', 8);
    } },
    aquarium: { w: 2, d: 1, h: 38, draw: (P, s) => {
      P.box(0, 3, 0, 32, 10, 14, WOOD_D);
      P.box(1, 4, 14, 30, 8, 18, '#5ec4e8');
      P.top(1, 4, 30, 8, '#8fd8ef', 32);
      P.left(4, 15, 24, 2, '#e8d9a0', 12);
      P.left(6, 17, 2, 6, '#3f8a4a', 12);
      P.left(24, 17, 2, 8, '#3f8a4a', 12);
      const fx = (s.frame * 2) % 20;
      P.left(6 + fx, 24, 3, 2, '#f0a35e', 12);
      P.left(20 - fx / 2, 20, 3, 2, '#ffd65a', 12);
      P.glow(16, 8, 24, 16, 'rgba(94,196,232,0.35)');
    } },
    trophy: { w: 1, d: 1, h: 40, draw: (P) => {
      P.box(1, 3, 0, 14, 11, 34, WOOD);
      P.left(3, 4, 10, 28, '#3e2717', 14);
      P.left(5, 6, 6, 4, '#e8b13a', 14);
      P.left(6, 10, 4, 4, '#e8b13a', 14);
      P.left(4, 18, 3, 6, '#c9ced8', 14);
      P.left(9, 18, 3, 6, '#c27b4a', 14);
      P.left(5, 26, 6, 4, '#e8b13a', 14);
    } },
    fireplace: { w: 2, d: 1, h: 40, draw: (P, s) => {
      P.box(0, 2, 0, 32, 12, 32, '#8a4a3a');
      P.box(-1, 1, 32, 34, 14, 3, '#5c3328');
      P.left(8, 2, 16, 16, '#1c1414', 14);
      const f = s.frame % 3;
      P.left(10, 2, 12, 6 + f, '#e0602a', 14);
      P.left(12, 3, 8, 8 - f, '#ffb347', 14);
      P.left(14, 4, 4, 4 + f, '#fff0a0', 14);
      for (let v = 22; v < 31; v += 4) P.left(0, v, 32, 1, '#6e3a2c', 14);
      P.glow(16, 14, 8, 22, 'rgba(255,140,60,0.45)');
    } },
    catbed: { w: 1, d: 1, h: 14, draw: (P, s) => {
      P.box(2, 3, 0, 12, 11, 5, '#c25b4f');
      P.top(4, 5, 8, 7, '#e8c9a0', 5);
      P.disc(8, 8, 8, 3.5, '#f0a35e');
      P.disc(10, 9, 10, 2, '#f0a35e');
      if (s.frame % 4 === 0) P.dot(12, 6, 14, '#ffffff', 1, 1);
    } },
    boxes: { w: 1, d: 1, h: 24, draw: (P) => {
      P.box(1, 3, 0, 12, 10, 10, '#b98a56');
      P.top(6, 3, 2, 10, '#d6b07a', 10);
      P.box(3, 4, 10, 9, 8, 8, '#c99a62');
      P.top(7, 4, 1, 8, '#e0c08c', 18);
    } },
    // Wall-mounted: mount height z, drawn on the plane y = 0.
    window: { w: 2, d: 0, h: 70, wall: true, z: 22, draw: (P, s) => {
      const night = s.hour < 6 || s.hour >= 19;
      P.left(2, 22, 28, 34, '#d9c9a8', 0.5);
      P.left(4, 24, 24, 30, night ? '#1d2a4a' : '#ffe9b0', 0.5);
      P.left(4, 24, 24, 1, '#c9b48c', 0.5);
      P.left(15, 24, 2, 30, '#d9c9a8', 0.5);
      P.left(4, 38, 24, 2, '#d9c9a8', 0.5);
      if (night) { P.left(8, 46, 1, 1, '#ffffff', 0.5); P.left(22, 50, 1, 1, '#ffffff', 0.5); P.left(10, 32, 3, 3, '#f4f0d0', 0.5); }
      for (let v = 0; v < 6; v++) P.left(3, 50 + v, 26, 1, v % 2 ? '#3d3a4a' : '#4a4658', 1.5);
      P.left(0, 20, 32, 2, '#a88a62', 1.5);
      if (!night) P.glow(16, 4, 36, 30, 'rgba(255,220,150,0.35)');
    } },
    clock: { w: 1, d: 0, h: 60, wall: true, z: 40, draw: (P, s) => {
      P.left(3, 42, 10, 10, '#f4f0e6', 1);
      P.left(4, 43, 8, 8, '#ffffff', 1);
      const hr = s.hour % 12;
      P.left(8, 47, 1, 3, '#2b2233', 1);
      P.left(hr < 6 ? 8 : 6, 47, 2, 1, '#2b2233', 1);
    } },
    poster: { w: 1, d: 0, h: 60, wall: true, z: 34, draw: (P) => {
      P.left(2, 34, 12, 16, '#2a2f4a', 1);
      P.left(4, 40, 8, 6, '#ff8fb1', 1);
      P.left(5, 42, 6, 3, '#ffd65a', 1);
      P.left(4, 36, 8, 1, '#c9ced8', 1);
    } },
    whiteboard: { w: 2, d: 0, h: 60, wall: true, z: 30, draw: (P, s) => {
      P.left(2, 30, 28, 20, '#c9ced8', 1);
      P.left(3, 31, 26, 18, '#ffffff', 1);
      P.left(5, 44, 12, 1, '#5aa7ff', 1);
      P.left(5, 40, 8, 1, '#7cc47f', 1);
      P.left(18, 36, 8, 8, s.meeting ? '#ff8fb1' : '#e8e8ee', 1);
      P.left(2, 29, 28, 1, '#8a91a3', 1.5);
    } },
    neon: { w: 2, d: 0, h: 60, wall: true, z: 36, draw: (P, s) => {
      const on = s.frame % 8 !== 0;
      P.left(3, 40, 26, 12, '#1a1426', 1);
      const c = on ? '*#ff3ea5' : '#5a2a44';
      P.left(5, 48, 8, 1, c, 1.5); P.left(5, 42, 1, 6, c, 1.5); P.left(12, 42, 1, 6, c, 1.5);
      P.left(16, 42, 10, 1, on ? '*#36f9ff' : '#2a4a55', 1.5); P.left(20, 42, 1, 7, on ? '*#36f9ff' : '#2a4a55', 1.5);
      if (on) P.glow(16, 2, 46, 18, 'rgba(255,62,165,0.35)');
    } },
    shelf: { w: 2, d: 0, h: 60, wall: true, z: 38, draw: (P) => {
      P.box(1, 0, 38, 30, 6, 2, WOOD, false);
      P.box(4, 1, 40, 3, 4, 7, '#5aa7ff', false);
      P.box(7, 1, 40, 3, 4, 8, '#c2453f', false);
      P.box(10, 1, 40, 2, 4, 6, '#7cc47f', false);
      P.box(18, 1, 40, 5, 4, 5, '#c0704a', false);
      P.disc(20, 3, 49, 3, '#4f9e57');
      P.box(26, 2, 40, 3, 3, 4, '#e8b13a', false);
    } },
  };

  // ---- Room model -----------------------------------------------------------------

  const THEMES = {
    cozy: { name: '溫馨小屋', wall: 'plum', floor: 'wood' },
    cream: { name: '午後咖啡', wall: 'cream', floor: 'tile' },
    cyber: { name: '賽博龐克', wall: 'cyber', floor: 'cyber' },
  };

  // Height of the walkable surface on a tile, or null if solid.
  function heightAt(room, x, y) {
    const n = room.n;
    if (x < 0 || y < 0 || x >= n || y >= n) return null;
    if (y < LOFT_D) return LOFT_Z;
    if (x >= n - STAIR_W && y < LOFT_D + 3) return LOFT_Z - (y - LOFT_D + 1) * 8;
    return 0;
  }
  const isStair = (room, x, y) => x >= room.n - STAIR_W && y >= LOFT_D && y < LOFT_D + 3;
  // Continuous standing height for a character at tile coordinates (x, y), smooth on the stairs.
  function standZ(room, x, y) {
    const tx = Math.round(x);
    if (tx >= room.n - STAIR_W && y > LOFT_D - 1 && y < LOFT_D + 3) return Math.max(0, Math.min(LOFT_Z, LOFT_Z - (y - LOFT_D + 1) * 8));
    return heightAt(room, tx, Math.round(y)) ?? 0;
  }

  // Footprint in room tiles, after flipping onto the left wall.
  function footprint(o) {
    const def = OBJECTS[o.type];
    if (!def) return null;
    return o.flip ? { x: o.x, y: o.y, w: def.d, d: def.w } : { x: o.x, y: o.y, w: def.w, d: def.d };
  }

  function canPlace(room, type, x, y, flip, ignoreIndex = -1) {
    const def = OBJECTS[type];
    if (!def) return false;
    const f = footprint({ type, x, y, flip });
    if (def.wall) {
      const along = flip ? y : x;
      if (flip ? x !== 0 : y !== 0) return false;
      if (along < 0 || along + def.w > room.n) return false;
      return room.objects.every((o, i) => {
        const od = OBJECTS[o.type];
        if (i === ignoreIndex || !od?.wall || !!o.flip !== !!flip) return true;
        const oa = o.flip ? o.y : o.x;
        return along + def.w <= oa || oa + od.w <= along;
      });
    }
    let z = null;
    for (let ty = f.y; ty < f.y + f.d; ty++) {
      for (let tx = f.x; tx < f.x + f.w; tx++) {
        const h = heightAt(room, tx, ty);
        if (h === null || isStair(room, tx, ty) || (z !== null && h !== z)) return false;
        z = h;
      }
    }
    return room.objects.every((o, i) => {
      const od = OBJECTS[o.type];
      if (i === ignoreIndex || !od || od.wall || !!od.flat !== !!def.flat) return true;
      const g = footprint(o);
      return f.x + f.w <= g.x || g.x + g.w <= f.x || f.y + f.d <= g.y || g.y + g.d <= f.y;
    });
  }

  function walkGrid(room) {
    const grid = [];
    for (let y = 0; y < room.n; y++) grid.push(Array.from({ length: room.n }, (_, x) => heightAt(room, x, y) !== null));
    for (const o of room.objects) {
      const def = OBJECTS[o.type];
      if (!def || def.wall || def.flat) continue;
      const f = footprint(o);
      for (let y = f.y; y < f.y + f.d; y++) for (let x = f.x; x < f.x + f.w; x++) if (grid[y]?.[x] !== undefined) grid[y][x] = false;
    }
    return grid;
  }
  // Two neighbouring tiles connect when their surfaces are within one stair step.
  const linked = (room, ax, ay, bx, by) => {
    const a = heightAt(room, ax, ay);
    const b = heightAt(room, bx, by);
    return a !== null && b !== null && Math.abs(a - b) <= 8;
  };

  function stationSpots(room) {
    const grid = walkGrid(room);
    const spots = [];
    room.objects.forEach((o, index) => {
      const def = OBJECTS[o.type];
      if (!def?.stations) return;
      for (const st of def.stations) {
        const x = o.x + (o.flip ? st.dy : st.dx);
        const y = o.y + (o.flip ? st.dx : st.dy);
        if (!grid[y]?.[x]) continue;
        // In front of an unflipped object a character looks up-right (+1); flipped, up-left.
        let facing = o.flip ? -1 : 1;
        if (st.dx < 0) facing = o.flip ? -1 : 1;
        if (st.dx >= def.w) facing = o.flip ? 1 : -1;
        const sit = def.sit ? (o.flip ? [def.sit[1], def.sit[0], def.sit[2]] : def.sit) : null;
        spots.push({ type: def.station, x, y, facing, sit, objIndex: index });
      }
    });
    return spots;
  }

  function generateRoom(theme = 'cozy') {
    const t = THEMES[theme] || THEMES.cozy;
    const room = { iso: 1, n: N, theme, wall: t.wall, floor: t.floor, objects: [] };
    const add = (type, x, y, flip = false) => { if (canPlace(room, type, x, y, flip)) room.objects.push({ type, x, y, flip }); };
    // Loft: bed, shelf and a plant, with a window above.
    add('bed', 2, 0);
    add('bookshelf', 0, 0, true);
    add('lamp', 5, 0);
    add('plant', 7, 0);
    add('boxes', 6, 1);
    add('window', 5, 0);
    add('shelf', 2, 0);
    // Under the loft, against its front.
    add('server', 0, 3);
    add('server', 1, 3);
    add('vending', 3, 3);
    add('coffee', 4, 3);
    add('arcade', 6, 3);
    // Left wall: desks and a window.
    add('desk', 0, 5, true);
    add('desk', 0, 8, true);
    add('window', 0, 5, true);
    add('poster', 0, 8, true);
    add('clock', 0, 4, true);
    // Middle and front.
    add('rug', 3, 6);
    add('table', 3, 6);
    add('bell', 7, 8);
    add('globe', 9, 6);
    add('plant', 9, 9);
    add('catbed', 6, 9);
    return room;
  }

  // ---- Rendering --------------------------------------------------------------------

  // Room canvas in fine pixels: world (0, 0, 0) lands at ORIGIN.
  const size = (n) => ({ w: n * 2 * TU + 24, h: WALL_H + 14 + n * TU + SLAB + 10 });
  const origin = (n) => ({ x: n * TU + 12, y: WALL_H + 14 });
  const project = (n, x, y, z) => { const o = origin(n); return { x: o.x + x - y, y: o.y + (x + y) / 2 - z }; };

  // Back walls, floor slab, loft and floors: everything nothing can stand behind.
  function renderBackground(room) {
    const n = room.n;
    const S = size(n);
    const O = origin(n);
    const P = new Pix(S.w, S.h, O.x, O.y);
    const L = n * TU;
    const wall = WALLS[room.wall] || WALLS.plum;
    const floor = FLOORS[room.floor] || FLOORS.wood;
    // Left wall (plane x = 0, seen from +x) and right wall (plane y = 0, seen from +y).
    P.box(-5, -5, 0, 5, L + 5, WALL_H, { t: lt(wall.trim, 0.25), l: wall.trim, r: dk(wall.base, 0.08) }, false);
    P.box(0, -5, 0, L, 5, WALL_H, { t: lt(wall.trim, 0.25), l: wall.base, r: wall.trim }, false);
    const leftF = (u, v, w, h, c) => P.right(L - u, v, w, h, c, 0);
    const rightF = (u, v, w, h, c) => P.left(u, v, w, h, c, 0);
    wall.paint(leftF, L);
    wall.paint(rightF, L);
    leftF(0, 0, L, 6, wall.trim);
    rightF(0, 0, L, 6, wall.trim);
    // Corner shading where the walls meet.
    P.left(0, 0, 3, WALL_H, dk(wall.base, 0.12), 0);
    // Floor slab under everything, then the floor itself.
    P.box(-5, -5, -SLAB, L + 5, L + 5, SLAB, { t: floor.base, l: dk(floor.base, 0.35), r: dk(floor.base, 0.5) }, false);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (y >= LOFT_D) floor.draw(P, x, y, 0);
    // Loft: front wall with beams, floor on top.
    const LD = LOFT_D * TU;
    P.box(0, 0, 0, L, LD, LOFT_Z, { t: floor.base, l: '#6e4428', r: '#55341f' }, false);
    for (let u = 0; u < L; u += 24) P.left(u, 0, 3, LOFT_Z, '#5c3a22', LD);
    P.left(0, LOFT_Z - 4, L, 4, '#5c3a22', LD);
    for (let y = 0; y < LOFT_D; y++) for (let x = 0; x < n; x++) floor.draw(P, x, y, LOFT_Z);
    P.edge();
    return { canvas: P.canvas(), glows: P.glows };
  }

  // A sprite for one object (or a stair tile, or a railing post) with its anchor = world origin.
  function renderSprite(w, d, h, paint, flip) {
    const ox = d * TU + 2;
    const oy = h + 2;
    const P = new Pix((w + d) * TU + 4, Math.ceil((w + d) * TU / 2) + h + 6, ox, oy);
    paint(P);
    P.edge();
    const W = P.w;
    return {
      canvas: P.canvas(flip),
      ax: flip ? W - ox : ox,
      ay: oy,
      glows: P.glows.map((g) => ({ ...g, x: flip ? W - g.x : g.x })),
    };
  }

  const spriteCache = new Map();
  function objectSprite(type, flip, s) {
    const def = OBJECTS[type];
    const anim = def.wall || ['desk', 'server', 'globe', 'bell', 'coffee', 'vending', 'easel', 'arcade', 'tv', 'aquarium', 'fireplace', 'catbed'].includes(type);
    const key = `${type}|${flip ? 1 : 0}|${anim ? `${s.active ? 1 : 0}|${s.frame % 8}|${s.hour}|${s.meeting ? 1 : 0}` : ''}`;
    let sp = spriteCache.get(key);
    if (!sp) {
      sp = renderSprite(def.w, Math.max(def.d, 1), def.h, (P) => def.draw(P, s), flip);
      if (spriteCache.size > 600) spriteCache.clear();
      spriteCache.set(key, sp);
    }
    return sp;
  }

  // Stair blocks: each of the 3 rows is two half-steps.
  function stairSprite(row) {
    const key = `stair|${row}`;
    let sp = spriteCache.get(key);
    if (!sp) {
      sp = renderSprite(STAIR_W, 1, LOFT_Z, (P) => {
        for (let k = 0; k < 2; k++) {
          const h = LOFT_Z - (row * 2 + k + 1) * (LOFT_Z / 7);
          P.box(0, k * 8, 0, STAIR_W * TU, 8, Math.round(h), { t: '#b07a4c', l: '#7a4c2c', r: '#5e3a22' });
          P.top(0, k * 8, STAIR_W * TU, 1, '#8a5a38', Math.round(h));
        }
      }, false);
      spriteCache.set(key, sp);
    }
    return sp;
  }

  function railSprite() {
    let sp = spriteCache.get('rail');
    if (!sp) {
      sp = renderSprite(1, 1, 16, (P) => {
        P.box(0, 14, 0, 2, 2, 13, '#5c3a22');
        P.box(0, 14, 12, 16, 2, 2, '#8a5a38');
        P.box(6, 15, 0, 1, 1, 12, '#6e4428', false);
        P.box(11, 15, 0, 1, 1, 12, '#6e4428', false);
      }, false);
      spriteCache.set('rail', sp);
    }
    return sp;
  }

  // Everything that needs depth sorting, as boxes in tile space: {x0, y0, x1, y1, draw}.
  function sceneItems(room, s) {
    const items = [];
    const n = room.n;
    room.objects.forEach((o, i) => {
      const def = OBJECTS[o.type];
      if (!def || def.wall || def.flat) return;
      const f = footprint(o);
      const z = heightAt(room, f.x, f.y) ?? 0;
      items.push({ x0: f.x, y0: f.y, x1: f.x + f.w, y1: f.y + f.d, kind: 'object', index: i,
        sprite: () => objectSprite(o.type, o.flip, s(i)), wx: o.x * TU, wy: o.y * TU, wz: z });
    });
    for (let r = 0; r < 3; r++) {
      items.push({ x0: n - STAIR_W, y0: LOFT_D + r, x1: n, y1: LOFT_D + r + 1, kind: 'stair', sprite: () => stairSprite(r), wx: (n - STAIR_W) * TU, wy: (LOFT_D + r) * TU, wz: 0 });
    }
    for (let x = 0; x < n - STAIR_W; x++) {
      items.push({ x0: x, y0: LOFT_D - 0.12, x1: x + 1, y1: LOFT_D, kind: 'rail', sprite: railSprite, wx: x * TU, wy: (LOFT_D - 1) * TU, wz: LOFT_Z });
    }
    return items;
  }

  // Wall decorations and flat rugs: drawn after the background, before anything that stands.
  function decorItems(room, s) {
    const out = [];
    room.objects.forEach((o, i) => {
      const def = OBJECTS[o.type];
      if (!def || !(def.wall || def.flat)) return;
      const z = def.flat ? (heightAt(room, o.x, o.y) ?? 0) : 0;
      out.push({ sprite: objectSprite(o.type, o.flip, s(i)), wx: o.x * TU, wy: o.y * TU, wz: z });
    });
    return out;
  }

  // Order boxes back to front: A goes first when it lies entirely behind B on either axis.
  function sortItems(items) {
    const behind = (a, b) => (a.x1 <= b.x0 + 1e-6 && !(b.x1 <= a.x0 + 1e-6) && !(b.y1 <= a.y0 + 1e-6))
      || (a.y1 <= b.y0 + 1e-6 && !(b.y1 <= a.y0 + 1e-6) && !(b.x1 <= a.x0 + 1e-6));
    const out = [];
    const mark = new Map();
    const visit = (a) => {
      if (mark.get(a)) return;
      mark.set(a, true);
      for (const b of items) if (b !== a && behind(b, a)) visit(b);
      out.push(a);
    };
    [...items].sort((a, b) => (a.x0 + a.y0) - (b.x0 + b.y0)).forEach(visit);
    return out;
  }

  // Draw a sprite at world (wx, wy, wz) onto a canvas at `z` device pixels per fine pixel.
  function blit(ctx, n, sp, wx, wy, wz, z) {
    const p = project(n, wx, wy, wz);
    ctx.drawImage(sp.canvas, Math.round((p.x - sp.ax) * z), Math.round((p.y - sp.ay) * z), sp.canvas.width * z, sp.canvas.height * z);
  }
  function glows(ctx, n, list, wx, wy, wz, ax, ay, z) {
    if (!list.length) return;
    const p = project(n, wx, wy, wz);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of list) {
      const x = (p.x - ax + g.x) * z;
      const y = (p.y - ay + g.y) * z;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, g.r * z);
      grad.addColorStop(0, g.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - g.r * z, y - g.r * z, g.r * 2 * z, g.r * 2 * z);
    }
    ctx.restore();
  }

  // Screen (fine px) to the tile under it, preferring the loft surface when it is hit.
  function tileAt(room, fx, fy) {
    const o = origin(room.n);
    const sx = fx - o.x;
    for (const z of [LOFT_Z, 0]) {
      const s2 = (fy - o.y + z) * 2;
      const x = Math.floor((s2 + sx) / 2 / TU);
      const y = Math.floor((s2 - sx) / 2 / TU);
      if (x >= 0 && y >= 0 && x < room.n && y < room.n && heightAt(room, x, y) === z) return { x, y, z };
      if (z === 0 && x >= 0 && y >= 0 && x < room.n && y < room.n) return { x, y, z: heightAt(room, x, y) };
    }
    return null;
  }

  // Screen point to a spot on a back wall: { flip, along } (flip = left wall).
  function wallAt(room, fx, fy) {
    const o = origin(room.n);
    const sx = fx - o.x;
    const sy = fy - o.y;
    if (sx >= 0) {
      const x = sx;
      const z = x / 2 - sy;
      if (x < room.n * TU && z >= 0 && z <= WALL_H) return { flip: false, along: Math.floor(x / TU) };
    } else {
      const y = -sx;
      const z = y / 2 - sy;
      if (y < room.n * TU && z >= 0 && z <= WALL_H) return { flip: true, along: Math.floor(y / TU) };
    }
    return null;
  }

  // Dev preview: the default room in each theme plus every object on its own.
  function preview(canvas, z = 2) {
    const themes = Object.keys(THEMES);
    const S = size(N);
    canvas.width = S.w * z * themes.length;
    canvas.height = S.h * z + 360;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1b1826';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const st = { frame: 1, active: true, now: Date.now(), hour: 20, meeting: true };
    themes.forEach((theme, k) => {
      const room = generateRoom(theme);
      ctx.save();
      ctx.translate(k * S.w * z, 0);
      drawRoom(ctx, room, z, () => st, []);
      ctx.restore();
    });
    let x = 10;
    let y = S.h * z + 20;
    for (const type of Object.keys(OBJECTS)) {
      const def = OBJECTS[type];
      const sp = objectSprite(type, false, st);
      if (x + sp.canvas.width * 2 > canvas.width) { x = 10; y += 130; }
      ctx.drawImage(sp.canvas, x, y, sp.canvas.width * 2, sp.canvas.height * 2);
      x += sp.canvas.width * 2 + 8;
      void def;
    }
  }

  // Draw the whole room. `extra` are extra sortable items {x0,y0,x1,y1,draw(ctx)} (characters).
  let bg = { key: '', data: null };
  function drawRoom(ctx, room, z, objState, extra, onDecor) {
    const key = JSON.stringify([room.n, room.wall, room.floor]);
    if (bg.key !== key) bg = { key, data: renderBackground(room) };
    const S = size(room.n);
    ctx.drawImage(bg.data.canvas, 0, 0, S.w * z, S.h * z);
    for (const d of decorItems(room, objState)) blit(ctx, room.n, d.sprite, d.wx, d.wy, d.wz, z);
    onDecor?.(ctx);
    const items = [...sceneItems(room, objState), ...extra];
    const lights = [];
    for (const it of sortItems(items)) {
      if (it.draw) { it.draw(ctx); continue; }
      const sp = it.sprite();
      blit(ctx, room.n, sp, it.wx, it.wy, it.wz, z);
      if (sp.glows.length) lights.push([sp, it]);
    }
    for (const d of decorItems(room, objState)) glows(ctx, room.n, d.sprite.glows, d.wx, d.wy, d.wz, d.sprite.ax, d.sprite.ay, z);
    for (const [sp, it] of lights) glows(ctx, room.n, sp.glows, it.wx, it.wy, it.wz, sp.ax, sp.ay, z);
  }

  // Alpha mask lookup for click-through: is there room under this fine pixel?
  function solidAt(room, fx, fy) {
    if (!bg.data) return false;
    const c = bg.data.canvas;
    if (fx < 0 || fy < 0 || fx >= c.width || fy >= c.height) return false;
    if (!bg.mask) {
      const g = c.getContext('2d');
      bg.mask = g.getImageData(0, 0, c.width, c.height).data;
    }
    return bg.mask[(Math.floor(fy) * c.width + Math.floor(fx)) * 4 + 3] > 0;
  }

  return {
    TU, N, WALL_H, LOFT_Z, LOFT_D, STAIR_W, FLOORS, WALLS, OBJECTS, THEMES,
    size, origin, project, heightAt, standZ, isStair, linked, footprint, canPlace, walkGrid, stationSpots, generateRoom,
    objectSprite, drawRoom, blit, tileAt, wallAt, solidAt, preview,
  };
});
