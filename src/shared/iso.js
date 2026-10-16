// Isometric room: a street-corner diorama of cut-away layers joined by stairs, with furniture
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
  const WALL_H = 64; // the height wall patterns are painted for
  const SLAB = 8; // thickness of the ground plate
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
    terra: { base: '#b35f3c', draw: (P, x, y, z) => { // terracotta, four small tiles per tile
      P.top(x * TU, y * TU, TU, TU, (x + y) % 2 ? '#b35f3c' : '#a9583a', z);
      P.top(x * TU, y * TU, TU, 1, '#86432c', z);
      P.top(x * TU, y * TU, 1, TU, '#86432c', z);
      P.top(x * TU, y * TU + 8, TU, 1, '#97502f', z);
      P.top(x * TU + 8, y * TU, 1, TU, '#97502f', z);
      if ((x * 5 + y * 3) % 4 === 0) P.top(x * TU + 2, y * TU + 2, 3, 1, '#c87452', z);
    } },
    grass: { base: '#5f9a4e', draw: (P, x, y, z) => {
      P.top(x * TU, y * TU, TU, TU, (x * 3 + y) % 4 ? '#5f9a4e' : '#6aa857', z);
      P.top(x * TU + ((x * 7 + y) % 12) + 2, y * TU + ((y * 5) % 12) + 2, 1, 2, '#83c06c', z);
    } },
  };

  // Walls: base colour plus a pattern painter on the inner face (u along the wall, v up).
  const WALLS = {
    synth: { base: '#2a1d3f', trim: '#140e22', paint: (F, len) => {
      for (let u = 0; u < len; u += 12) F(u, 6, 1, WALL_H - 8, '#34254d');
      F(0, WALL_H - 9, len, 1, '*#ff3ea5');
      F(0, 10, len, 1, '*#c27bff');
    } },
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
    desk: { anim: true, w: 2, d: 1, h: 40, station: 'code', stations: front(2, 1), draw: (P, s) => {
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
    server: { anim: true, w: 1, d: 1, h: 46, station: 'terminal', stations: front(1, 1), draw: (P, s) => {
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
    globe: { anim: true, w: 1, d: 1, h: 30, station: 'web', stations: front(1, 1), draw: (P, s) => {
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
    bell: { anim: true, w: 2, d: 1, h: 26, station: 'wait', stations: front(2, 1), draw: (P, s) => {
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
    coffee: { anim: true, w: 1, d: 1, h: 34, station: 'coffee', stations: front(1, 1), draw: (P, s) => {
      P.box(0, 2, 0, 16, 12, 14, WOOD);
      P.left(2, 2, 12, 9, dk(WOOD, 0.3), 14);
      P.box(3, 3, 14, 10, 8, 14, '#2f3340');
      P.left(5, 17, 6, 4, '#16191f', 11);
      P.box(6, 8, 15, 3, 3, 3, '#f4f4f6');
      P.left(4, 24, 2, 2, s.active ? '#ff6b5a' : '#5a2a2a', 11);
      if (s.active && s.frame % 2) P.dot(7, 9, 21, '#e6e9f0', 1, 3);
    } },
    vending: { anim: true, w: 1, d: 1, h: 48, station: 'coffee', stations: front(1, 1), draw: (P, s) => {
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
    easel: { anim: true, w: 1, d: 1, h: 40, station: 'art', stations: front(1, 1), draw: (P, s) => {
      P.box(3, 6, 0, 2, 2, 30, WOOD);
      P.box(11, 6, 0, 2, 2, 30, WOOD);
      P.box(7, 2, 0, 2, 2, 28, WOOD_D);
      P.box(1, 5, 12, 14, 2, 18, '#fbf6e6');
      P.left(3, 22, 6, 3, '#5aa7ff', 7);
      P.left(8, 16, 5, 4, '#e07a9a', 7);
      P.left(4, 15, 3, 3, s.active && s.frame % 2 ? '#ffd65a' : '#7cc47f', 7);
    } },
    arcade: { anim: true, w: 1, d: 1, h: 44, station: 'game', stations: front(1, 1), draw: (P, s) => {
      P.box(1, 2, 0, 14, 12, 38, '#5b3fa3');
      P.box(1, 8, 14, 14, 6, 4, '#3a2a70');
      P.left(3, 22, 10, 10, '#141826', 14);
      P.left(4, 23, 8, 8, s.active ? ['#ff3ea5', '#36f9ff'][s.frame % 2] : '#1d2240', 14);
      P.top(4, 10, 2, 2, '#e0405a', 18);
      P.top(9, 10, 2, 2, '#5aa7ff', 18);
      P.left(2, 34, 12, 3, '#ffd65a', 14);
      if (s.active) P.glow(8, 14, 27, 12, 'rgba(255,62,165,0.35)');
    } },
    tv: { anim: true, w: 2, d: 1, h: 34, station: 'game', stations: front(2, 1), draw: (P, s) => {
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
    aquarium: { anim: true, w: 2, d: 1, h: 38, draw: (P, s) => {
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
    fireplace: { anim: true, w: 2, d: 1, h: 40, draw: (P, s) => {
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
    catbed: { anim: true, w: 1, d: 1, h: 14, draw: (P, s) => {
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
    workstation: { anim: true, w: 2, d: 1, h: 46, station: 'code', stations: front(2, 1), draw: (P, s) => {
      P.box(0, 3, 0, 32, 11, 12, '#2b2f3a');
      P.left(2, 2, 28, 7, '#22262f', 14);
      P.left(4, 9, 24, 1, '*#36f9ff', 14);
      const scr = (x, z, w, h, on) => {
        P.box(x, 3, z, w, 2, h, '#1c1f28');
        P.left(x + 1, z + 1, w - 2, h - 2, on ? '#0f2a3a' : '#141826', 5);
      };
      scr(2, 22, 13, 10, s.active);
      scr(17, 22, 13, 10, s.active);
      scr(9, 33, 14, 9, s.active);
      if (s.active) {
        for (let i = 0; i < 4; i++) {
          P.left(4, 24 + i * 2, 3 + ((i * 3 + s.frame) % 7), 1, '*#36f9ff', 5);
          P.left(19, 24 + i * 2, 2 + ((i * 5 + s.frame) % 8), 1, i % 2 ? '*#7cff8c' : '*#ff3ea5', 5);
        }
        P.left(11, 35 + (s.frame % 4), 10, 1, '*#c27bff', 5);
        P.glow(16, 6, 30, 22, 'rgba(54,249,255,0.35)');
      }
      P.box(8, 9, 12, 16, 4, 1, '#3a3f50', false);
      for (let i = 0; i < 7; i++) P.top(9 + i * 2, 10, 1, 1, i % 3 ? '#5a6075' : '*#ff3ea5', 13);
    } },
    holo: { anim: true, w: 1, d: 1, h: 40, station: 'web', stations: front(1, 1), draw: (P, s) => {
      P.box(3, 3, 0, 10, 10, 4, '#2b2f3a');
      P.top(5, 5, 6, 6, '*#36f9ff', 4);
      const r = 5 + (s.frame % 2);
      P.disc(8, 8, 22, r, 'rgba(54,249,255,0.35)');
      P.disc(8, 8, 22, r - 2, 'rgba(120,255,255,0.45)');
      P.dot(8, 8, 26, '#e0ffff', 2, 1);
      P.dot(6, 8, 20 + (s.frame % 3), '#e0ffff', 1, 1);
      P.glow(8, 8, 18, 18, 'rgba(54,249,255,0.4)');
    } },
    bin: { w: 1, d: 1, h: 20, draw: (P) => {
      P.box(3, 4, 0, 10, 9, 14, '#5a6273');
      P.box(2, 3, 14, 12, 11, 2, '#6c7588');
      for (let u = 5; u < 12; u += 3) P.left(u, 2, 1, 10, '#4a5161', 13);
      P.box(9, 6, 16, 4, 3, 3, '#e8e4d8');
    } },
    // Wall-mounted: mount height z, drawn on the plane y = 0; `top` is the highest point drawn.
    fridge: { w: 2, d: 0, h: 60, top: 58, wall: true, z: 0, draw: (P, s) => {
      P.box(1, 0, 0, 30, 6, 56, '#2a3044', false);
      P.top(1, 0, 30, 6, '#3a4258', 56);
      for (const u of [3, 17]) {
        P.left(u, 4, 12, 48, '#bfefff', 6);
        P.left(u + 1, 5, 10, 46, '#7fd6ff', 6);
        for (let v = 14; v < 50; v += 12) {
          P.left(u + 1, v, 10, 1, '#e6fbff', 6);
          for (let i = 0; i < 4; i++) P.left(u + 2 + i * 2.5, v + 1, 1, 4 + ((i + v) % 3), ['#3a9bd9', '#ffffff', '#ff8fb1', '#ffd65a'][(i + v) % 4], 6);
        }
        P.left(u + 10, 26, 1, 6, '#e6fbff', 6.5);
      }
      P.left(1, 52, 30, 4, '#1c2030', 6);
      P.left(4, 53, 10, 2, s.frame % 6 ? '*#36f9ff' : '#2a4a55', 6.5);
      P.glow(16, 8, 28, 30, 'rgba(110,200,255,0.4)');
    } },
    shopdoor: { w: 1, d: 0, h: 40, top: 34, wall: true, z: 0, draw: (P, s) => {
      P.left(1, 0, 14, 30, '#3a2a24', 0.5);
      P.left(3, 0, 10, 27, '#5a3a2c', 1);
      P.left(4, 12, 8, 12, '#ffd9a0', 1.5);
      P.left(4, 18, 8, 1, '#5a3a2c', 2);
      P.left(11, 10, 1, 2, '#e8b13a', 2);
      P.left(2, 30, 12, 4, '#1c1a20', 1);
      P.left(3, 31, 10, 2, s.hour >= 18 || s.hour < 6 ? '*#ff6b5a' : '#7a3a34', 1.5);
      P.glow(8, 2, 18, 12, 'rgba(255,200,120,0.3)');
    } },
    sign: { w: 1, d: 0, h: 40, top: 34, wall: true, z: 20, draw: (P, s) => {
      P.left(1, 20, 14, 13, '#e8e4d8', 1);
      P.left(2, 21, 12, 11, '#c2453f', 1.5);
      P.left(4, 29, 8, 1, '#ffe9b0', 2);
      P.left(4, 26, 3, 2, '#ffe9b0', 2);
      P.left(9, 26, 3, 2, '#ffe9b0', 2);
      P.left(4, 23, 8, 1, '#ffe9b0', 2);
      if (s.hour >= 18 || s.hour < 6) P.glow(8, 2, 26, 12, 'rgba(255,90,80,0.35)');
    } },
    // Wall-mounted: mount height z, drawn on the plane y = 0.
    screens: { w: 2, d: 0, h: 60, wall: true, z: 40, draw: (P, s) => {
      const cols = ['*#36f9ff', '*#7cff8c', '*#ff3ea5'];
      [[2, 44, 12, 9], [16, 46, 13, 8], [6, 55, 10, 6]].forEach(([u, v, w, h], i) => {
        P.left(u, v, w, h, '#1c1f28', 1);
        P.left(u + 1, v + 1, w - 2, h - 2, '#0f2a3a', 1);
        for (let k = 0; k < h - 3; k += 2) P.left(u + 2, v + 2 + k, 2 + ((k * 3 + i + s.frame) % (w - 4)), 1, cols[(i + k) % 3], 1.5);
      });
      P.glow(16, 2, 50, 20, 'rgba(54,249,255,0.3)');
    } },
    pipes: { w: 2, d: 0, h: 64, wall: true, z: 6, draw: (P, s) => {
      P.box(2, 0, 8, 3, 3, 52, '#5a6075', false);
      P.box(8, 0, 30, 22, 3, 3, '#4a5063', false);
      P.box(2, 0, 56, 28, 3, 3, '#5a6075', false);
      P.box(24, 0, 8, 3, 3, 22, '#6a5040', false);
      P.left(5, 31, 3, 1, '#3a3f50', 3);
      P.left(26, 20, 2, 2, s.frame % 4 ? '*#7cff8c' : '#2a3a2a', 3);
      P.left(12, 36, 1, 20, '#1c1f28', 1);
      P.left(16, 30, 1, 26, '#1c1f28', 1);
    } },
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
  // A street-corner diorama in three layers: the street out front, the shop raised on a brick
  // base behind it, and a roof terrace on top of the block in the shop's front-left corner.
  // Each area is a set of rects at one height; stairs are explicit flights between areas.
  //   [x, y, w, d] in tiles. Walls: [plane, at, from, to, height] - plane 'y' runs along x at
  //   y = at (face toward +y), plane 'x' runs along y at x = at (face toward +x). `facade` walls
  //   are the side of a raised base: wall items can hang there, but no wall is drawn.
  const LAYOUTS = {
    shop: {
      areas: [
        { name: '街道', z: 0, rects: [[0, 6, 7, 2]], walls: [['y', 6, 0, 2, 100, 'facade'], ['y', 6, 2, 7, 36, 'facade']] },
        { name: '店內', z: 36, rects: [[0, 0, 2, 3], [2, 0, 5, 6], [7, 1, 2, 3]], walls: [['x', 0, 0, 3, 64], ['y', 0, 0, 7, 64], ['x', 2, 3, 6, 64, 'facade']] },
        { name: '露台', z: 100, rects: [[0, 3, 2, 3]], walls: [], rails: true },
      ],
      flights: [
        // From the street up the front of the shop, climbing toward +x.
        { from: 0, to: 1, style: 'solid', cells: [[2, 6], [3, 6], [4, 6]], bottom: [1, 6], top: [4, 5] },
        // Inside, up the back-left corner onto the terrace.
        { from: 1, to: 2, style: 'open', cells: [[1, 0], [1, 1], [1, 2]], bottom: [2, 0], top: [1, 3] },
      ],
      door: [6, 7],
    },
  };
  const layoutOf = (room) => LAYOUTS[room.layout] || LAYOUTS.shop;

  const THEMES = {
    shop: { name: '街角小店', floors: [['brick', 'stone'], ['brick', 'terra'], ['navy', 'stone']] },
    cyber: { name: '賽博街角', floors: [['navy', 'stone'], ['cyber', 'cyber'], ['synth', 'neon']] },
    cozy: { name: '溫馨小屋', floors: [['brick', 'grass'], ['cream', 'wood'], ['plum', 'tile']] },
  };
  const FLOOR_NAMES = LAYOUTS.shop.areas.map((a) => a.name);

  const levels = (room) => layoutOf(room).areas.length;
  const floorZ = (room, f) => layoutOf(room).areas[f]?.z || 0;
  const inRect = (r, x, y) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];

  // Every place a character can stand: area tiles and each step of every flight.
  function cells(room) {
    if (room._cells) return room._cells;
    const L = layoutOf(room);
    const list = [];
    const at = new Map();
    const add = (c) => {
      c.id = list.length;
      list.push(c);
      const key = `${c.x},${c.y}`;
      if (!at.has(key)) at.set(key, []);
      at.get(key).push(c);
      return c;
    };
    const stairTiles = new Set();
    for (const fl of L.flights) for (const [x, y] of fl.cells) stairTiles.add(`${fl.from}:${x},${y}`);
    L.areas.forEach((a, f) => {
      for (const r of a.rects) {
        for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) {
          if (!stairTiles.has(`${f}:${x},${y}`)) add({ x, y, z: a.z, f, kind: 'floor' });
        }
      }
    });
    const floorAt = (x, y, f) => (at.get(`${x},${y}`) || []).find((c) => c.kind === 'floor' && c.f === f);
    const links = new Map();
    const link = (a, b) => {
      if (!a || !b) return;
      if (!links.has(a.id)) links.set(a.id, []);
      if (!links.has(b.id)) links.set(b.id, []);
      links.get(a.id).push(b);
      links.get(b.id).push(a);
    };
    for (const c of [...list]) {
      link(c, floorAt(c.x + 1, c.y, c.f));
      link(c, floorAt(c.x, c.y + 1, c.f));
    }
    for (const fl of L.flights) {
      const z0 = L.areas[fl.from].z;
      const z1 = L.areas[fl.to].z;
      const rise = (z1 - z0) / (fl.cells.length + 1);
      let prev = floorAt(fl.bottom[0], fl.bottom[1], fl.from);
      // Treads face the way the flight climbs.
      const dir = fl.cells[1][0] !== fl.cells[0][0] ? 'x' : 'y';
      fl.cells.forEach(([x, y], k) => {
        const c = add({ x, y, z: z0 + rise * (k + 1), f: fl.from, kind: 'stair', rise, dir, style: fl.style, base: z0 });
        link(prev, c);
        prev = c;
      });
      link(prev, floorAt(fl.top[0], fl.top[1], fl.to));
    }
    Object.defineProperty(room, '_cells', { value: { list, at, links }, enumerable: false, configurable: true });
    return room._cells;
  }
  const resetCells = (room) => { delete room._cells; };
  const cellAt = (room, x, y, f) => (cells(room).at.get(`${x},${y}`) || []).find((c) => c.kind === 'floor' && c.f === f) || null;
  const neighbours = (room, c) => cells(room).links.get(c.id) || [];
  const door = (room) => cellAt(room, layoutOf(room).door[0], layoutOf(room).door[1], 0);

  // Footprint in tiles, after flipping onto the left wall.
  function footprint(o) {
    const def = OBJECTS[o.type];
    if (!def) return null;
    return o.flip ? { x: o.x, y: o.y, w: def.d, d: def.w } : { x: o.x, y: o.y, w: def.w, d: def.d };
  }

  // The wall of area f that holds a wall item at (x, y): flipped items hang on 'x' walls.
  function wallFor(room, f, x, y, flip, w) {
    const a = layoutOf(room).areas[f];
    if (!a) return null;
    return a.walls.find(([plane, at, from, to]) => (flip
      ? plane === 'x' && at === x && y >= from && y + w <= to
      : plane === 'y' && at === y && x >= from && x + w <= to)) || null;
  }

  function canPlace(room, type, x, y, flip, f, ignoreIndex = -1) {
    const def = OBJECTS[type];
    if (!def) return false;
    const fp = footprint({ type, x, y, flip });
    if (def.wall) {
      const wall = wallFor(room, f, x, y, flip, def.w);
      if (!wall || (def.top || 60) > wall[4]) return false;
      const along = flip ? y : x;
      return room.objects.every((o, i) => {
        const od = OBJECTS[o.type];
        if (i === ignoreIndex || !od?.wall || !!o.flip !== !!flip || (o.f || 0) !== f) return true;
        if ((flip ? o.x : o.y) !== (flip ? x : y)) return true;
        const oa = o.flip ? o.y : o.x;
        return along + def.w <= oa || oa + od.w <= along;
      });
    }
    for (let ty = fp.y; ty < fp.y + fp.d; ty++) for (let tx = fp.x; tx < fp.x + fp.w; tx++) if (!cellAt(room, tx, ty, f)) return false;
    return room.objects.every((o, i) => {
      const od = OBJECTS[o.type];
      if (i === ignoreIndex || !od || od.wall || !!od.flat !== !!def.flat || (o.f || 0) !== f) return true;
      const g = footprint(o);
      return fp.x + fp.w <= g.x || g.x + g.w <= fp.x || fp.y + fp.d <= g.y || g.y + g.d <= fp.y;
    });
  }

  // Walkable cells (ids), with furniture taken out.
  function walkable(room) {
    const blocked = new Set();
    for (const o of room.objects) {
      const def = OBJECTS[o.type];
      if (!def || def.wall || def.flat) continue;
      const fp = footprint(o);
      for (let y = fp.y; y < fp.y + fp.d; y++) for (let x = fp.x; x < fp.x + fp.w; x++) {
        const c = cellAt(room, x, y, o.f || 0);
        if (c) blocked.add(c.id);
      }
    }
    return new Set(cells(room).list.filter((c) => !blocked.has(c.id)).map((c) => c.id));
  }

  function stationSpots(room) {
    const open = walkable(room);
    const spots = [];
    room.objects.forEach((o, index) => {
      const def = OBJECTS[o.type];
      if (!def?.stations) return;
      for (const st of def.stations) {
        const x = o.x + (o.flip ? st.dy : st.dx);
        const y = o.y + (o.flip ? st.dx : st.dy);
        const c = cellAt(room, x, y, o.f || 0);
        if (!c || !open.has(c.id)) continue;
        let facing = o.flip ? -1 : 1;
        if (st.dx >= def.w) facing = o.flip ? 1 : -1;
        const sit = def.sit ? (o.flip ? [def.sit[1], def.sit[0], def.sit[2]] : def.sit) : null;
        spots.push({ type: def.station, cell: c.id, x, y, f: c.f, facing, sit, objIndex: index });
      }
    });
    return spots;
  }

  function generateRoom(theme = 'shop') {
    const t = THEMES[theme] || THEMES.shop;
    const room = { iso: 3, layout: 'shop', theme, floors: t.floors.map(([wall, floor]) => ({ wall, floor })), objects: [] };
    const add = (f, type, x, y, flip = false) => { if (canPlace(room, type, x, y, flip, f)) room.objects.push({ type, x, y, flip, f }); };
    // Street: the shop door, a sign, two vending machines and the bins.
    add(0, 'shopdoor', 6, 6);
    add(0, 'sign', 3, 6);
    add(0, 'vending', 5, 6);
    add(0, 'bin', 0, 7);
    add(0, 'plant', 0, 6);
    add(0, 'neon', 0, 6);
    // Shop: workbench along the back, the glowing fridge on the block, counter in the middle.
    add(1, 'workstation', 3, 0);
    add(1, 'coffee', 5, 0);
    add(1, 'server', 6, 0);
    add(1, 'screens', 3, 0);
    add(1, 'window', 5, 0);
    add(1, 'clock', 2, 0);
    add(1, 'fridge', 2, 4, true);
    add(1, 'poster', 2, 3, true);
    add(1, 'holo', 2, 2);
    add(1, 'bell', 3, 4);
    add(1, 'table', 5, 3);
    add(1, 'bookshelf', 7, 1);
    add(1, 'plant', 8, 3);
    add(1, 'plant', 0, 0);
    add(1, 'boxes', 0, 1);
    add(1, 'lamp', 0, 2);
    add(1, 'shelf', 0, 0, true);
    // Terrace: a sofa under the sky.
    add(2, 'sofa', 0, 4, true);
    add(2, 'plant', 0, 3);
    return room;
  }

  // ---- Rendering --------------------------------------------------------------------

  // Room canvas in fine pixels: world (0, 0, 0) lands at origin().
  function bounds(room) {
    const L = layoutOf(room);
    let top = 0; let bottom = 0; let left = 0; let right = 0;
    for (const a of L.areas) {
      const tall = a.walls.some((w) => !w[5]) ? Math.max(...a.walls.filter((w) => !w[5]).map((w) => w[4])) : a.rails ? 16 : 4;
      for (const [x, y, w, d] of a.rects) {
        top = Math.max(top, a.z + tall - ((x + y) * TU) / 2);
        bottom = Math.max(bottom, ((x + w + y + d) * TU) / 2 + SLAB);
        left = Math.max(left, (y + d - x) * TU);
        right = Math.max(right, (x + w - y) * TU);
      }
    }
    return { top: Math.ceil(top) + 6, bottom, left, right };
  }
  const size = (room) => { const b = bounds(room); return { w: b.left + b.right + 40, h: b.top + b.bottom + 24 }; };
  const origin = (room) => { const b = bounds(room); return { x: b.left + 20, y: b.top + 12 }; };
  const project = (room, x, y, z) => { const o = origin(room); return { x: o.x + x - y, y: o.y + (x + y) / 2 - z }; };

  // A cached sprite with its anchor = the world point it was painted relative to.
  const spriteCache = new Map();
  function cached(key, make) {
    let sp = spriteCache.get(key);
    if (!sp) {
      sp = make();
      if (spriteCache.size > 800) spriteCache.clear();
      spriteCache.set(key, sp);
    }
    return sp;
  }
  // Paint into a Pix big enough for a w x d x h box (tiles, tiles, units) anchored at its origin.
  function renderSprite(w, d, h, paint, flip, below = 0) {
    const ox = d * TU + 8;
    const oy = h + 8;
    const P = new Pix(Math.ceil((w + d) * TU) + 16, Math.ceil(((w + d) * TU) / 2) + h + below + 16, ox, oy);
    paint(P);
    P.edge();
    const W = P.w;
    return { canvas: P.canvas(flip), ax: flip ? W - ox : ox, ay: oy, glows: P.glows.map((g) => ({ ...g, x: flip ? W - g.x : g.x })) };
  }

  function objectSprite(type, flip, s) {
    const def = OBJECTS[type];
    const key = `${type}|${flip ? 1 : 0}|${def.anim || def.wall ? `${s.active ? 1 : 0}|${s.frame % 8}|${s.hour}|${s.meeting ? 1 : 0}` : ''}`;
    return cached(key, () => renderSprite(def.w, Math.max(def.d, 1), def.h, (P) => def.draw(P, s), flip));
  }

  // Brick courses on the two visible faces of a raised base, h units tall below its top.
  function brickFaces(P, w, d, h, c) {
    const L = w * TU;
    const D = d * TU;
    const mortar = dk(c, 0.3);
    P.left(0, -h, L, h, c, D);
    P.right(D, -h, D, h, dk(c, 0.22), L);
    for (let v = 3, row = 0; v < h; v += 5, row++) {
      P.left(0, -v, L, 1, mortar, D);
      P.right(D, -v, D, 1, dk(mortar, 0.2), L);
      for (let u = row % 2 ? 3 : 7; u < L; u += 9) P.left(u, -v + 1, 1, 4, mortar, D);
      for (let u = row % 2 ? 2 : 6; u < D; u += 9) P.right(D - u, -v + 1, 1, 4, dk(mortar, 0.2), L);
    }
  }

  // One rect of an area: its floor and, for raised areas, the brick base down to the ground.
  function slabSprite(room, f, r) {
    const a = layoutOf(room).areas[f];
    const { floor } = room.floors[f];
    const base = (WALLS[room.floors[0].wall] || WALLS.brick).base;
    const fl = FLOORS[floor] || FLOORS.wood;
    const [, , w, d] = r;
    const h = a.z + SLAB;
    return cached(`slab|${room.layout}|${f}|${r}|${floor}|${base}`, () => renderSprite(w, d, 8, (P) => {
      if (a.z > 0) brickFaces(P, w, d, h, base);
      else P.box(0, 0, -SLAB, w * TU, d * TU, SLAB, { t: fl.base, l: dk(fl.base, 0.3), r: dk(fl.base, 0.45) }, false);
      for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) fl.draw(P, x, y, 0);
      // A lit lip along the front edges, so each layer reads as separate.
      P.left(0, -2, w * TU, 2, lt(fl.base, 0.2), d * TU);
      P.right(d * TU, -2, d * TU, 2, lt(fl.base, 0.1), w * TU);
      // An arch under a base that has no street in front of it.
      if (a.z > 0 && f > 0 && !layoutOf(room).areas[0].rects.some((s) => s[1] === r[1] + d || s[0] === r[0] + w)) {
        const D = d * TU;
        const R = Math.min(10, D / 2 - 4);
        const leg = h - 16 - R;
        for (let u = Math.ceil(D / 2 - R); u < D / 2 + R; u++) {
          const top = leg + Math.sqrt(Math.max(0, R * R - (u + 0.5 - D / 2) ** 2));
          P.right(D - u, -h, 1, top, dk(base, 0.6), w * TU);
        }
      }
    }, false, h));
  }

  function wallSprite(room, f, wall) {
    const [plane, , from, to, h] = wall;
    const w = WALLS[room.floors[f].wall] || WALLS.plum;
    const L = (to - from) * TU;
    return cached(`wall|${f}|${wall}|${room.floors[f].wall}`, () => renderSprite(plane === 'y' ? to - from : 1, plane === 'y' ? 1 : to - from + 1, h + 2, (P) => {
      if (plane === 'y') { // plane y = 0 in local space, running along x
        P.box(0, -5, 0, L, 5, h, { t: lt(w.trim, 0.25), l: w.base, r: w.trim }, false);
        w.paint((u, v, ww, hh, c) => P.left(u, v, ww, hh, c, 0), L, h);
        P.left(0, 0, L, 5, w.trim, 0);
        P.left(0, 0, 3, h, dk(w.base, 0.12), 0);
      } else { // plane x = 0, running along y
        P.box(-5, -5, 0, 5, L + 5, h, { t: lt(w.trim, 0.25), l: w.trim, r: dk(w.base, 0.08) }, false);
        w.paint((u, v, ww, hh, c) => P.right(L - u, v, ww, hh, c, 0), L, h);
        P.right(L, 0, L, 5, w.trim, 0);
      }
    }, false));
  }

  // One step. Solid steps are stone blocks down to the ground; open ones are metal treads.
  function stairSprite(c, room) {
    const h = c.z - c.base;
    const fl = FLOORS[room.floors[c.f].floor] || FLOORS.stone;
    const base = (WALLS[room.floors[0].wall] || WALLS.brick).base;
    return cached(`stair|${c.style}|${c.dir}|${h}|${c.rise}|${fl.base}|${base}`, () => renderSprite(1, 1, 8, (P) => {
      if (c.style === 'solid') {
        brickFaces(P, 1, 1, h, base);
        P.top(0, 0, TU, TU, lt(fl.base, 0.05), 0);
        if (c.dir === 'x') P.top(0, 0, 2, TU, lt(fl.base, 0.25), 0); else P.top(0, 0, TU, 2, lt(fl.base, 0.25), 0);
        return;
      }
      P.box(0, 0, -3, TU, TU, 3, { t: '#7a8399', l: '#555c72', r: '#41475a' }, false);
      for (let i = 2; i < TU; i += 3) {
        if (c.dir === 'x') P.top(i, 1, 1, TU - 2, '#636b82', 0); else P.top(1, i, TU - 2, 1, '#636b82', 0);
      }
      if (c.dir === 'y') {
        P.box(TU - 2, 0, -7, 2, TU, 4, '#3a3f50', false);
        P.box(TU - 2, 7, 0, 2, 2, 18, '#5a6075', false);
        P.box(TU - 2, 0, 17, 2, TU, 2, '#8a92aa', false);
      } else {
        P.box(0, TU - 2, -7, TU, 2, 4, '#3a3f50', false);
        P.box(7, TU - 2, 0, 2, 2, 18, '#5a6075', false);
        P.box(0, TU - 2, 17, TU, 2, 2, '#8a92aa', false);
      }
    }, false, h + 4));
  }

  // A run of railing along one edge of a tile: posts and a top bar.
  function railSprite(room, f, plane) {
    const w = WALLS[room.floors[f].wall] || WALLS.navy;
    return cached(`rail|${plane}|${w.base}`, () => renderSprite(1, 1, 18, (P) => {
      const c = lt(w.base, 0.15);
      if (plane === 'y') {
        for (const u of [1, 8]) P.box(u, -2, 0, 2, 2, 14, c, false);
        P.box(0, -2, 13, TU, 2, 2, lt(c, 0.2), false);
        P.box(0, -2, 6, TU, 2, 1, c, false);
      } else {
        for (const u of [1, 8]) P.box(-2, u, 0, 2, 2, 14, c, false);
        P.box(-2, 0, 13, 2, TU, 2, lt(c, 0.2), false);
        P.box(-2, 0, 6, 2, TU, 1, c, false);
      }
    }, false));
  }

  // Everything that needs depth sorting, as boxes in tile space with z in world units.
  function sceneItems(room, s) {
    const L = layoutOf(room);
    const items = [];
    const e = 0.02;
    L.areas.forEach((a, f) => {
      for (const r of a.rects) {
        const [x, y, w, d] = r;
        items.push({ x0: x, y0: y, x1: x + w - e, y1: y + d - e, z0: -SLAB, z1: a.z, sprite: () => slabSprite(room, f, r), wx: x * TU, wy: y * TU, wz: a.z });
      }
      for (const wall of a.walls) {
        if (wall[5]) continue;
        const [plane, at, from, to, h] = wall;
        const box = plane === 'y' ? { x0: from, x1: to, y0: at - 0.3, y1: at - e } : { x0: at - 0.3, x1: at - e, y0: from, y1: to };
        items.push({ ...box, z0: a.z, z1: a.z + h, sprite: () => wallSprite(room, f, wall), wx: (plane === 'y' ? from : at) * TU, wy: (plane === 'y' ? at : from) * TU, wz: a.z });
      }
      if (a.rails) {
        // Railing on every open edge, except where a flight arrives.
        const arrivals = new Set(L.flights.filter((fl) => fl.to === f).map((fl) => `${fl.top}`));
        for (const r of a.rects) {
          for (let x = r[0]; x < r[0] + r[2]; x++) {
            for (const [y, edge] of [[r[1], r[1]], [r[1] + r[3] - 1, r[1] + r[3]]]) {
              if (edge === r[1] && arrivals.has(`${x},${y}`)) continue;
              items.push({ x0: x, x1: x + 1, y0: edge - 0.1, y1: edge - e / 2, z0: a.z, z1: a.z + 16, sprite: () => railSprite(room, f, 'y'), wx: x * TU, wy: edge * TU, wz: a.z });
            }
          }
          for (let y = r[1]; y < r[1] + r[3]; y++) {
            for (const edge of [r[0], r[0] + r[2]]) {
              items.push({ x0: edge - 0.1, x1: edge - e / 2, y0: y, y1: y + 1, z0: a.z, z1: a.z + 16, sprite: () => railSprite(room, f, 'x'), wx: edge * TU, wy: y * TU, wz: a.z });
            }
          }
        }
      }
    });
    for (const c of cells(room).list) {
      if (c.kind !== 'stair') continue;
      const z0 = c.style === 'solid' ? c.base : c.z - c.rise;
      items.push({ x0: c.x, y0: c.y, x1: c.x + 1 - e, y1: c.y + 1 - e, z0, z1: c.z, sprite: () => stairSprite(c, room), wx: c.x * TU, wy: c.y * TU, wz: c.z });
    }
    room.objects.forEach((o, i) => {
      const def = OBJECTS[o.type];
      if (!def) return;
      const z = floorZ(room, o.f || 0);
      const sprite = () => objectSprite(o.type, o.flip, s(i));
      if (def.wall) {
        const box = o.flip ? { x0: o.x - 0.01, x1: o.x, y0: o.y, y1: o.y + def.w } : { y0: o.y - 0.01, y1: o.y, x0: o.x, x1: o.x + def.w };
        items.push({ ...box, z0: z + 1, z1: z + (def.top || 60), sprite, wx: o.x * TU, wy: o.y * TU, wz: z });
        return;
      }
      const fp = footprint(o);
      items.push({ x0: fp.x, y0: fp.y, x1: fp.x + fp.w, y1: fp.y + fp.d, z0: z + (def.flat ? 0 : 0.02), z1: z + (def.flat ? 0.01 : def.h), sprite, wx: o.x * TU, wy: o.y * TU, wz: z });
    });
    return items;
  }

  // Back to front: A is drawn first when it lies wholly behind or below B and B is not behind A.
  function sortItems(items) {
    const e = 1e-6;
    const sep = (a, b) => a.x1 <= b.x0 + e || a.y1 <= b.y0 + e || a.z1 <= b.z0 + e;
    const out = [];
    const mark = new Set();
    const visit = (a) => {
      if (mark.has(a)) return;
      mark.add(a);
      for (const b of items) if (b !== a && sep(b, a) && !sep(a, b)) visit(b);
      out.push(a);
    };
    [...items].sort((a, b) => (a.z0 - b.z0) || ((a.x0 + a.y0) - (b.x0 + b.y0))).forEach(visit);
    return out;
  }

  function blit(ctx, room, sp, wx, wy, wz, z) {
    const p = project(room, wx, wy, wz);
    ctx.drawImage(sp.canvas, Math.round((p.x - sp.ax) * z), Math.round((p.y - sp.ay) * z), sp.canvas.width * z, sp.canvas.height * z);
  }
  function glows(ctx, room, sp, wx, wy, wz, z) {
    if (!sp.glows.length) return;
    const p = project(room, wx, wy, wz);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of sp.glows) {
      const x = (p.x - sp.ax + g.x) * z;
      const y = (p.y - sp.ay + g.y) * z;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, g.r * z);
      grad.addColorStop(0, g.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - g.r * z, y - g.r * z, g.r * 2 * z, g.r * 2 * z);
    }
    ctx.restore();
  }

  // Draw the whole room. `extra` are more sortable boxes {x0..z1, draw(ctx)} (characters, parcels).
  function drawRoom(ctx, room, z, objState, extra) {
    const lights = [];
    for (const it of sortItems([...sceneItems(room, objState), ...extra])) {
      if (it.draw) { it.draw(ctx); continue; }
      const sp = it.sprite();
      blit(ctx, room, sp, it.wx, it.wy, it.wz, z);
      if (sp.glows.length) lights.push([sp, it]);
    }
    for (const [sp, it] of lights) glows(ctx, room, sp, it.wx, it.wy, it.wz, z);
  }

  // Screen point (fine px) to the topmost area tile under it.
  function tileAt(room, fx, fy) {
    const o = origin(room);
    const sx = fx - o.x;
    const order = layoutOf(room).areas.map((a, f) => f).sort((a, b) => floorZ(room, b) - floorZ(room, a));
    let best = null;
    for (const f of order) {
      const s2 = (fy - o.y + floorZ(room, f)) * 2;
      const x = Math.floor((s2 + sx) / 2 / TU);
      const y = Math.floor((s2 - sx) / 2 / TU);
      if (cellAt(room, x, y, f) && (!best || x + y > best.x + best.y + 2)) best = { x, y, f };
    }
    return best;
  }

  // Screen point to a spot on some wall: { f, flip, x, y } for a wall item's position.
  function wallAt(room, fx, fy) {
    const o = origin(room);
    const sx = fx - o.x;
    const sy = fy - o.y;
    let best = null;
    layoutOf(room).areas.forEach((a, f) => {
      for (const [plane, at, from, to, h] of a.walls) {
        const A = at * TU;
        // On plane y = A: x = sx + A; on plane x = A: y = A - sx.
        const u = plane === 'y' ? sx + A : A - sx;
        const z = (u + A) / 2 - sy;
        if (u < from * TU || u >= to * TU || z < a.z || z > a.z + h) continue;
        const depth = u + A;
        if (best && best.depth >= depth) continue;
        const along = Math.floor(u / TU);
        best = plane === 'y' ? { f, flip: false, x: along, y: at, depth } : { f, flip: true, x: at, y: along, depth };
      }
    });
    return best;
  }

  // Click-through mask: the diorama's silhouette at 1 fine pixel per pixel.
  let mask = { key: '', data: null, w: 0 };
  function solidAt(room, fx, fy) {
    const key = JSON.stringify([room.layout, room.floors]);
    if (mask.key !== key) {
      const S = size(room);
      const c = makeCanvas(S.w, S.h);
      const g = c.getContext('2d');
      for (const it of sceneItems({ ...room, objects: [] }, () => ({ frame: 0, active: false, hour: 12 }))) blit(g, room, it.sprite(), it.wx, it.wy, it.wz, 1);
      mask = { key, data: g.getImageData(0, 0, S.w, S.h).data, w: S.w, h: S.h };
    }
    if (fx < 0 || fy < 0 || fx >= mask.w || fy >= mask.h) return false;
    return mask.data[(Math.floor(fy) * mask.w + Math.floor(fx)) * 4 + 3] > 0;
  }

  // Dev preview: the default room in each theme plus every object on its own.
  function preview(canvas, z = 2) {
    const themes = Object.keys(THEMES);
    const rooms = themes.map((t) => generateRoom(t));
    const S = size(rooms[0]);
    canvas.width = S.w * z * themes.length;
    canvas.height = S.h * z + 300;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1b1826';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const st = { frame: 1, active: true, now: Date.now(), hour: 20, meeting: true };
    rooms.forEach((room, k) => {
      ctx.save();
      ctx.translate(k * S.w * z, 0);
      drawRoom(ctx, room, z, () => st, []);
      ctx.restore();
    });
    let x = 10;
    let y = S.h * z + 10;
    for (const type of Object.keys(OBJECTS)) {
      const sp = objectSprite(type, false, st);
      if (x + sp.canvas.width * 2 > canvas.width) { x = 10; y += 140; }
      ctx.drawImage(sp.canvas, x, y, sp.canvas.width * 2, sp.canvas.height * 2);
      x += sp.canvas.width * 2 + 8;
    }
  }

  return {
    TU, SLAB, FLOORS, WALLS, OBJECTS, THEMES, FLOOR_NAMES, LAYOUTS,
    size, origin, project, floorZ, levels, cells, resetCells, cellAt, neighbours, door, walkable, footprint, canPlace, stationSpots,
    generateRoom, objectSprite, drawRoom, blit, tileAt, wallAt, solidAt, preview,
  };
});
