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
    if (c[0] === '*') c = c.slice(1);
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return [128, 128, 128];
  }
  // Translucent colours (glass, water) are 'rgba(...)'; everything else is opaque.
  const alphaOf = (c) => {
    const m = /^rgba\([^)]*,\s*([\d.]+)\s*\)$/i.exec(c);
    return m ? +m[1] : 1;
  };
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

    // c is a colour, or a function of the colour already there (null leaves the pixel empty).
    set(x, y, c) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x;
      if (typeof c === 'function') {
        if (!this.px[i]) return;
        c = c(this.px[i]);
      }
      // A translucent colour over something solid mixes into it.
      const a = alphaOf(c);
      const under = this.px[i];
      if (a < 1 && under && alphaOf(under) === 1) {
        const [r1, g1, b1] = rgb(under);
        const [r2, g2, b2] = rgb(c);
        c = hex(r1 + (r2 - r1) * a, g1 + (g2 - g1) * a, b1 + (b2 - b1) * a);
      }
      this.px[i] = c;
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
      const col = typeof c === 'string' ? { t: lt(c, 0.16), l: c, r: dk(c, 0.32) } : c;
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

    // A light's bloom; a pool lies flat on the floor, twice as wide as it is deep.
    glow(x, y, z, r, c, pool = false) {
      const [sx, sy] = this.p(x, y, z);
      this.glows.push({ x: sx, y: sy, r, c, pool });
    }

    // Outer pixels take a deeper shade of their own colour: no black outlines.
    edge() {
      const { w, h, px } = this;
      const out = px.slice();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const c = px[y * w + x];
          if (!c || alphaOf(c) < 1) continue;
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
          img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = Math.round(alphaOf(col) * 255);
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
    magic: { base: '#3e2f63', draw: (P, x, y, z) => { // a starry rug-like floor
      P.top(x * TU, y * TU, TU, TU, (x + y) % 2 ? '#3e2f63' : '#46356f', z);
      P.top(x * TU, y * TU, TU, 1, '#2c2148', z);
      if ((x * 5 + y * 3) % 4 === 0) P.top(x * TU + 7, y * TU + 6, 1, 3, '#e8c25a', z);
      if ((x * 5 + y * 3) % 4 === 0) P.top(x * TU + 6, y * TU + 7, 3, 1, '#e8c25a', z);
    } },
    plank: { base: '#b07a4a', draw: (P, x, y, z) => { // deck boards run along y
      P.top(x * TU, y * TU, TU, TU, '#b07a4a', z);
      for (let i = 0; i < TU; i += 4) P.top(x * TU + i, y * TU, 1, TU, '#8f5f36', z);
      if ((x + y * 3) % 3 === 0) P.top(x * TU + 6, y * TU + ((x * 5) % 10) + 2, 2, 1, '#6e4628', z);
    } },
    sand: { base: '#e8d29a', draw: (P, x, y, z) => {
      const n = (k) => { const v = Math.sin((x + 7) * 12.9898 + (y + 3) * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
      P.top(x * TU, y * TU, TU, TU, (x * 5 + y) % 3 ? '#e8d29a' : '#eed9a6', z);
      for (let i = 0; i < 6; i++) P.top(x * TU + Math.floor(n(i) * 15), y * TU + Math.floor(n(i + 9) * 15), 1, 1, i % 2 ? '#d9bf82' : '#f6e8c0', z);
      // Ripples left by the wind, and now and then a shell.
      if (n(20) < 0.5) P.top(x * TU + 2, y * TU + 4 + Math.floor(n(21) * 8), 10, 1, '#dcc58c', z);
      if (n(30) < 0.15) { const [sx, sy] = P.p(x * TU + 4 + Math.floor(n(31) * 8), y * TU + 4 + Math.floor(n(32) * 8), z); P.set(sx, sy, '#f4c8c0'); P.set(sx + 1, sy, '#e8a8a0'); P.set(sx, sy - 1, '#fbe0dc'); }
    } },
    grass: { base: '#5f9a4e', draw: (P, x, y, z) => {
      const n = (k) => { const v = Math.sin((x + 3) * 12.9898 + (y + 5) * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
      P.top(x * TU, y * TU, TU, TU, (x * 3 + y) % 4 ? '#5f9a4e' : '#6aa857', z);
      // Darker and lighter patches, then tufts of blades.
      if (n(1) < 0.5) P.top(x * TU + Math.floor(n(2) * 8), y * TU + Math.floor(n(3) * 8), 6, 5, '#578f47', z);
      for (let i = 0; i < 4; i++) {
        const [sx, sy] = P.p(x * TU + 2 + Math.floor(n(10 + i) * 12), y * TU + 2 + Math.floor(n(20 + i) * 12), z);
        P.set(sx, sy - 1, '#83c06c');
        P.set(sx + 1, sy - 2, '#9bd27f');
        P.set(sx + 2, sy - 1, '#4f8a42');
      }
      // A flower or two, sometimes a pebble.
      const petals = ['#ffffff', '#ffd65a', '#ff9ec0', '#b9a6ff'];
      for (let i = 0; i < 2; i++) {
        if (n(30 + i) > 0.42) continue;
        const [sx, sy] = P.p(x * TU + 3 + Math.floor(n(40 + i) * 10), y * TU + 3 + Math.floor(n(50 + i) * 10), z);
        const c = petals[Math.floor(n(60 + i) * petals.length)];
        P.set(sx - 1, sy - 2, c); P.set(sx + 1, sy - 2, c); P.set(sx, sy - 3, c); P.set(sx, sy - 1, c);
        P.set(sx, sy - 2, '#f5b942');
      }
      if (n(70) < 0.18) P.top(x * TU + 4 + Math.floor(n(71) * 8), y * TU + 4 + Math.floor(n(72) * 8), 3, 2, '#9a958c', z);
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
    wood: { base: '#8a5a36', trim: '#5c3a22', cap: '#4a2e1a', paint: (F, len, h = WALL_H) => {
      for (let u = 0; u < len; u += 5) F(u, 6, 1, h - 8, '#7a4e2e');
      F(0, h - 12, len, 1, '#6e4628');
    } },
    bamboo: { base: '#cfae6e', trim: '#8a6a3a', cap: '#7a5a30', paint: (F, len, h = WALL_H) => {
      for (let u = 0; u < len; u += 4) {
        F(u, 6, 1, h - 16, '#b08f52');
        for (let v = 10 + (u % 8); v < h - 12; v += 14) F(u, v, 3, 1, '#8a6a3a');
      }
      // A band of thatch along the top.
      F(0, h - 10, len, 8, '#b8954f');
      for (let u = 1; u < len; u += 3) F(u, h - 10, 1, 6 + (u % 3), '#9a7a3e');
    } },
    log: { base: '#8f5e38', trim: '#5c3a22', cap: '#4a2e1a', paint: (F, len, h = WALL_H) => {
      // Round logs laid one on another: a dark seam under each, a lit edge on top.
      for (let v = 6; v < h - 2; v += 8) {
        F(0, v, len, 1, '#5c3a22');
        F(0, v + 6, len, 1, '#a8744a');
        for (let u = (v * 7) % 13; u < len; u += 17) F(u, v + 3, 3, 1, '#7a4c2c');
      }
    } },
    stone: { base: '#6f6c78', trim: '#4c4a55', paint: (F, len, h = WALL_H) => {
      for (let v = 6, row = 0; v < h - 4; v += 9, row++) {
        F(0, v, len, 1, '#5a5764');
        for (let u = row % 2 ? 6 : 0; u < len; u += 13) F(u, v + 1, 1, 8, '#5a5764');
      }
    } },
    glass: { base: 'rgba(170,230,215,0.22)', trim: '#4f7a52', cap: '#5f8f5f', glass: true, paint: () => {} },
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
      P.glow(8, 8, 0, 26, 'rgba(255,200,120,0.22)', true);
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
    streetlamp: { w: 1, d: 1, h: 76, draw: (P, s) => {
      P.box(5, 5, 0, 6, 6, 3, '#2e3240');
      P.box(7, 7, 3, 2, 2, 57, '#3a3f50');
      P.box(4, 4, 62, 8, 8, 3, '#2e3240');
      P.box(5, 5, 58, 6, 6, 4, '#fff0c0', false);
      const on = s.hour >= 17 || s.hour < 7;
      P.top(5, 5, 6, 6, on ? '*#fff4cc' : '#c9c1a0', 58);
      P.glow(8, 8, 56, on ? 34 : 16, on ? 'rgba(255,220,150,0.5)' : 'rgba(255,220,150,0.15)');
      if (on) P.glow(8, 8, 0, 34, 'rgba(255,210,140,0.32)', true);
    } },
    telescope: { anim: true, w: 1, d: 1, h: 34, station: 'web', stations: [{ dx: 0, dy: 1 }], draw: (P, s) => {
      for (const [x, y] of [[5, 5], [11, 6], [8, 11]]) P.box(x, y, 0, 1, 1, 16, '#5a4a3a', false);
      P.box(6, 6, 16, 4, 4, 3, '#3a3f50');
      for (let i = 0; i < 7; i++) P.box(4 + i, 9 - i * 0.6, 18 + i * 1.6, 3, 3, 3, i === 6 ? '#c9a24a' : '#3f6fb0', false);
      if (s.active && s.frame % 3 === 0) P.dot(14, 3, 32, '*#ffffff', 1, 1);
    } },
    tree: { w: 1, d: 1, h: 84, draw: (P, s) => {
      P.box(6, 6, 0, 4, 4, 30, { t: '#6e4428', l: '#6e4428', r: '#55331d' }, false);
      for (const [x, y, z, r, c] of [[8, 8, 40, 11, '#3f7a3a'], [4, 9, 50, 8, '#4f8f45'], [12, 6, 54, 8, '#4f8f45'], [8, 8, 62, 8, '#62a656'], [7, 9, 70, 5, '#7cbf6a']]) P.disc(x, y, z, r, c);
      P.dot(3, 9, 54, '#9fd88a', 2, 1);
      P.dot(10, 7, 66, '#9fd88a', 2, 1);
      if (s.weather === 'snow') for (const [x, y, z, r] of [[8, 8, 46, 7], [4, 9, 55, 5], [12, 6, 59, 5], [8, 8, 67, 5], [7, 9, 73, 3]]) P.disc(x, y, z, r, '#eef3fa');
    } },
    bush: { w: 1, d: 1, h: 22, draw: (P, s) => {
      for (const [x, y, z, r, c] of [[8, 8, 7, 7, '#3f7a3a'], [5, 9, 10, 5, '#4f8f45'], [11, 7, 11, 5, '#4f8f45'], [8, 8, 14, 4, '#62a656']]) P.disc(x, y, z, r, c);
      if (s.weather === 'snow') for (const [x, y, z, r] of [[8, 8, 17, 3.5], [5, 9, 13, 3], [11, 7, 14, 3]]) P.disc(x, y, z, r, '#eef3fa');
      P.dot(6, 9, 15, '#ff8fb1', 1, 1);
      P.dot(11, 7, 16, '#ffd65a', 1, 1);
    } },
    lilypad: { w: 1, d: 1, h: 4, flat: true, onWater: true, draw: (P) => {
      P.top(3, 4, 9, 8, '#5aa85a', 0.5);
      P.top(7, 4, 2, 4, '#4f8f45', 0.6);
      P.dot(10, 10, 2, '#ff8fb1', 2, 1);
    } },
    boat: { w: 2, d: 1, h: 14, onWater: true, draw: (P) => {
      P.box(2, 3, -2, 28, 10, 7, { t: '#8a4a2e', l: '#c25b3a', r: '#9a432a' }, false);
      P.box(4, 4, 4, 24, 8, 1, '#6e3a24', false);
      P.box(15, 7, 5, 1, 1, 16, '#5a4a3a', false);
      P.left(16, 12, 7, 8, '#f4efe4', 7.5);
    } },
    cauldron: { anim: true, w: 1, d: 1, h: 26, station: 'art', stations: front(1, 1), draw: (P, s) => {
      P.disc(8, 8, 8, 6.5, '#2a2833');
      P.box(3, 3, 0, 10, 10, 3, '#3a3844', false);
      P.top(3, 4, 10, 8, '#7cff8c', 13);
      const b = s.frame % 3;
      P.dot(6 + b, 7, 15 + b, '#c8ffd0', 1, 1);
      P.dot(10 - b, 9, 17 - b, '#9dff8a', 1, 1);
      P.glow(8, 8, 14, 14, 'rgba(124,255,140,0.35)');
    } },
    planter: { w: 2, d: 1, h: 26, draw: (P) => {
      P.box(1, 3, 0, 30, 10, 9, { t: '#5a3a24', l: '#8a5a36', r: '#6e4428' }, false);
      P.top(2, 4, 28, 8, '#4a3020', 9);
      for (let i = 0; i < 6; i++) {
        P.disc(4 + i * 5, 8, 13 + (i % 2) * 2, 3.5, i % 2 ? '#4f8f45' : '#62a656');
        P.dot(4 + i * 5, 8, 17 + (i % 2) * 2, ['#ff8fb1', '#c27bff', '#ffd65a'][i % 3], 1, 1);
      }
    } },
    crate: { w: 1, d: 1, h: 20, draw: (P) => {
      P.box(2, 3, 0, 12, 11, 11, { t: '#c99a62', l: '#b98a56', r: '#9a7046' }, false);
      P.left(2, 5, 12, 1, '#8a6038', 14);
      P.left(7, 0, 1, 11, '#8a6038', 14);
      P.box(4, 5, 11, 8, 7, 6, { t: '#d6b07a', l: '#c99a62', r: '#a97c4e' }, false);
    } },
    barrel: { w: 1, d: 1, h: 20, draw: (P) => {
      P.disc(8, 8, 2, 5.5, '#6e4428');
      P.box(3, 3, 0, 10, 10, 15, { t: '#9a6640', l: '#8a5a36', r: '#6e4428' }, false);
      P.left(3, 3, 10, 1, '#4a4f5e', 13);
      P.left(3, 11, 10, 1, '#4a4f5e', 13);
      P.top(4, 4, 8, 8, '#a87048', 15);
    } },
    chair: { w: 1, d: 1, h: 22, draw: (P) => {
      for (const [x, y] of [[4, 5], [11, 5], [4, 11], [11, 11]]) P.box(x, y, 0, 1, 1, 8, WOOD_D, false);
      P.box(3, 4, 8, 10, 9, 2, WOOD);
      P.box(3, 3, 10, 10, 2, 10, WOOD);
    } },
    stool: { w: 1, d: 1, h: 16, draw: (P) => {
      P.box(7, 7, 0, 2, 2, 10, '#5a6075', false);
      P.box(5, 9, 3, 6, 1, 1, '#5a6075', false);
      P.disc(8, 8, 11, 4.5, '#c25b4f');
      P.top(5, 6, 6, 4, '#d6705f', 12);
    } },
    signboard: { w: 1, d: 1, h: 24, draw: (P) => {
      P.box(3, 7, 0, 10, 2, 20, { t: '#3a2a24', l: '#2a2b33', r: '#1c1d22' }, false);
      P.left(4, 3, 8, 14, '#1f2a24', 9);
      P.left(5, 13, 6, 1, '#f4efe4', 9.5);
      P.left(5, 10, 4, 1, '#ffd65a', 9.5);
      P.left(5, 7, 5, 1, '#f4efe4', 9.5);
    } },
    watertank: { w: 1, d: 1, h: 46, draw: (P) => {
      for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) P.box(x, y, 0, 1, 1, 14, '#4a4f5e', false);
      P.box(2, 2, 14, 12, 12, 2, '#5a6075', false);
      P.disc(8, 8, 18, 6, '#9aa6b8');
      P.box(2, 2, 16, 12, 12, 20, { t: '#b8c2d0', l: '#9aa6b8', r: '#7f8a9c' }, false);
      P.left(2, 22, 12, 1, '#7f8a9c', 14);
      P.left(2, 29, 12, 1, '#7f8a9c', 14);
      P.disc(8, 8, 37, 5, '#c9d1dc');
    } },
    antenna: { anim: true, w: 1, d: 1, h: 56, draw: (P, s) => {
      P.box(6, 6, 0, 4, 4, 2, '#4a4f5e', false);
      P.box(7, 7, 2, 1, 1, 46, '#6a7080', false);
      for (const z of [24, 34, 42]) P.box(3, 7, z, 10, 1, 1, '#6a7080', false);
      P.dot(7, 7, 49, s.frame % 4 < 2 ? '*#ff5a5a' : '#6a2a2a', 2, 2);
      if (s.frame % 4 < 2) P.glow(7, 7, 49, 6, 'rgba(255,90,90,0.4)');
    } },
    books: { w: 1, d: 1, h: 14, draw: (P) => {
      const c = ['#c2453f', '#5aa7ff', '#7cc47f', '#ffd65a', '#c27bff'];
      for (let i = 0; i < 5; i++) P.box(4 + (i % 2), 5 - (i % 2), i * 2.4, 8, 6, 2.4, c[i], false);
      P.box(11, 9, 0, 3, 3, 6, '#e8e4d8', false);
    } },
    palm: { w: 1, d: 1, h: 96, draw: (P, s) => {
      // A ringed trunk leaning out, a crown of drooping fronds and coconuts.
      for (let i = 0; i < 14; i++) {
        const lean = i * i * 0.03;
        P.box(6 + lean, 6, i * 5, 4, 4, 5, i % 2 ? { t: '#a8865a', l: '#8a6a44', r: '#6e5236' } : { t: '#bf9c6c', l: '#a07e54', r: '#7e6040' }, false);
      }
      const cx = 6 + 13 * 13 * 0.03 + 2;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.3;
        for (let j = 1; j < 11; j++) P.disc(cx + Math.cos(a) * j * 1.5, 8 + Math.sin(a) * j * 1.1, 72 - j * j * 0.18, Math.max(0.8, 2.4 - j * 0.15), k % 2 ? '#3f8a3a' : j % 3 ? '#56a64a' : '#6fbf5a');
      }
      for (const [dx, dy] of [[-1, 1], [1, 2], [0, -1]]) P.disc(cx + dx, 8 + dy, 68, 1.6, '#6e4a2a');
      if (s.weather === 'snow') P.disc(cx, 8, 74, 3, '#eef3fa');
    } },
    umbrella: { w: 1, d: 1, h: 46, draw: (P) => {
      P.box(7, 7, 0, 2, 2, 36, '#e8e4d8', false);
      // A canopy rising to a point, in eight panels of red and white.
      for (let r = 10; r >= 0; r -= 0.5) {
        for (let a = 0; a < Math.PI * 2; a += 0.6 / Math.max(1, r)) {
          const panel = Math.floor(((a + 0.2) / (Math.PI * 2)) * 8) % 2;
          P.disc(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, 34 + (10 - r) * 0.7, 0.9, panel ? '#f4efe4' : '#e24a4a');
        }
      }
      P.disc(8, 8, 41.5, 1.2, '#e8e4d8');
    } },
    lounger: { w: 1, d: 1, h: 18, station: 'rest', stations: front(1, 1), draw: (P) => {
      for (const [x, y] of [[3, 3], [12, 3], [3, 13], [12, 13]]) P.box(x, y, 0, 1, 1, 4, '#6e4a2a', false);
      P.box(2, 4, 4, 12, 10, 2, { t: '#4fb3d9', l: '#3a8fb0', r: '#2e7290' }, false);
      for (let y = 5; y < 14; y += 3) P.top(2, y, 12, 1, '#f4efe4', 6);
      P.box(2, 2, 6, 12, 3, 9, { t: '#4fb3d9', l: '#3a8fb0', r: '#2e7290' }, false);
      P.box(4, 8, 6, 5, 3, 2, '#f4efe4', false);
    } },
    surfboard: { w: 1, d: 1, h: 40, draw: (P) => {
      // Stood on its tail against the wall behind it.
      for (let v = 0; v < 34; v++) {
        const half = v < 4 ? 1 + v * 0.6 : v > 26 ? Math.max(0.5, (34 - v) * 0.45) : 3.5;
        P.left(8 - half, v, half * 2, 1, v % 9 === 4 ? '#ffd65a' : '#4fb3d9', 3);
      }
      P.left(7, 2, 2, 30, 'rgba(255,255,255,0.35)', 3.1);
    } },
    tiki: { anim: true, w: 1, d: 1, h: 46, draw: (P, s) => {
      P.box(7, 7, 0, 2, 2, 32, { t: '#c9a06a', l: '#a8865a', r: '#8a6a44' }, false);
      for (const v of [8, 18, 26]) P.box(6.5, 6.5, v, 3, 3, 1, '#6e4a2a', false);
      P.box(5.5, 5.5, 32, 5, 5, 3, '#6e4a2a', false);
      const f = s.frame % 3;
      P.dot(7, 7, 38 + f, '*#ffd65a', 2, 3);
      P.dot(6 + f % 2, 7, 37, '*#ff8a3a', 3, 2);
      P.glow(8, 8, 37, 18, 'rgba(255,170,90,0.5)');
      P.glow(8, 8, 0, 22, 'rgba(255,170,90,0.25)', true);
    } },
    campfire: { anim: true, w: 1, d: 1, h: 26, draw: (P, s) => {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P.disc(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 1.5, 2, k % 2 ? '#8a8478' : '#77736a'); }
      P.box(3, 7, 1, 10, 2, 2, { t: '#8a5a36', l: '#6e4428', r: '#55331d' }, false);
      P.box(7, 3, 1, 2, 10, 2, { t: '#8a5a36', l: '#6e4428', r: '#55331d' }, false);
      // Flames flicker through three shapes.
      const f = s.frame % 3;
      P.disc(8, 8, 5, 3.5 - f * 0.4, '*#ff8a3a');
      P.disc(8 - (f === 1 ? 1 : 0), 8, 8 + f, 2.4, '*#ffb347');
      P.disc(8 + (f === 2 ? 1 : 0), 8, 11 + f, 1.4, '*#ffe28a');
      P.dot(6 + f * 2, 8, 15 + f * 2, '*#ffd65a', 1, 1);
      P.glow(8, 8, 8, 22, 'rgba(255,150,70,0.55)');
      P.glow(8, 8, 0, 30, 'rgba(255,150,70,0.3)', true);
    } },
    logpile: { w: 1, d: 1, h: 16, draw: (P) => {
      const end = { t: '#9a6a40', l: '#8a5a36', r: '#d9b07a' };
      for (const [y, z] of [[3, 0], [8, 0], [5.5, 4.5], [10.5, 4.5], [8, 9]]) {
        if (y > 12) continue;
        P.box(1, y, z, 14, 4, 4, end, false);
        P.right(y + 3, z + 1, 2, 2, '#b8875a', 15);
      }
    } },
    mushroom: { w: 1, d: 1, h: 14, draw: (P) => {
      for (const [x, y, hgt, r] of [[5, 6, 6, 3.2], [10, 9, 4, 2.4], [7, 11, 3, 1.8]]) {
        P.box(x - 0.5, y - 0.5, 0, 1.5, 1.5, hgt, '#f4efe4', false);
        P.disc(x, y, hgt + 1, r, '#d9413a');
        P.dot(x - 1, y, hgt + 2, '#ffffff', 1, 1);
        P.dot(x + 1, y - 1, hgt + 1.5, '#ffffff', 1, 1);
      }
    } },
    lantern: { anim: true, w: 1, d: 1, h: 46, draw: (P, s) => {
      P.box(7, 7, 0, 2, 2, 38, '#3a3f50', false);
      P.box(7, 7, 38, 6, 2, 1, '#3a3f50', false);
      P.box(10, 7, 26, 4, 4, 8, '#2e3240', false);
      const on = s.hour >= 17 || s.hour < 7;
      P.left(10.5, 27, 3, 6, on ? '*#ffd27a' : '#c9b48a', 11.5);
      P.glow(12, 9, 30, on ? 22 : 10, on ? 'rgba(255,200,120,0.5)' : 'rgba(255,200,120,0.12)');
      if (on) P.glow(12, 9, 0, 24, 'rgba(255,200,120,0.25)', true);
    } },
    waterfall: { anim: true, w: 1, d: 1, h: 52, onWater: true, draw: (P, s) => {
      // Water spills over a mossy lip from the ground behind, down into the pool, and foams.
      P.box(1, 0, 32, 14, 3, 2, { t: '#6fa85a', l: '#77736a', r: '#5a564e' }, false);
      for (let v = 0; v < 34; v++) {
        const k = (v + s.frame * 3) % 8;
        P.left(2, v - 2, 12, 1, k < 2 ? 'rgba(240,252,255,0.92)' : k < 5 ? 'rgba(130,205,240,0.88)' : 'rgba(95,175,230,0.88)', 2.5);
        if ((v + s.frame * 2) % 11 === 0) P.left(4 + (v % 5), v - 2, 1, 2, 'rgba(255,255,255,0.95)', 2.6);
      }
      for (let i = 0; i < 6; i++) P.disc(3 + i * 2.2, 5 + (i % 2), 0.5, 2.4, 'rgba(255,255,255,0.85)');
      P.dot(4 + ((s.frame * 5) % 9), 6, 3 + (s.frame % 3) * 2, '#ffffff', 1, 1);
    } },
    // Wall-mounted: mount height z, drawn on the plane y = 0; `top` is the highest point drawn.
    hangplant: { w: 1, d: 0, h: 60, top: 58, wall: true, z: 30, draw: (P) => {
      P.box(7, 0, 54, 2, 5, 1, '#5a4a3a', false);
      P.box(8, 4, 42, 1, 1, 12, '#c9a06a', false);
      P.box(5, 2, 34, 6, 5, 7, { t: '#c97a4a', l: '#b5693d', r: '#93522e' }, false);
      P.disc(8, 5, 42, 4, '#4f8f45');
      P.disc(6, 5, 44, 2.5, '#62a656');
      for (const [u, len] of [[5, 12], [9, 16], [11, 9]]) for (let v = 0; v < len; v++) P.left(u + (v % 4 === 0 ? 1 : 0), 34 - v, 1, 1, v % 3 ? '#4f8f45' : '#7cbf6a', 6.5);
    } },
    walllamp: { anim: true, w: 1, d: 0, h: 50, top: 46, wall: true, z: 28, draw: (P, s) => {
      P.box(7, 0, 34, 2, 4, 1, '#3a3f50', false);
      P.box(5, 3, 28, 6, 4, 8, '#2e3240', false);
      P.left(6, 29, 4, 6, s.hour >= 17 || s.hour < 7 ? '*#ffe7a8' : '#d9c9a0', 7.5);
      P.box(5, 3, 36, 6, 4, 2, '#2e3240', false);
      P.glow(8, 6, 32, 16, 'rgba(255,214,140,0.45)');
      P.glow(8, 14, 0, 20, 'rgba(255,214,140,0.2)', true);
    } },
    meter: { w: 1, d: 0, h: 34, top: 30, wall: true, z: 10, draw: (P) => {
      P.box(3, 0, 12, 10, 3, 14, { t: '#9aa0aa', l: '#8a909c', r: '#6e7480' }, false);
      P.left(5, 19, 6, 4, '#e8e4d8', 3.5);
      P.left(6, 21, 3, 1, '#2a2b33', 3.6);
      P.box(7, 1, 0, 1, 1, 12, '#2a2b33', false);
      P.box(11, 1, 26, 1, 1, 4, '#2a2b33', false);
    } },
    ivy: { w: 1, d: 0, h: 60, top: 56, wall: true, z: 0, draw: (P) => {
      for (let i = 0; i < 16; i++) P.left((i * 5) % 13, 2 + ((i * 11) % 50), 4, 3, ['#3f7a3a', '#4f8f45', '#62a656'][i % 3], 0.6);
      for (let v = 2; v < 52; v += 6) P.left(6 + Math.round(2 * Math.sin(v / 6)), v, 1, 6, '#5a4a2a', 0.5);
    } },
    windowbox: { w: 1, d: 0, h: 36, top: 32, wall: true, z: 14, draw: (P) => {
      P.left(2, 20, 12, 12, '#3a2a24', 0.5);
      P.left(3, 21, 10, 10, '#ffd9a0', 0.6);
      P.left(8, 21, 1, 10, '#3a2a24', 0.7);
      P.box(1, 0, 14, 14, 4, 4, { t: '#5a3a24', l: '#8a5a36', r: '#6e4428' }, false);
      for (let i = 0; i < 4; i++) P.disc(3 + i * 3.4, 2, 19, 2, i % 2 ? '#4f8f45' : '#62a656');
      P.dot(4, 2, 21, '#ff8fb1', 1, 1);
      P.dot(11, 2, 21, '#ffd65a', 1, 1);
    } },
    banner: { w: 1, d: 0, h: 60, top: 56, wall: true, z: 24, draw: (P) => {
      P.box(2, 0, 54, 12, 3, 1, '#5a4a3a', false);
      P.left(4, 26, 8, 28, '#3f7f8a', 2);
      P.left(4, 26, 4, 3, '#f4efe4', 2.1);
      P.left(6, 40, 4, 6, '#ffd65a', 2.1);
    } },
    potions: { anim: true, w: 1, d: 0, h: 60, top: 58, wall: true, z: 30, draw: (P, s) => {
      P.box(1, 0, 34, 14, 6, 2, WOOD, false);
      P.box(1, 0, 46, 14, 6, 2, WOOD, false);
      const cols = ['#7cff8c', '#c27bff', '#ff8fb1', '#7ad1ff'];
      for (let i = 0; i < 3; i++) {
        P.box(2 + i * 4, 2, 36, 3, 3, 5, cols[i], false);
        P.box(3 + i * 4, 2, 48, 2, 2, 6, cols[(i + 1) % 4], false);
      }
      if (s.frame % 4 === 0) P.dot(4, 4, 42, '*#ffffff', 1, 1);
      P.glow(8, 4, 42, 12, 'rgba(194,123,255,0.25)');
    } },
    aircon: { anim: true, w: 1, d: 0, h: 80, top: 76, wall: true, z: 60, draw: (P, s) => {
      P.box(1, 0, 60, 14, 7, 12, '#c9ccd4', false);
      P.top(1, 0, 14, 7, '#e2e4ea', 72);
      for (let v = 62; v < 71; v += 2) P.left(3, v, 8, 1, '#9a9eaa', 7);
      P.disc(12, 7, 66, 2.5, '#8a8e9a');
      P.left(12, 66 - (s.frame % 2), 1, 1, '#5a5e6a', 7.5);
      P.box(13, 2, 46, 1, 1, 14, '#6a7080', false);
    } },
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
      // A striped canvas awning over the door.
      for (let i = 0; i < 4; i++) P.box(i * 4, 0, 31, 4, 7, 2, i % 2 ? '#f4efe4' : '#3f7f8a', false);
      P.left(0, 30, 16, 1, '#2a5a62', 7);
      P.glow(8, 2, 18, 12, 'rgba(255,200,120,0.3)');
    } },
    sign: { w: 1, d: 0, h: 60, top: 54, wall: true, z: 40, draw: (P, s) => {
      P.left(1, 40, 14, 13, '#e8e4d8', 1);
      P.left(2, 41, 12, 11, '#c2453f', 1.5);
      P.left(4, 49, 8, 1, '#ffe9b0', 2);
      P.left(4, 46, 3, 2, '#ffe9b0', 2);
      P.left(9, 46, 3, 2, '#ffe9b0', 2);
      P.left(4, 43, 8, 1, '#ffe9b0', 2);
      if (s.hour >= 18 || s.hour < 6) P.glow(8, 2, 46, 12, 'rgba(255,90,80,0.35)');
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
  // The room is built, not drawn: the player decides the shape and the engine dresses it.
  //   zones: what each layer is - height z, materials, and how it is finished:
  //     kind 'room' grows walls on its back edges, 'outdoor' and 'street' stay open;
  //     thin: a floor on joists over the space below (else a solid brick base to the ground);
  //     rails: railing on open edges; lights: fairy lights on them;
  //   tiles: [x, y, zone] - one per floor tile.
  //   flights: stairs between zones, bottom step first.
  // From these the engine derives everything else (see derive): rects to draw, walls on back
  // edges, brick facades where a floor steps down (wall items can hang on them), railings and
  // shadows. Walls: [plane, at, from, to, height, facade?] - plane 'y' runs along x at y = at
  // (face toward +y), plane 'x' runs along y at x = at (face toward +x).
  const STEP_Z = 32; // heights come in steps of half a storey

  // Blueprints: finished little worlds to start from, like showrooms - shape, materials and
  // furniture - for anyone who would rather move in than build. Zones are given as rects;
  // objects as [zone, type, x, y, flip].
  const BLUEPRINTS = {
    shop: {
      name: '街角小店',
      desc: '墊高一層的磚造小店，樓下是街道，上面有露台、閣樓和屋頂花園',
      zones: [
        { name: '街道', z: 0, kind: 'street', wall: 'brick', floor: 'stone', rects: [[2, 6, 5, 2], [0, 8, 7, 1]] },
        { name: '樓梯平台', z: 32, kind: 'outdoor', wall: 'brick', floor: 'stone', rects: [[0, 6, 2, 2]] },
        { name: '店內', z: 64, kind: 'room', wall: 'brick', floor: 'terra', rects: [[0, 0, 2, 3], [2, 0, 5, 6], [7, 1, 2, 3]] },
        { name: '露台', z: 128, kind: 'outdoor', rails: true, lights: true, wall: 'navy', floor: 'stone', rects: [[0, 3, 2, 3]] },
        { name: '閣樓', z: 128, kind: 'room', thin: true, rails: true, wall: 'cream', floor: 'wood', rects: [[2, 0, 5, 3], [2, 3, 1, 1]] },
        { name: '屋頂花園', z: 192, kind: 'outdoor', thin: true, rails: true, lights: true, wall: 'navy', floor: 'grass', rects: [[3, 0, 3, 2]] },
      ],
      flights: [
        // The front stairs switch back: up from the street to the landing, then on into the shop.
        { from: 0, to: 1, style: 'solid', cells: [[3, 7], [2, 7]], bottom: [4, 7], top: [1, 7] },
        { from: 1, to: 2, style: 'solid', cells: [[2, 6], [3, 6]], bottom: [1, 6], top: [3, 5] },
        // Inside, up the back-left corner onto the terrace.
        { from: 2, to: 3, style: 'open', cells: [[1, 0], [1, 1], [1, 2]], bottom: [2, 0], top: [1, 3] },
        // From the loft up its right side to the garden.
        { from: 4, to: 5, style: 'open', cells: [[6, 2], [6, 1], [6, 0]], bottom: [5, 2], top: [5, 0] },
      ],
      door: [6, 7],
      objects: [
        [0, 'signboard', 3, 8], [0, 'crate', 2, 8], [2, 'stool', 6, 5], [4, 'walllamp', 2, 2, true], [5, 'antenna', 5, 1],
        // Street: a little shop under the big one, two vending machines, a lamp and the bins.
        [0, 'shopdoor', 6, 6], [0, 'sign', 6, 6], [0, 'vending', 4, 6], [0, 'vending', 5, 6],
        [0, 'streetlamp', 6, 8], [0, 'bin', 0, 8], [0, 'plant', 1, 8],
        // Landing: a plant where the stairs turn, the neon sign and an aircon on the block.
        [1, 'plant', 0, 6], [1, 'neon', 0, 6], [1, 'aircon', 1, 6],
        // Shop: workbench along the back, the glowing fridge on the block, counter in the middle.
        [2, 'workstation', 3, 0], [2, 'coffee', 5, 0], [2, 'server', 6, 0], [2, 'screens', 3, 0], [2, 'window', 5, 0],
        [2, 'clock', 2, 0], [2, 'fridge', 2, 4, true], [2, 'poster', 2, 3, true], [2, 'holo', 2, 2], [2, 'bell', 3, 4],
        [2, 'table', 5, 3], [2, 'bookshelf', 7, 1], [2, 'plant', 8, 3], [2, 'plant', 0, 0], [2, 'boxes', 0, 1],
        [2, 'lamp', 0, 2], [2, 'shelf', 0, 0, true],
        // Terrace: a sofa under the sky. Loft: a bed under the garden. Garden: a telescope.
        [3, 'chair', 0, 4], [3, 'plant', 0, 3], [3, 'planter', 0, 5],
        [4, 'bed', 3, 0], [4, 'lamp', 2, 0], [4, 'poster', 2, 1, true], [4, 'window', 3, 0], [4, 'neon', 5, 0],
        [5, 'telescope', 4, 1], [5, 'plant', 3, 0], [5, 'plant', 4, 0], [5, 'catbed', 3, 1],
      ],
    },
    cyber: {
      name: '賽博公寓',
      desc: '霓虹街道上方的公寓，附發光陽台、頂樓、加蓋小房和後巷',
      zones: [
        { name: '街道', z: 0, kind: 'street', wall: 'navy', floor: 'stone', rects: [[0, 5, 8, 3]] },
        { name: '公寓', z: 64, kind: 'room', wall: 'cyber', floor: 'cyber', rects: [[0, 0, 6, 5]] },
        { name: '陽台', z: 64, kind: 'outdoor', rails: true, lights: true, wall: 'synth', floor: 'neon', rects: [[6, 1, 2, 4]] },
        { name: '頂樓', z: 128, kind: 'outdoor', thin: true, rails: true, lights: true, wall: 'synth', floor: 'neon', rects: [[0, 0, 3, 2]] },
        { name: '加蓋小房', z: 128, kind: 'room', thin: true, rails: true, wall: 'synth', floor: 'carpet', rects: [[3, 0, 3, 2]] },
        { name: '後巷', z: 0, kind: 'street', wall: 'navy', floor: 'stone', rects: [[8, 0, 2, 8]] },
      ],
      flights: [
        { from: 0, to: 2, style: 'solid', cells: [[6, 6], [6, 5]], bottom: [6, 7], top: [6, 4] },
        { from: 1, to: 4, style: 'open', cells: [[3, 3], [3, 2]], bottom: [3, 4], top: [3, 1] },
      ],
      door: [1, 7],
      objects: [
        [0, 'meter', 1, 5], [0, 'walllamp', 2, 5], [3, 'watertank', 2, 0], [5, 'barrel', 9, 7], [5, 'crate', 8, 7],
        [0, 'vending', 0, 5], [0, 'shopdoor', 3, 5], [0, 'sign', 3, 5], [0, 'neon', 4, 5], [0, 'streetlamp', 7, 5], [0, 'bin', 5, 5],
        [1, 'workstation', 3, 0], [1, 'server', 5, 0], [1, 'screens', 3, 0], [1, 'bed', 0, 0, true], [1, 'tv', 0, 3, true],
        [1, 'arcade', 5, 2], [1, 'neon', 0, 1, true], [1, 'window', 1, 0], [1, 'poster', 0, 3, true],
        [2, 'bell', 6, 1], [2, 'holo', 7, 3], [2, 'plant', 7, 2],
        [3, 'table', 0, 0],
        [4, 'bookshelf', 3, 0], [4, 'aquarium', 5, 0, true], [4, 'neon', 3, 0],
        [5, 'vending', 8, 0], [5, 'arcade', 9, 0], [5, 'boxes', 8, 3], [5, 'bin', 9, 6], [5, 'streetlamp', 9, 5],
      ],
    },
    lake: {
      name: '湖畔溫室',
      backdrop: 'forest',
      desc: '湖面上的高腳木平台，兩間玻璃溫室種滿植物，還有釣魚碼頭和屋頂露台',
      zones: [
        { name: '湖', z: 0, kind: 'water', depth: 40, wall: 'brick', floor: 'stone', rects: [[0, 0, 9, 9]] },
        { name: '下層平台', z: 24, kind: 'outdoor', thin: true, base: 'stilts', rails: true, wall: 'wood', floor: 'plank', rects: [[2, 5, 4, 3]] },
        { name: '木平台', z: 48, kind: 'outdoor', thin: true, base: 'stilts', rails: true, wall: 'wood', floor: 'plank', rects: [[3, 0, 3, 3], [0, 3, 6, 2]] },
        { name: '溫室', z: 48, kind: 'room', thin: true, base: 'stilts', wall: 'glass', floor: 'plank', rects: [[0, 0, 3, 3]] },
        { name: '側翼溫室', z: 48, kind: 'room', thin: true, base: 'stilts', wall: 'glass', floor: 'plank', rects: [[6, 0, 3, 3]] },
        { name: '釣魚碼頭', z: 24, kind: 'outdoor', thin: true, base: 'stilts', rails: true, lights: true, wall: 'wood', floor: 'plank', rects: [[6, 3, 3, 4]] },
        { name: '屋頂露台', z: 112, kind: 'outdoor', thin: true, rails: true, lights: true, wall: 'wood', floor: 'plank', rects: [[0, 0, 4, 2]] },
      ],
      flights: [
        { from: 1, to: 2, style: 'open', cells: [[3, 5]], bottom: [3, 6], top: [3, 4] },
        { from: 2, to: 6, style: 'open', cells: [[3, 3], [3, 2]], bottom: [3, 4], top: [3, 1] },
      ],
      door: [5, 7, 1],
      objects: [
        [5, 'barrel', 8, 4], [3, 'walllamp', 2, 0], [4, 'walllamp', 8, 0],
        [0, 'lilypad', 0, 6], [0, 'lilypad', 1, 7], [0, 'lilypad', 7, 7], [0, 'lilypad', 8, 2], [0, 'boat', 5, 8],
        [3, 'lamp', 0, 0], [3, 'bookshelf', 1, 0], [3, 'desk', 0, 1, true],
        [2, 'table', 4, 0], [2, 'coffee', 0, 3, true], [2, 'plant', 0, 4],
        [1, 'sofa', 2, 6, true], [1, 'bush', 2, 5], [1, 'bell', 4, 5],
        [4, 'planter', 6, 0], [4, 'plant', 8, 0], [4, 'planter', 7, 2],
        [5, 'streetlamp', 8, 6], [5, 'boxes', 8, 3], [5, 'plant', 8, 5],
        [6, 'telescope', 0, 0], [6, 'plant', 2, 0],
      ],
    },
    beach: {
      name: '熱帶海邊小屋',
      backdrop: 'beach',
      desc: '白沙灘上的竹子高腳屋，椰子樹、陽傘和躺椅，木棧橋一路伸進藍綠色的淺海',
      zones: [
        { name: '沙灘', z: 16, kind: 'outdoor', base: 'earth', wall: 'bamboo', floor: 'sand', rects: [[0, 0, 5, 6]] },
        { name: '海', z: 0, kind: 'water', depth: 40, wall: 'bamboo', floor: 'sand', rects: [[5, 0, 4, 9], [0, 6, 5, 3]] },
        { name: '竹屋', z: 48, kind: 'room', thin: true, base: 'stilts', wall: 'bamboo', floor: 'plank', rects: [[5, 0, 4, 3]] },
        { name: '露台', z: 48, kind: 'outdoor', thin: true, base: 'stilts', rails: true, lights: true, wall: 'bamboo', floor: 'plank', rects: [[5, 3, 4, 3]] },
        { name: '棧橋', z: 24, kind: 'outdoor', thin: true, base: 'stilts', rails: true, wall: 'bamboo', floor: 'plank', rects: [[5, 6, 2, 3]] },
      ],
      flights: [
        { from: 0, to: 3, style: 'open', cells: [[4, 4]], bottom: [3, 4], top: [5, 4] },
        { from: 4, to: 3, style: 'open', cells: [[5, 6]], bottom: [5, 7], top: [5, 5] },
      ],
      door: [0, 5],
      objects: [
        // Beach: palms, a parasol over two loungers, a board and torches.
        [0, 'palm', 0, 0], [0, 'palm', 2, 5], [0, 'umbrella', 1, 2], [0, 'lounger', 1, 3], [0, 'lounger', 2, 3],
        [0, 'surfboard', 0, 2], [0, 'tiki', 2, 1], [0, 'tiki', 4, 5],
        // Sea: a little boat.
        [1, 'boat', 1, 7],
        // Hut: desk and coffee on the back wall, a sofa looking out.
        [2, 'desk', 5, 0], [2, 'coffee', 7, 0], [2, 'books', 8, 0], [2, 'sofa', 7, 2], [2, 'window', 6, 0],
        [2, 'walllamp', 5, 1, true],
        // Deck: a table in the breeze, a torch at the corner. Pier: a lantern at the end.
        [3, 'table', 7, 4], [3, 'tiki', 8, 3],
        [4, 'lantern', 6, 8],
      ],
    },
    cabin: {
      name: '森林溫馨木屋',
      backdrop: 'forest',
      desc: '森林裡的圓木小屋，屋前有營火和門廊，後面的小山丘有瀑布流進池塘',
      zones: [
        { name: '草地', z: 0, kind: 'outdoor', base: 'earth', wall: 'stone', floor: 'grass', rects: [[0, 0, 1, 9], [1, 5, 5, 4], [6, 6, 3, 3]] },
        { name: '木屋', z: 16, kind: 'room', wall: 'log', floor: 'wood', rects: [[1, 0, 5, 4]] },
        { name: '門廊', z: 16, kind: 'outdoor', rails: true, lights: true, wall: 'log', floor: 'plank', rects: [[1, 4, 5, 1]] },
        { name: '閣樓', z: 80, kind: 'room', thin: true, rails: true, wall: 'log', floor: 'carpet', rects: [[1, 0, 4, 2]] },
        { name: '山丘', z: 32, kind: 'outdoor', base: 'earth', wall: 'stone', floor: 'grass', rects: [[6, 0, 3, 3]] },
        { name: '池塘', z: 0, kind: 'water', depth: 32, wall: 'stone', floor: 'stone', rects: [[6, 3, 3, 3]] },
      ],
      flights: [
        { from: 0, to: 2, style: 'solid', cells: [[3, 5]], bottom: [3, 6], top: [3, 4] },
        { from: 1, to: 3, style: 'open', cells: [[4, 2]], bottom: [4, 3], top: [4, 1] },
        { from: 1, to: 4, style: 'solid', cells: [[5, 1]], bottom: [4, 1], top: [6, 1] },
      ],
      door: [0, 8],
      objects: [
        // Yard: trees and mushrooms at the edge, a campfire with stools, the woodpile, a lantern.
        [0, 'tree', 0, 0], [0, 'mushroom', 8, 6], [0, 'bush', 0, 6], [0, 'campfire', 2, 7],
        [0, 'stool', 1, 7], [0, 'stool', 3, 7], [0, 'logpile', 5, 5], [0, 'lantern', 6, 6], [0, 'tree', 8, 8],
        [0, 'bush', 7, 8], [0, 'mushroom', 6, 8],
        // Cabin: the fire on the back wall, books, a desk under the loft, a table by the window.
        [1, 'fireplace', 1, 0], [1, 'desk', 3, 0], [1, 'bookshelf', 1, 2, true], [1, 'coffee', 5, 2],
        [1, 'lamp', 5, 0], [1, 'catbed', 2, 3], [1, 'window', 3, 0], [1, 'walllamp', 1, 1, true], [1, 'hangplant', 5, 0],
        // Porch: a chair, a plant and a lantern.
        [2, 'chair', 1, 4], [2, 'plant', 2, 4], [2, 'lantern', 5, 4],
        // Loft: the sofa under the roof.
        [3, 'sofa', 1, 0], [3, 'catbed', 3, 0], [3, 'window', 2, 0], [3, 'walllamp', 1, 1, true],
        // Hill: a tree and the telescope. Pond: the waterfall and lily pads.
        [4, 'tree', 8, 0], [4, 'bush', 8, 2], [4, 'telescope', 7, 0], [4, 'mushroom', 6, 0],
        [5, 'waterfall', 7, 3], [5, 'lilypad', 6, 5], [5, 'lilypad', 8, 4],
      ],
    },
  };

  // Split a set of tiles ("x,y") into rects, greedily: widest run first, then as deep as it goes.
  function toRects(tiles) {
    const left = new Set(tiles);
    const rects = [];
    const sorted = [...left].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, y] of sorted) {
      if (!left.has(`${x},${y}`)) continue;
      let w = 1;
      while (left.has(`${x + w},${y}`)) w++;
      let d = 1;
      while (Array.from({ length: w }, (_, i) => `${x + i},${y + d}`).every((k) => left.has(k))) d++;
      for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) left.delete(`${x + i},${y + j}`);
      rects.push([x, y, w, d]);
    }
    return rects;
  }

  // Merge unit edges [plane, at, u, ...rest] into runs along u.
  function runs(edges) {
    const groups = new Map();
    for (const [plane, at, u, ...rest] of edges) {
      const key = JSON.stringify([plane, at, ...rest]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(u);
    }
    const out = [];
    for (const [key, us] of groups) {
      const [plane, at, ...rest] = JSON.parse(key);
      us.sort((a, b) => a - b);
      let start = us[0];
      for (let i = 1; i <= us.length; i++) {
        if (us[i] === us[i - 1] + 1) continue;
        out.push([plane, at, start, us[i - 1] + 1, ...rest]);
        start = us[i];
      }
    }
    return out;
  }

  // Everything drawable and walkable, worked out from zones, tiles and flights.
  function derive(room) {
    const hash = JSON.stringify([room.zones, room.tiles, room.flights, room.door]);
    if (room._derived?.hash === hash) return room._derived;
    const zones = room.zones || [];
    const byZone = zones.map(() => []);
    const at = new Map(); // "x,y" -> [{ zone, z }]
    for (const [x, y, f] of room.tiles || []) {
      if (!zones[f]) continue;
      byZone[f].push(`${x},${y}`);
      const k = `${x},${y}`;
      if (!at.has(k)) at.set(k, []);
      at.get(k).push({ f, z: zones[f].z });
    }
    // Which zones each stair tile serves.
    const stairAt = new Map();
    for (const fl of room.flights || []) for (const [x, y] of fl.cells) stairAt.set(`${x},${y}`, [...(stairAt.get(`${x},${y}`) || []), fl.from, fl.to]);
    const tilesAt = (x, y) => at.get(`${x},${y}`) || [];
    const areas = zones.map((zn, f) => {
      const mine = new Set(byZone[f]);
      const edges = [];
      for (const k of mine) {
        const [x, y] = k.split(',').map(Number);
        // Back edges of a room get walls, unless the floor carries on (same height), the space
        // behind is a raised block (its facade is the wall) or a stair leads off there.
        if (zn.kind === 'room') {
          for (const [dx, dy, plane, atv, u] of [[-1, 0, 'x', x, y], [0, -1, 'y', y, x]]) {
            const nb = tilesAt(x + dx, y + dy);
            if (mine.has(`${x + dx},${y + dy}`) || (stairAt.get(`${x + dx},${y + dy}`) || []).includes(f)) continue;
            if (nb.some((t) => t.z >= zn.z && !zones[t.f].thin)) continue;
            if (nb.some((t) => t.z === zn.z && zones[t.f].kind !== 'water')) continue;
            edges.push([plane, atv, u, zn.wallH || WALL_H]);
          }
        }
      }
      return { ...zn, rects: toRects(mine), walls: runs(edges) };
    });
    // Facades: the front faces of solid bases, down to whatever floor lies in front. They belong
    // to the zone in front, so wall items there are placed from that zone.
    const facadeEdges = zones.map(() => []);
    zones.forEach((zn, f) => {
      if (zn.thin || zn.z <= 0) return;
      for (const k of byZone[f]) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy, plane, atv, u] of [[1, 0, 'x', x + 1, y], [0, 1, 'y', y + 1, x]]) {
          const nb = tilesAt(x + dx, y + dy).filter((t) => t.z < zn.z && !zones[t.f].thin).sort((a, b) => b.z - a.z)[0];
          if (!nb || byZone[f].includes(`${x + dx},${y + dy}`)) continue;
          facadeEdges[nb.f].push([plane, atv, u, zn.z - nb.z, 'facade']);
        }
      }
    });
    areas.forEach((a, f) => { a.walls = a.walls.concat(runs(facadeEdges[f])); });
    // Heights of the solid things around each tile, for railings and shadows.
    const higher = (x, y, z) => tilesAt(x, y).some((t) => t.z > z && !zones[t.f].thin);
    let id = 5381;
    for (let i = 0; i < hash.length; i++) id = ((id * 33) ^ hash.charCodeAt(i)) >>> 0;
    const out = { hash, id: id.toString(36), areas, flights: room.flights || [], door: room.door || [0, 0], tilesAt, higher };
    Object.defineProperty(room, '_derived', { value: out, enumerable: false, configurable: true, writable: true });
    return out;
  }
  const layoutOf = (room) => derive(room);

  // A blueprint's zones/tiles/flights, ready to be a room.
  function fromSpec(bp) {
    return {
      zones: bp.zones.map(({ rects, ...zn }) => ({ ...zn })),
      tiles: bp.zones.flatMap(({ rects }, f) => rects.flatMap(([x, y, w, d]) => {
        const out = [];
        for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j, f]);
        return out;
      })),
      flights: JSON.parse(JSON.stringify(bp.flights)),
      door: [...bp.door],
    };
  }

  // Rooms saved before the grid (iso 4) were the street corner: keep their furniture and materials.
  function migrate(room) {
    if (room?.iso === 5) return room;
    if (room?.iso !== 4) return null;
    const out = { iso: 5, blueprint: 'shop', ...fromSpec(BLUEPRINTS.shop), objects: room.objects || [] };
    out.zones.forEach((zn, i) => { if (room.floors?.[i]) Object.assign(zn, { wall: room.floors[i].wall, floor: room.floors[i].floor }); });
    return out;
  }

  const levels = (room) => (room.zones || []).length;
  const floorZ = (room, f) => room.zones?.[f]?.z || 0;
  const floorOf = (room, f) => room.zones?.[f] || { wall: 'brick', floor: 'stone' };

  // Every place a character can stand: open area tiles and each step of every open flight.
  function cells(room) {
    const key = layoutOf(room).id;
    if (room._cells && room._cells.key === key) return room._cells;
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
    // A stair tile takes the place of the floor at its foot; solid steps, built up from the
    // ground, also take any lower floor beneath them.
    const taken = (x, y, f) => L.flights.some((fl) => fl.cells.some(([cx, cy]) => cx === x && cy === y)
      && (fl.style === 'solid' ? L.areas[f].z <= L.areas[fl.from].z : L.areas[f].z >= L.areas[fl.from].z && L.areas[f].z < L.areas[fl.to].z));
    L.areas.forEach((a, f) => {
      if (a.kind === 'water') return;
      for (const r of a.rects) {
        for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) {
          if (!taken(x, y, f)) add({ x, y, z: a.z, f, kind: 'floor' });
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
    // Side by side at the same height joins, even across areas (terrace to loft).
    for (const c of [...list]) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) for (const o of at.get(`${c.x + dx},${c.y + dy}`) || []) if (o.kind === 'floor' && o.z === c.z) link(c, o);
    }
    for (const fl of L.flights) {
      const z0 = L.areas[fl.from].z;
      const z1 = L.areas[fl.to].z;
      const rise = (z1 - z0) / (fl.cells.length + 1);
      let prev = floorAt(fl.bottom[0], fl.bottom[1], fl.from);
      // Treads face the way the flight climbs.
      const [c0, c1 = fl.top] = fl.cells;
      const dir = c1[0] !== c0[0] ? 'x' : 'y';
      const up = Math.sign(dir === 'x' ? c1[0] - c0[0] : c1[1] - c0[1]) || -1;
      fl.cells.forEach(([x, y], k) => {
        // Solid steps stand on the ground; open treads hang one rise deep.
        // The treads drawn on this tile run from `span[0]` to `span[1]`: the whole flight climbs from
        // the floor at its foot to the floor at its head with no step missing at either end.
        const span = [z0 + ((z1 - z0) * k) / fl.cells.length, z0 + ((z1 - z0) * (k + 1)) / fl.cells.length];
        const c = add({ x, y, z: z0 + rise * (k + 1), f: fl.from, kind: 'stair', rise, dir, up, span, style: fl.style, base: fl.style === 'solid' ? 0 : z0, from: fl.bottom, to: fl.top });
        link(prev, c);
        prev = c;
      });
      link(prev, floorAt(fl.top[0], fl.top[1], fl.to));
    }
    Object.defineProperty(room, '_cells', { value: { list, at, links, key }, enumerable: false, configurable: true });
    return room._cells;
  }
  const resetCells = (room) => { delete room._cells; };
  const cellAt = (room, x, y, f) => (cells(room).at.get(`${x},${y}`) || []).find((c) => c.kind === 'floor' && c.f === f) || null;
  const neighbours = (room, c) => cells(room).links.get(c.id) || [];
  const door = (room) => { const [x, y, f = 0] = layoutOf(room).door; return cellAt(room, x, y, f); };

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
      // Wall items may share a stretch of wall when one hangs above the other.
      return room.objects.every((o, i) => {
        const od = OBJECTS[o.type];
        if (i === ignoreIndex || !od?.wall || !!o.flip !== !!flip || (o.f || 0) !== f) return true;
        if ((flip ? o.x : o.y) !== (flip ? x : y)) return true;
        if ((od.top || 60) <= def.z || (def.top || 60) <= od.z) return true;
        const oa = o.flip ? o.y : o.x;
        return along + def.w <= oa || oa + od.w <= along;
      });
    }
    const lay = layoutOf(room);
    for (let ty = fp.y; ty < fp.y + fp.d; ty++) {
      for (let tx = fp.x; tx < fp.x + fp.w; tx++) {
        const ok = def.onWater
          ? lay.areas[f]?.kind === 'water' && lay.tilesAt(tx, ty).some((t) => t.f === f)
          : cellAt(room, tx, ty, f);
        if (!ok) return false;
      }
    }
    return room.objects.every((o, i) => {
      const od = OBJECTS[o.type];
      if (i === ignoreIndex || !od || od.wall || !!od.flat !== !!def.flat || (o.f || 0) !== f) return true;
      const g = footprint(o);
      return fp.x + fp.w <= g.x || g.x + g.w <= fp.x || fp.y + fp.d <= g.y || g.y + g.d <= fp.y;
    });
  }

  // Walkable cells (ids), with furniture taken out.
  // Tiles under a deck where one of its posts stands (matching stiltPosts), by height of the deck.
  function postTiles(room) {
    const out = [];
    layoutOf(room).areas.forEach((a) => {
      if (!a.thin || a.base !== 'stilts') return;
      for (const [x0, y0, w, d] of a.rects) {
        const cols = [];
        for (let x = 0; x <= w; x += 2) cols.push(Math.min(x, w - 1));
        cols.push(w - 1);
        for (const x of cols) out.push([x0 + x, y0 + d - 1, a.z]);
        for (let y = 0; y < d; y += 2) out.push([x0 + w - 1, y0 + y, a.z]);
      }
    });
    return out;
  }

  function walkable(room) {
    const blocked = new Set();
    for (const [x, y, z] of postTiles(room)) {
      for (const c of cells(room).at.get(`${x},${y}`) || []) if (c.kind === 'floor' && c.z < z) blocked.add(c.id);
    }
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

  // The default room, furnished on every layer; locked layers keep their furniture for later.
  // A fresh room from a blueprint, furnished on every layer; locked layers keep their furniture.
  function generateRoom(id = 'shop') {
    const bp = BLUEPRINTS[id] || BLUEPRINTS.shop;
    const room = { iso: 5, blueprint: BLUEPRINTS[id] ? id : 'shop', backdrop: bp.backdrop || null, ...fromSpec(bp), objects: [] };
    for (const [f, type, x, y, flip = false] of bp.objects) {
      if (canPlace(room, type, x, y, flip, f)) room.objects.push({ type, x, y, flip, f });
    }
    resetCells(room);
    return room;
  }

  // ---- Building -----------------------------------------------------------------------
  // Terrain edits for the editor. Each returns an error message, or null when it worked.
  const LAND = 12; // tiles each way the room may spread over
  const ZONE_KINDS = {
    room: { name: '室內', kind: 'room' },
    outdoor: { name: '戶外', kind: 'outdoor', rails: true },
    loft: { name: '閣樓', kind: 'room', thin: true, rails: true },
  };

  // The tile under a screen point (fine px) on the plane z.
  function pick(room, fx, fy, z) {
    const o = origin(room);
    const sx = fx - o.x;
    const s2 = (fy - o.y + z) * 2;
    return { x: Math.floor((s2 + sx) / 2 / TU), y: Math.floor((s2 - sx) / 2 / TU) };
  }

  const tileIndex = (room, x, y, f) => room.tiles.findIndex((t) => t[0] === x && t[1] === y && t[2] === f);

  function addZone(room, type, z) {
    const k = ZONE_KINDS[type] || ZONE_KINDS.outdoor;
    const like = room.zones.find((zn) => zn.kind === k.kind) || room.zones[0];
    const n = room.zones.filter((zn) => zn.name.startsWith(k.name)).length + 1;
    room.zones.push({ ...k, name: `${k.name} ${n}`, z: Math.max(STEP_Z, z), wall: like?.wall || 'brick', floor: like?.floor || 'stone' });
    return room.zones.length - 1;
  }

  // Lay a floor tile of zone f at (x, y). A solid floor buries any lower floor in its column;
  // nothing can go under a solid floor.
  function addTile(room, x, y, f) {
    const zn = room.zones[f];
    if (!zn) return '沒有這一層';
    if (x < 0 || y < 0 || x >= LAND || y >= LAND) return '超出土地範圍';
    if (tileIndex(room, x, y, f) >= 0) return null;
    const column = room.tiles.filter((t) => t[0] === x && t[1] === y);
    if (column.some((t) => room.zones[t[2]].z > zn.z && !room.zones[t[2]].thin)) return '上面有實心的地基，蓋不進去';
    room.tiles = room.tiles.filter((t) => !(t[0] === x && t[1] === y && (room.zones[t[2]].z === zn.z || (!zn.thin && room.zones[t[2]].z < zn.z))));
    room.tiles.push([x, y, f]);
    tidy(room);
    return null;
  }

  function removeTile(room, x, y, f) {
    const i = tileIndex(room, x, y, f);
    if (i < 0) return null;
    room.tiles.splice(i, 1);
    tidy(room);
    return null;
  }

  // Stairs in a straight line from tile a to tile b on different heights; the steps fill the
  // tiles between. Solid stone outdoors, open metal treads indoors.
  function addFlight(room, a, b) {
    const za = room.zones[a.f]?.z;
    const zb = room.zones[b.f]?.z;
    if (za === undefined || zb === undefined || za === zb) return '樓梯要連接兩個不同高度的地方';
    if (tileIndex(room, a.x, a.y, a.f) < 0 || tileIndex(room, b.x, b.y, b.f) < 0) return '樓梯兩端都要是地板';
    const [lo, hi] = za < zb ? [a, b] : [b, a];
    if (lo.x !== hi.x && lo.y !== hi.y) return '樓梯要走直線：兩端要在同一排';
    const n = Math.abs(hi.x - lo.x) + Math.abs(hi.y - lo.y) - 1;
    const dz = Math.abs(zb - za);
    if (n < 1 || dz / (n + 1) > STEP_Z) return `太陡了：這個高度至少要隔 ${Math.ceil(dz / STEP_Z)} 格`;
    const dx = Math.sign(hi.x - lo.x);
    const dy = Math.sign(hi.y - lo.y);
    const cells = Array.from({ length: n }, (_, k) => [lo.x + dx * (k + 1), lo.y + dy * (k + 1)]);
    const used = new Set(room.flights.flatMap((fl) => fl.cells.map((c) => `${c}`)));
    if (cells.some((c) => used.has(`${c}`))) return '這裡已經有樓梯了';
    const from = room.zones[lo.f];
    const style = !from.thin && from.kind !== 'room' ? 'solid' : 'open';
    room.flights.push({ from: lo.f, to: hi.f, style, cells, bottom: [lo.x, lo.y], top: [hi.x, hi.y] });
    tidy(room);
    return null;
  }

  function removeFlightAt(room, x, y) {
    const before = room.flights.length;
    room.flights = room.flights.filter((fl) => !fl.cells.some(([cx, cy]) => cx === x && cy === y));
    if (room.flights.length !== before) tidy(room);
    return room.flights.length !== before;
  }

  function setZoneZ(room, f, z) {
    const zn = room.zones[f];
    if (!zn) return '沒有這一層';
    z = Math.max(f === 0 ? 0 : STEP_Z, Math.min(8 * STEP_Z, Math.round(z / STEP_Z) * STEP_Z));
    if (zn.z === z) return null;
    zn.z = z;
    tidy(room);
    return null;
  }

  // After an edit: drop stairs whose ends are gone or too steep, furniture that no longer fits,
  // and keep the street door on a real tile.
  function tidy(room) {
    resetCells(room);
    const has = (x, y, f) => tileIndex(room, x, y, f) >= 0;
    room.flights = room.flights.filter((fl) => has(fl.bottom[0], fl.bottom[1], fl.from) && has(fl.top[0], fl.top[1], fl.to)
      && Math.abs(room.zones[fl.to].z - room.zones[fl.from].z) / (fl.style === 'spiral' ? 5 : fl.cells.length + 1) <= STEP_Z + 1);
    resetCells(room);
    room.objects = room.objects.filter((o, i) => canPlace(room, o.type, o.x, o.y, o.flip, o.f || 0, i));
    if (!has(room.door[0], room.door[1], 0)) {
      const t = room.tiles.filter((tt) => tt[2] === 0).sort((p, q) => (q[0] + q[1]) - (p[0] + p[1]))[0];
      if (t) room.door = [t[0], t[1]];
    }
    resetCells(room);
  }

  // ---- Blocks ---------------------------------------------------------------------------
  // Building by hand, one block at a time: a block is a tile of some kind, half a storey tall.
  // Click a block's top to stack another on it, a side to put one beside it; each kind of block
  // lands in its own layer (a zone) at that height, made on the spot if there isn't one yet.
  const BLOCKS = {
    brick: { name: '磚地基', kind: 'outdoor', wall: 'brick', floor: 'stone' },
    grass: { name: '草地', kind: 'outdoor', base: 'earth', wall: 'brick', floor: 'grass' },
    deck: { name: '木平台', kind: 'outdoor', thin: true, base: 'stilts', rails: true, wall: 'wood', floor: 'plank' },
    room: { name: '室內地板', kind: 'room', wall: 'cream', floor: 'wood' },
    loft: { name: '閣樓', kind: 'room', thin: true, rails: true, wall: 'cream', floor: 'wood' },
    glass: { name: '玻璃屋', kind: 'room', wall: 'glass', floor: 'plank' },
    water: { name: '水池', kind: 'water', wall: 'brick', floor: 'stone', depth: 40 },
  };

  // The open layer for this kind of block at height z, made if need be.
  function zoneFor(room, id, z) {
    const b = BLOCKS[id] || BLOCKS.brick;
    const found = room.zones.findIndex((zn) => zn.z === z && (zn.block === id
      || (!zn.block && zn.kind === b.kind && !!zn.thin === !!b.thin && (zn.base || '') === (b.base || '') && (zn.kind !== 'room' || zn.wall === b.wall))));
    if (found >= 0) return found;
    const { name, ...props } = b;
    room.zones.push({ ...props, name: `${name} ${z / STEP_Z / 2 + 1}F`, z, block: id });
    return room.zones.length - 1;
  }

  // The block face under a screen point: { x, y, f, z, face: 'top' | 'left' | 'right' } for the
  // frontmost block, or a stair step { stair: cell }.
  function pickBlock(room, fx, fy) {
    const lay = layoutOf(room);
    const inside = (pts) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > fy) !== (yj > fy) && fx < ((xj - xi) * (fy - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const P = (x, y, z) => { const p = project(room, x * TU, y * TU, z); return [p.x, p.y]; };
    let best = null;
    const consider = (hit, score) => { if (!best || score > best.score) best = { ...hit, score }; };
    for (const [x, y, f] of room.tiles) {
      const zn = room.zones[f];
      if (!zn) continue;
      const z = zn.z;
      const low = zn.kind === 'water' ? z - (zn.depth || 40) : zn.thin ? z - SLAB : Math.min(-SLAB, z - STEP_Z);
      const score = (x + y) * 1000 + z;
      if (inside([P(x, y, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z)])) consider({ x, y, f, z, face: 'top' }, score + 2);
      if (inside([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, low), P(x, y + 1, low)])) consider({ x, y, f, z, face: 'left' }, score + 1);
      if (inside([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, low), P(x + 1, y, low)])) consider({ x, y, f, z, face: 'right' }, score + 1);
    }
    for (const c of cells(room).list) {
      if (c.kind !== 'stair') continue;
      if (inside([P(c.x, c.y, c.z), P(c.x + 1, c.y, c.z), P(c.x + 1, c.y + 1, c.z), P(c.x, c.y + 1, c.z)])) consider({ stair: c, x: c.x, y: c.y, z: c.z }, (c.x + c.y) * 1000 + c.z + 3);
    }
    void lay;
    return best;
  }

  // Where a new block would go for a face: on top, or beside it at the same height.
  function blockTarget(hit) {
    if (!hit || hit.stair) return null;
    if (hit.face === 'top') return { x: hit.x, y: hit.y, z: hit.z + STEP_Z };
    if (hit.face === 'left') return { x: hit.x, y: hit.y + 1, z: hit.z };
    return { x: hit.x + 1, y: hit.y, z: hit.z };
  }

  function placeBlock(room, id, t) {
    if (!t) return '這裡放不了';
    if (t.z > 8 * STEP_Z) return '太高了';
    const b = BLOCKS[id];
    if (b?.kind === 'water' && t.z > 0) t = { ...t, z: 0 };
    return addTile(room, t.x, t.y, zoneFor(room, id, t.z));
  }

  // Take away one block: a solid stack gets one block shorter; a deck, loft or pool goes.
  function removeBlock(room, hit) {
    if (!hit) return null;
    if (hit.stair) { removeFlightAt(room, hit.x, hit.y); return null; }
    const zn = room.zones[hit.f];
    const i = tileIndex(room, hit.x, hit.y, hit.f);
    if (i < 0) return null;
    room.tiles.splice(i, 1);
    if (!zn.thin && zn.kind !== 'water' && zn.z >= STEP_Z) {
      const id = zn.block || (zn.base === 'earth' ? 'grass' : zn.kind === 'room' ? 'room' : 'brick');
      room.tiles.push([hit.x, hit.y, zoneFor(room, id, zn.z - STEP_Z)]);
    }
    tidy(room);
    return null;
  }

  // Stairs down from the side of a higher block: as long as they need to be, onto the first
  // floor in front low enough.
  // Stairs are a piece of their own, put down on a floor tile next to higher ground: they climb
  // to it, and a bigger drop takes more steps, running away from the high side. Pointing at the
  // side of a higher block puts them on the floor in front of that side.
  function stairPlan(room, hit) {
    if (!hit || hit.stair) return '這裡已經有樓梯了';
    if (hit.ground) return '樓梯要放在地板上，旁邊要有比較高的地方';
    const floorAt = (x, y, below) => room.tiles
      .filter((t) => t[0] === x && t[1] === y && room.zones[t[2]].kind !== 'water' && room.zones[t[2]].z < below)
      .sort((p, q) => room.zones[q[2]].z - room.zones[p[2]].z)[0];
    let tile;
    let dirs;
    if (hit.face === 'top') {
      tile = { x: hit.x, y: hit.y, f: hit.f, z: hit.z };
      dirs = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    } else {
      const [dx, dy] = hit.face === 'left' ? [0, 1] : [1, 0];
      const t = floorAt(hit.x + dx, hit.y + dy, hit.z);
      if (!t) return '高台前面要有比較低的地板';
      tile = { x: t[0], y: t[1], f: t[2], z: room.zones[t[2]].z };
      dirs = [[-dx, -dy]];
    }
    let why = '旁邊要有比較高的地方，樓梯才有地方爬';
    for (const [dx, dy] of dirs) {
      // The lowest floor above this one on that side.
      const hiT = room.tiles
        .filter((t) => t[0] === tile.x + dx && t[1] === tile.y + dy && room.zones[t[2]].kind !== 'water' && room.zones[t[2]].z > tile.z)
        .sort((p, q) => room.zones[p[2]].z - room.zones[q[2]].z)[0];
      if (!hiT) continue;
      const hz = room.zones[hiT[2]].z;
      for (let n = 1; n <= 8; n++) {
        const lo = floorAt(tile.x - dx * n, tile.y - dy * n, hz);
        if (!lo) { why = '樓梯底下要有地板可以落腳'; break; }
        if ((hz - room.zones[lo[2]].z) / (n + 1) > STEP_Z) { why = '太高了，樓梯前面要留更多地板'; continue; }
        return { lo: { x: lo[0], y: lo[1], f: lo[2] }, hi: { x: hiT[0], y: hiT[1], f: hiT[2] } };
      }
    }
    return why;
  }
  // A spiral stair fits in one tile beside higher ground and climbs up to five storeys; it is entered
  // from a floor tile next to it at its own height.
  function spiralPlan(room, hit) {
    if (!hit || hit.stair) return '這裡已經有樓梯了';
    if (hit.ground || hit.face !== 'top') return '旋轉樓梯要放在地板頂面上，旁邊要有比較高的地方';
    const T = { x: hit.x, y: hit.y, f: hit.f, z: hit.z };
    const zAt = (x, y, pred) => room.tiles.filter((t) => t[0] === x && t[1] === y && room.zones[t[2]].kind !== 'water' && pred(room.zones[t[2]].z));
    const dirs = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    let hi = null;
    let hd = null;
    for (const [dx, dy] of dirs) {
      const t = zAt(T.x + dx, T.y + dy, (z) => z > T.z && z - T.z <= 5 * STEP_Z).sort((p, q) => room.zones[p[2]].z - room.zones[q[2]].z)[0];
      if (t && (!hi || room.zones[t[2]].z < room.zones[hi[2]].z)) { hi = t; hd = [dx, dy]; }
    }
    if (!hi) return '旁邊要有比較高的地方（最多五層）';
    // The way in: the opposite side first, then either side.
    const order = [[-hd[0], -hd[1]], [hd[1], hd[0]], [-hd[1], -hd[0]]];
    for (const [dx, dy] of order) {
      const lo = zAt(T.x + dx, T.y + dy, (z) => z === T.z)[0];
      if (lo) return { lo: { x: lo[0], y: lo[1], f: lo[2] }, hi: { x: hi[0], y: hi[1], f: hi[2] }, cell: [T.x, T.y], from: T.f };
    }
    return '旋轉樓梯旁邊要有同高的地板可以走進去';
  }
  function placeSpiral(room, hit) {
    const plan = spiralPlan(room, hit);
    if (typeof plan === 'string') return plan;
    if (room.flights.some((fl) => fl.cells.some(([x, y]) => x === plan.cell[0] && y === plan.cell[1]))) return '這裡已經有樓梯了';
    room.flights.push({ from: plan.from, to: plan.hi.f, style: 'spiral', cells: [plan.cell], bottom: [plan.lo.x, plan.lo.y], top: [plan.hi.x, plan.hi.y] });
    tidy(room);
    return null;
  }
  function placeStairs(room, hit) {
    const plan = stairPlan(room, hit);
    return typeof plan === 'string' ? plan : addFlight(room, plan.lo, plan.hi);
  }

  // A little block of each kind, for the palette.
  function blockSprite(id) {
    const b = BLOCKS[id] || BLOCKS.brick;
    return cached(`block|${id}`, () => renderSprite(1, 1, 8, (P) => {
      const fl = FLOORS[b.floor] || FLOORS.stone;
      if (b.kind === 'water') { waterBox(P, 1, 1, 14, [0, 0]); return; }
      if (b.thin) {
        if (b.base === 'stilts') stiltPosts(P, 1, 1, 18);
        P.box(0, 0, -SLAB, TU, TU, SLAB, { t: fl.base, l: '#5a3a2a', r: '#432a1e' }, false);
      } else if (b.base === 'earth') earthFaces(P, 1, 1, 16, true);
      else brickFaces(P, 1, 1, 16, (WALLS[b.wall] || WALLS.brick).base);
      fl.draw(P, 0, 0, 0);
      if (b.kind === 'room') {
        const w = WALLS[b.wall] || WALLS.cream;
        P.left(0, 0, TU, 12, w.glass ? w.base : w.base, 0);
        P.right(TU, 0, TU, 12, w.glass ? w.base : dk(w.base, 0.1), 0);
      }
    }, false, 24));
  }

  // ---- Rendering --------------------------------------------------------------------

  // Room canvas in fine pixels: world (0, 0, 0) lands at origin().
  // Scenery behind the room: rows of trees (or palms, bamboo, rocks...) along the back edges on a
  // strip of ground, hazed into the distance. It is only painted - nothing walks there and clicks
  // pass through it. A room keeps either a preset's id or its own mix:
  // { plants: [...], ground, rows: 1-3, density: 0.3-1, seed }.
  const BACKDROP_PLANTS = {
    pine: { name: '松樹', weight: 1 },
    broadleaf: { name: '闊葉樹', weight: 1 },
    birch: { name: '白樺', weight: 1 },
    maple: { name: '楓樹', weight: 1 },
    sakura: { name: '櫻花樹', weight: 1 },
    palm: { name: '椰子樹', weight: 2 },
    jungle: { name: '熱帶灌木', weight: 1, low: true },
    bamboo: { name: '竹子', weight: 1.5 },
    bush: { name: '灌木叢', weight: 0.7, low: true },
    rock: { name: '岩石', weight: 0.5, low: true },
  };
  const BACKDROP_GROUNDS = { grass: '草地', sand: '沙灘', snow: '雪地', dirt: '泥土', moss: '苔蘚' };
  const BACKDROP_PRESETS = {
    forest: { name: '森林', plants: ['pine', 'broadleaf'], ground: 'grass', rows: 2, density: 1 },
    beach: { name: '海灘椰林', plants: ['palm', 'jungle'], ground: 'sand', rows: 2, density: 1 },
    bamboo: { name: '竹林', plants: ['bamboo', 'bush'], ground: 'moss', rows: 2, density: 1 },
    sakura: { name: '櫻花林', plants: ['sakura', 'broadleaf', 'bush'], ground: 'grass', rows: 2, density: 0.85 },
    autumn: { name: '秋天楓林', plants: ['maple', 'birch'], ground: 'dirt', rows: 2, density: 0.9 },
    snow: { name: '雪松林', plants: ['pine', 'rock'], ground: 'snow', rows: 3, density: 0.9 },
  };
  const BACKDROPS = Object.fromEntries(Object.entries(BACKDROP_PRESETS).map(([id, p]) => [id, p.name]));
  // The scenery a room shows, as a full mix, or null.
  function backdropOf(room) {
    const b = room.backdrop !== undefined ? room.backdrop : BLUEPRINTS[room.blueprint]?.backdrop;
    if (!b) return null;
    const base = typeof b === 'string' ? BACKDROP_PRESETS[b] : b;
    if (!base) return null;
    const plants = (base.plants || []).filter((k) => BACKDROP_PLANTS[k]);
    if (!plants.length) return null;
    return {
      plants,
      ground: BACKDROP_GROUNDS[base.ground] ? base.ground : 'grass',
      rows: Math.max(1, Math.min(3, Math.round(base.rows || 2))),
      density: Math.max(0.3, Math.min(1, base.density ?? 1)),
      seed: base.seed || 0,
      preset: typeof b === 'string' ? b : base.preset || null,
    };
  }
  const rowHeight = (row) => [0, 58, 78, 96][row];
  function backdropItems(room) {
    const bd = backdropOf(room);
    if (!bd) return [];
    let mx = 1;
    let my = 1;
    for (const [x, y] of room.tiles) { mx = Math.max(mx, x + 1); my = Math.max(my, y + 1); }
    const total = bd.plants.reduce((a, k) => a + BACKDROP_PLANTS[k].weight, 0);
    const pickPlant = (u) => {
      let acc = 0;
      for (const k of bd.plants) { acc += BACKDROP_PLANTS[k].weight / total; if (u < acc) return k; }
      return bd.plants[bd.plants.length - 1];
    };
    const sd = bd.seed * 17.31;
    const out = [];
    for (let row = bd.rows; row >= 1; row--) {
      for (let k = -row; k < Math.max(mx, my) + 1; k++) {
        for (const [x, y] of [[-row, k], [k, -row]]) {
          if (x === -row && y === -row && k !== -row) continue;
          if ((x >= 0 && x >= mx) || (y >= 0 && y >= my)) continue;
          const n = hash(x * 3 + row + sd, y * 5 + row * 11);
          const plant = pickPlant(hash(x * 7 + row * 3 + sd, y * 13 - sd));
          // Thinned out by the density, but the ground stays.
          const gap = hash(y * 9 + sd, x * 4 + row) > bd.density;
          out.push({ x: x + (n - 0.5) * 0.5, y: y + (hash(y + sd, x) - 0.5) * 0.5, gx: x, gy: y, row, n, kind: plant, gap });
        }
      }
    }
    return out.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  }
  function backdropTree(kind, n, row, snowy) {
    const far = row > 1;
    const fade = (row - 1) * 0.12;
    const low = BACKDROP_PLANTS[kind]?.low;
    const h = Math.round((rowHeight(row) + n * 34) * (low ? (kind === 'jungle' ? 0.45 : 0.32) : 1));
    const v = Math.floor(n * 3);
    return cached(`bd|${kind}|${h}|${v}|${row}|${snowy ? 1 : 0}`, () => renderSprite(1, 1, h + 12, (P) => {
      const shade = (c) => (far ? dk(c, 0.06 + fade) : c);
      const crown = (h0, parts) => {
        for (const [x, y, zf, r, c] of parts) P.disc(x, y, h0 * zf, r, shade(c));
      };
      if (kind === 'palm') {
        // A palm: ringed trunk leaning out, drooping fronds.
        const lean = 0.02 + n * 0.03;
        for (let i = 0; i < h / 6; i++) P.box(6 + i * i * lean, 6, i * 6, 4, 4, 6, i % 2 ? shade('#a8865a') : shade('#bf9c6c'), false);
        const cx = 6 + (h / 6) * (h / 6) * lean + 2;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + n;
          for (let j = 1; j < 12; j++) P.disc(cx + Math.cos(a) * j * 1.6, 8 + Math.sin(a) * j * 1.2, h - 4 - j * j * 0.2, Math.max(0.9, 2.6 - j * 0.15), shade(k % 2 ? '#3f8a3a' : '#56a64a'));
        }
        return;
      }
      if (kind === 'jungle') {
        // Jungle undergrowth: big glossy leaves.
        for (let i = 0; i < 9; i++) P.disc(4 + (i * 5) % 9, 4 + (i * 3) % 9, (6 + (i % 4) * 6) * (h / 30), 5 - (i % 3), shade(i % 2 ? '#2f7a3a' : '#4f9a4a'));
        return;
      }
      if (kind === 'bush') {
        crown(h, [[8, 8, 0.35, 7, '#3f7a3a'], [5, 9, 0.5, 5, '#4f8f45'], [11, 7, 0.55, 5, '#4f8f45'], [8, 8, 0.75, 5, '#62a656'], [7, 9, 0.9, 3, '#7cbf6a']]);
        if (v === 2) for (const [x, y, zf] of [[5, 11, 0.6], [11, 10, 0.7], [8, 12, 0.85]]) P.disc(x, y, h * zf, 1, shade('#f2d0e0'));
        return;
      }
      if (kind === 'rock') {
        // A mossy boulder.
        crown(h, [[8, 8, 0.2, 7, '#6e7280'], [6, 9, 0.45, 6, '#858a98'], [10, 7, 0.5, 5, '#7a7e8c'], [7, 8, 0.75, 4, '#9aa0ae']]);
        P.disc(9, 7, h * 0.9, 2.5, shade('#6f9a52'));
        return;
      }
      if (kind === 'bamboo') {
        // A clump of stalks with joints, leaves at the tips.
        for (const [x, y, hk] of [[4, 6, 1], [9, 4, 0.85], [7, 10, 0.92], [12, 9, 0.75]]) {
          const top = h * hk;
          for (let zz = 0; zz < top; zz += 7) P.box(x, y, zz, 2, 2, 6, shade(zz % 14 ? '#7fae4a' : '#6a9a3c'), false);
          for (let zz = 7; zz < top; zz += 7) P.box(x - 0.5, y - 0.5, zz - 1, 3, 3, 1, shade('#a6c86a'), false);
          for (let k = 0; k < 5; k++) {
            const a = k * 1.3 + x;
            P.disc(x + 1 + Math.cos(a) * 3, y + 1 + Math.sin(a) * 2, top - 6 + k * 2.5, 2.2, shade(k % 2 ? '#4f8a3a' : '#6aa64a'));
          }
        }
        return;
      }
      if (kind === 'birch') {
        // A white trunk with dark marks, a light airy crown.
        for (let zz = 0; zz < h * 0.62; zz += 3) P.box(7, 7, zz, 2, 2, 3, shade((zz / 3) % 4 === 1 ? '#3a3a40' : '#ecebe4'), false);
        crown(h, [[8, 8, 0.55, 7, '#8aa64a'], [5, 9, 0.66, 5, '#a6bf5a'], [11, 7, 0.7, 5, '#a6bf5a'], [8, 8, 0.82, 5, '#c8d86a'], [8, 8, 0.94, 3, '#e0e08a']]);
        return;
      }
      if (kind === 'broadleaf' || kind === 'maple' || kind === 'sakura') {
        const C = {
          broadleaf: ['#3f7a3a', '#4f8f45', '#62a656', '#7cbf6a'],
          maple: ['#a8402a', '#c85a2a', '#e07a30', '#f0a648'],
          sakura: ['#d88aa8', '#e8a2bc', '#f4bcd0', '#fcdce6'],
        }[kind];
        P.box(6.5, 6.5, 0, 3, 3, h * 0.4, shade(kind === 'sakura' ? '#5a3a3a' : '#6e4428'), false);
        crown(h, [[8, 8, 0.5, 11, C[0]], [4, 9, 0.62, 8, C[1]], [12, 6, 0.66, 8, C[1]], [8, 8, 0.78, 8, C[2]], [7, 9, 0.9, 5, C[3]]]);
        return;
      }
      // A pine: tiers of needles narrowing to a point, snow on each tier on snowy ground.
      P.box(7, 7, 0, 2, 2, h * 0.22, shade('#5a3a24'), false);
      const z0 = h * 0.18;
      for (let zz = z0; zz < h; zz += 1) {
        const t = (zz - z0) / (h - z0);
        const r = 9 * (1 - t) + ((zz - z0) % 12 < 4 ? 1.6 : 0);
        const cap = snowy && (zz - z0) % 12 >= 2 && (zz - z0) % 12 < 4;
        P.disc(8, 8, zz, r, shade(cap ? '#e8eef8' : (zz - z0) % 12 < 4 ? '#2f5a3a' : '#3d6e47'));
        P.disc(6.5, 8.5, zz, Math.max(0, r - 3), shade(cap ? '#ffffff' : '#4a7d52'));
      }
    }, false));
  }
  // The ground the scenery stands on, one tile at a time.
  const GROUND_COLORS = {
    grass: { t: '#4f8a45', l: '#5e3922', r: '#3b2214', fleck: '#6aa857' },
    sand: { t: '#e2c98e', l: '#c9a46a', r: '#a8844e', fleck: '#f0dcb0' },
    snow: { t: '#e8eef8', l: '#8a7a6a', r: '#6a5a4a', fleck: '#ffffff' },
    dirt: { t: '#9a6a3e', l: '#6e4428', r: '#4f2f1a', fleck: '#c8803a' },
    moss: { t: '#5f8a3a', l: '#4a3a2a', r: '#2f2418', fleck: '#8aae4a' },
  };
  function backdropGround(kind) {
    return cached(`bdg|${kind}`, () => renderSprite(1, 1, 8, (P) => {
      const c = GROUND_COLORS[kind] || GROUND_COLORS.grass;
      P.box(0, 0, -6, TU, TU, 6, { t: c.t, l: c.l, r: c.r }, false);
      for (let i = 0; i < 5; i++) P.top((i * 7) % 14, (i * 5) % 14, 2, 1, c.fleck, 0);
    }, false, 8));
  }
  // A small picture of one plant, for the editor.
  const backdropThumb = (kind) => backdropTree(kind, 0.5, 1);
  const BACKDROP_CANVAS = { key: '', canvas: null };
  function drawBackdrop(ctx, room, z, weather) {
    const items = backdropItems(room);
    if (!items.length) return;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const bd = backdropOf(room);
    const key = `${layoutOf(room).id}|${JSON.stringify(bd)}|${z}|${W}x${H}|${JSON.stringify(ctx.getTransform())}|${weather || ''}`;
    if (BACKDROP_CANVAS.key !== key) {
      const c = makeCanvas(W, H);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.setTransform(ctx.getTransform());
      const grounds = new Set();
      for (const it of items) {
        const gk = `${it.gx},${it.gy}`;
        if (grounds.has(gk)) continue;
        grounds.add(gk);
        blit(g, room, backdropGround(bd.ground), it.gx * TU, it.gy * TU, 0, z);
      }
      // Far row first, hazed further; then the near row.
      const haze = { sand: '170,215,230', snow: '215,225,240' }[bd.ground] || '90,120,135';
      for (let row = bd.rows; row >= 1; row--) {
        for (const it of items.filter((t) => t.row === row && !t.gap)) blit(g, room, backdropTree(it.kind, it.n, row, bd.ground === 'snow'), it.x * TU, it.y * TU, 0, z);
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = `rgba(${haze},${[0, 0.14, 0.24, 0.2][row]})`;
        g.fillRect(0, 0, W, H);
        g.restore();
      }
      Object.assign(BACKDROP_CANVAS, { key, canvas: c });
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(BACKDROP_CANVAS.canvas, 0, 0);
    ctx.restore();
  }

  function bounds(room) {
    const L = layoutOf(room);
    let top = 0; let bottom = 0; let left = 0; let right = 0;
    // Room for the scenery behind.
    for (const it of backdropItems(room)) {
      top = Math.max(top, rowHeight(it.row) + 34 + 12 - ((it.x + it.y) * TU) / 2);
      left = Math.max(left, (it.y + 1 - it.x) * TU + 8);
      right = Math.max(right, (it.x + 1 - it.y) * TU + 8);
    }
    for (const [f, a] of L.areas.entries()) {
      const walls = a.walls.filter((w) => !w[5]);
      const tall = walls.length ? Math.max(...walls.map((w) => w[4])) + 3 : a.rails ? 16 : 4;
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
    h = Math.ceil(h);
    below = Math.ceil(below);
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
    const key = `${type}|${flip ? 1 : 0}|${s.weather || ''}|${def.anim || def.wall ? `${s.active ? 1 : 0}|${s.frame % 8}|${s.hour}|${s.meeting ? 1 : 0}` : ''}`;
    return cached(key, () => renderSprite(def.w, Math.max(def.d, 1), def.h, (P) => {
      // A soft contact shadow on the floor under anything that stands on it.
      if (!def.wall && !def.flat && !def.onWater) {
        P.top(0, 1, def.w * TU, def.d * TU - 1, 'rgba(12,8,30,0.22)', 0);
        P.top(2, 3, def.w * TU - 4, def.d * TU - 5, 'rgba(12,8,30,0.3)', 0);
      }
      def.draw(P, s);
    }, flip));
  }

  // Brick courses on the two visible faces of a raised base, h units tall below its top.
  function brickFaces(P, w, d, h, c) {
    const L = w * TU;
    const D = d * TU;
    const mortar = dk(c, 0.3);
    P.left(0, -h, L, h, c, D);
    P.right(D, -h, D, h, dk(c, 0.32), L);
    for (let v = 3, row = 0; v < h; v += 5, row++) {
      for (let u = (row % 2 ? 3 : 7) - 9, i = 0; u < L; u += 9, i++) {
        const n = (row * 7 + i * 13 + L) % 9;
        if (n === 0 || n === 4) P.left(Math.max(0, u + 1), -v + 1, 8, 4, n ? dk(c, 0.07) : lt(c, 0.06), D);
      }
      P.left(0, -v, L, 1, mortar, D);
      P.right(D, -v, D, 1, dk(mortar, 0.2), L);
      for (let u = row % 2 ? 3 : 7; u < L; u += 9) P.left(u, -v + 1, 1, 4, mortar, D);
      for (let u = row % 2 ? 2 : 6; u < D; u += 9) P.right(D - u, -v + 1, 1, 4, dk(mortar, 0.2), L);
    }
  }

  // Shadow on a floor. The light comes from the upper left, so walls and taller ground throw a
  // shadow to the right (+x) as long as half their height; corners against a wall or higher ground
  // behind darken; and a deck or loft overhead shades all of it.
  const CAST = 0.5;
  function shadeFloor(P, room, f, r) {
    const lay = layoutOf(room);
    const a = lay.areas[f];
    const wallOn = (plane, atv, u) => a.walls.find((w) => !w[5] && w[0] === plane && w[1] === atv && u >= w[2] && u < w[3]);
    const above = (x, y) => lay.tilesAt(x, y).some((t) => t.z > a.z && room.zones[t.f].thin);
    const topAt = (x, y) => Math.max(-Infinity, ...lay.tilesAt(x, y).filter((t) => !room.zones[t.f].thin && room.zones[t.f].kind !== 'water').map((t) => t.z));
    const dim = (k) => (c) => dk(c, k);
    for (let y = r[1]; y < r[1] + r[3]; y++) {
      for (let x = r[0]; x < r[0] + r[2]; x++) {
        const lx = (x - r[0]) * TU;
        const ly = (y - r[1]) * TU;
        if (above(x, y)) { P.top(lx, ly, TU, TU, dim(0.32), 0); continue; }
        // How far into this tile the longest shadow from the left reaches.
        let reach = 0;
        for (let k = 1; k <= 3; k++) {
          const gap = (k - 1) * TU;
          const wall = wallOn('x', x - k + 1, y);
          if (wall) reach = Math.max(reach, wall[4] * CAST - gap);
          const dz = topAt(x - k, y) - a.z;
          if (dz > 0) reach = Math.max(reach, dz * CAST - gap);
        }
        const cover = Math.min(TU, Math.round(reach));
        if (cover > 0) {
          P.top(lx, ly, Math.max(0, cover - 2), TU, dim(0.3), 0);
          P.top(lx + Math.max(0, cover - 2), ly, Math.min(2, cover), TU, dim(0.15), 0);
        }
        if (wallOn('x', x, y) || lay.higher(x - 1, y, a.z)) P.top(lx, ly, 3, TU, dim(0.2), 0);
        if (wallOn('y', y, x) || lay.higher(x, y - 1, a.z)) { P.top(lx, ly, TU, 3, dim(0.34), 0); P.top(lx, ly + 3, TU, 3, dim(0.16), 0); }
      }
    }
  }

  // A cliff of earth: dark soil in layers with stones, under a lip of turf when the top is grass.
  function earthFaces(P, w, d, h, grass, sand = false) {
    const L = w * TU;
    const D = d * TU;
    P.left(0, -h, L, h, sand ? '#d9b77a' : '#6e4429', D);
    P.right(D, -h, D, h, sand ? '#b08d56' : '#4a2b1a', L);
    for (let v = 10; v < h; v += 11) {
      P.left(0, -v, L, 2, sand ? '#c9a46a' : '#5e3922', D);
      P.right(D, -v, D, 2, sand ? '#9a7a48' : '#3b2214', L);
    }
    for (let i = 0; i < (L + D) / 9; i++) {
      const u = (i * 37) % L;
      const v = 6 + ((i * 23) % Math.max(4, h - 8));
      if (v < h - 2) P.left(u, -v, 3, 2, '#8a7a6a', D);
      if (v < h - 2 && u < D) P.right(D - u, -v, 3, 2, '#6a5c50', L);
    }
    if (grass) {
      P.left(0, -4, L, 4, '#5f9a4e', D);
      P.right(D, -4, D, 4, '#4f8642', L);
      for (let u = 1; u < L; u += 4) P.left(u, -6 - (u % 3), 2, 3, '#5f9a4e', D);
      for (let u = 2; u < D; u += 4) P.right(D - u, -6 - (u % 3), 2, 3, '#4f8642', L);
    }
  }

  // Wooden posts under a deck, down to the ground (or the water), with a cross brace.
  function stiltPosts(P, w, d, z) {
    const posts = [];
    for (let x = 0; x <= w; x += 2) posts.push([Math.min(x, w) * TU - (x >= w ? 3 : 0), d * TU - 3]);
    if (w % 2) posts.push([w * TU - 3, d * TU - 3]);
    for (let y = 0; y < d; y += 2) posts.push([w * TU - 3, y * TU]);
    for (const [x, y] of posts) P.box(x, y, -z, 3, 3, z - SLAB, { t: '#8a5a36', l: '#6e4428', r: '#55331d' }, false);
    if (z > 30) {
      P.left(0, -z + 8, w * TU, 2, '#6e4428', d * TU - 1);
      P.right(d * TU, -z + 8, d * TU, 2, '#55331d', w * TU - 1);
    }
  }

  // A tank of water seen through its glass sides: sand and stones below, a lit surface above.
  // A tropical sea is shallow turquoise over white sand.
  function waterBox(P, w, d, depth, r, tropic = false) {
    const L = w * TU;
    const D = d * TU;
    P.box(0, 0, -depth - SLAB, L, D, SLAB, { t: tropic ? '#f0dca8' : '#d8c48e', l: '#7a5a3a', r: '#5e4430' }, false);
    for (let i = 0; i < w * d * 2; i++) {
      const x = (i * 29 + r[0] * 7) % L;
      const y = (i * 17 + r[1] * 5) % D;
      if (i % 3 === 0) P.box(x, y, -depth, 3, 2, 2, '#8a8478', false);
      else if (i % 3 === 1) P.box(x, y, -depth, 1, 1, 6 + (i % 5), '#4f9e57', false);
      else P.top(x, y, 2, 1, '#c9b27a', -depth);
    }
    for (let i = 0; i < Math.max(1, (w * d) / 6); i++) {
      const x = ((i * 41 + 9) % (L - 8)) + 4;
      const y = ((i * 23 + 5) % (D - 8)) + 4;
      P.dot(x, y, -depth / 2 - (i % 3) * 4, '#f0a35e', 3, 1);
      P.dot(x + 3, y, -depth / 2 - (i % 3) * 4, '#e07a3a', 1, 1);
    }
    // Caustics: wavy threads of light across the sand.
    for (let k = 0; k < w * d; k++) {
      const y = ((k * 37 + r[1] * 11) % (D - 4)) + 2;
      for (let x = 0; x < L; x++) if (Math.sin(x / 2.3 + k * 1.7) + Math.sin(x / 5.1 + k) > 1.3) P.top(x, y + Math.round(Math.sin(x / 3 + k) * 1.5), 1, 1, 'rgba(255,250,210,0.45)', -depth);
    }
    P.left(0, -depth, L, depth, tropic ? 'rgba(30,185,195,0.5)' : 'rgba(30,110,190,0.62)', D);
    // Shafts of light slanting down through the water.
    for (let u = 6; u < L; u += 19) for (let v = 0; v < depth; v++) P.left(u + Math.floor(v / 3), -v - 1, 3, 1, 'rgba(210,245,255,0.10)', D + 0.1);
    P.right(D, -depth, D, depth, tropic ? 'rgba(20,150,170,0.56)' : 'rgba(20,85,160,0.68)', L);
    P.top(0, 0, L, D, tropic ? 'rgba(70,215,210,0.5)' : 'rgba(50,150,215,0.62)', 0);
    P.left(0, -1, L, 1, 'rgba(235,250,255,0.85)', D);
    P.right(D, -1, D, 1, 'rgba(235,250,255,0.85)', L);
    P.right(1, -depth, 1, depth, 'rgba(235,250,255,0.45)', L);
  }

  // The surface of a pool, one of eight frames: glints drifting across and sparkles winking.
  function waterSurface(room, f, r, frame) {
    const [, , w, d] = r;
    return cached(`surf|${layoutOf(room).id}|${f}|${r}|${frame}`, () => renderSprite(w, d, 4, (P) => {
      const L = w * TU;
      const D = d * TU;
      for (let i = 0; i < w * d * 2; i++) {
        const x = ((i * 31 + frame * (1 + (i % 3))) % (L + 6)) - 3;
        const y = (i * 13 + r[1] * 7) % (D - 2);
        if (x >= 0 && x < L - 5) P.top(x, y, 4 + (i % 3), 1, 'rgba(235,250,255,0.5)', 0);
      }
      for (let i = 0; i < w * d; i++) {
        if ((i * 7 + frame) % 8 > 1) continue;
        const [sx, sy] = P.p((i * 23 + 5) % L, (i * 17 + 3) % D, 0);
        P.set(sx, sy, 'rgba(255,255,255,0.95)');
        P.set(sx - 1, sy, 'rgba(255,255,255,0.5)');
        P.set(sx + 1, sy, 'rgba(255,255,255,0.5)');
      }
    }, false));
  }

  // City clutter on a tall brick base, so a plain wall reads as lived-in: a drainpipe, an aircon
  // box, a vent, a lit window, sagging cables and a patch of ivy - picked by the rect's position
  // so the same wall always looks the same.
  function facadeDetail(P, w, d, h, seed) {
    if (h < 40) return;
    const L = w * TU;
    const D = d * TU;
    const pick = (k) => (seed * 31 + k * 17) % 97;
    const metal = { t: '#7a8091', l: '#5a6075', r: '#474c5e' };
    // Drainpipe down the front corner, with brackets.
    P.box(L - 5, D, -h, 2, 2, h - 3, metal, false);
    for (let v = 10; v < h - 6; v += 16) P.box(L - 6, D, -h + v, 4, 1, 1, '#3a3f50', false);
    // Aircon on a long wall.
    if (L >= 48) {
      const u = 6 + (pick(1) % Math.max(1, L - 30));
      const v = -h + 10 + (pick(2) % Math.max(1, h - 30));
      P.box(u, D, v, 13, 5, 9, { t: '#e2e4ea', l: '#c9ccd4', r: '#a9adb8' }, false);
      for (let i = 0; i < 4; i++) P.left(u + 2, v + 2 + i * 2, 6, 1, '#9a9eaa', D + 5);
      P.disc(u + 10, D + 5, v + 4.5, 2.2, '#8a8e9a');
      P.box(u + 11, D + 1, -h + 1, 1, 1, v + h - 1, '#6a7080', false);
    }
    // A lit window on a tall wall.
    if (h >= 56 && L >= 32) {
      const u = 4 + (pick(3) % Math.max(1, L - 22));
      P.left(u - 1, -24, 10, 13, '#3a2a24', D);
      P.left(u, -23, 8, 11, '#ffd9a0', D);
      P.left(u + 4, -23, 1, 11, '#3a2a24', D);
      P.left(u, -18, 8, 1, '#3a2a24', D);
      P.glow(u + 4, D + 2, -17, 10, 'rgba(255,200,120,0.3)');
    }
    // A vent grille on the side.
    if (D >= 32) {
      const u = 6 + (pick(4) % Math.max(1, D - 16));
      P.right(D - u, -h + 22, 7, 7, '#3a3f50', L);
      for (let i = 0; i < 3; i++) P.right(D - u - 1, -h + 23 + i * 2, 5, 1, '#5a6075', L);
    }
    // Cables sagging across the top of the front.
    if (L >= 32) for (let u = 0; u < L; u++) P.left(u, -7 - Math.round(3 * Math.sin((u / L) * Math.PI)), 1, 1, '#2a2b33', D + 0.5);
    // Ivy climbing from the ground.
    if (pick(5) % 2) {
      const u = pick(6) % Math.max(1, L - 12);
      for (let i = 0; i < 7; i++) P.left(u + ((i * 5) % 11), -h + 2 + ((i * 7) % 18), 3, 3, i % 2 ? '#4f8f45' : '#3f7a3a', D + 0.3);
    }
  }

  // One rect of an area: its floor and, for raised areas, the brick base down to the ground.
  // Tiles open to the sky: outside, with nothing built above them.
  const exposed = (room, f, x, y) => {
    const a = layoutOf(room).areas[f];
    return a.kind !== 'room' && !layoutOf(room).tilesAt(x, y).some((t) => t.z > a.z);
  };
  const hash = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

  // Ground left to the weather grows a little: moss in the joints of stone, a weed by the edge.
  function groundDetail(P, room, f, r) {
    const [x0, y0, w, d] = r;
    const { floor } = floorOf(room, f);
    if (floor !== 'stone' && floor !== 'tile' && floor !== 'plank') return;
    for (let y = y0; y < y0 + d; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (!exposed(room, f, x, y)) continue;
        const lx = (x - x0) * TU;
        const ly = (y - y0) * TU;
        if (floor === 'plank') {
          if (hash(x, y) < 0.25) P.top(lx + 2 + Math.floor(hash(y, x) * 10), ly + 3, 2, 6, 'rgba(70,110,60,0.35)', 0);
          continue;
        }
        for (let i = 0; i < 3; i++) if (hash(x * 5 + i, y) < 0.45) P.top(lx + Math.floor(hash(x, y + i) * 14), ly, 2, 1, '#5e7a46', 0);
        if (hash(y, x * 3) < 0.35) P.top(lx + (y % 2 ? 8 : 0), ly + Math.floor(hash(x + 7, y) * 12), 1, 3, '#5e7a46', 0);
        if (hash(x * 9, y * 9) < 0.12) {
          const [sx, sy] = P.p(lx + 3 + Math.floor(hash(x, y * 2) * 10), ly + 3 + Math.floor(hash(x * 2, y) * 10), 0);
          P.set(sx, sy - 1, '#6fae5a'); P.set(sx - 1, sy - 2, '#83c06c'); P.set(sx + 1, sy - 3, '#83c06c');
        }
      }
    }
  }

  function weatherFloor(P, room, f, r, weather) {
    const [x0, y0, w, d] = r;
    const lay = layoutOf(room);
    for (let y = y0; y < y0 + d; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (!exposed(room, f, x, y)) continue;
        const lx = (x - x0) * TU;
        const ly = (y - y0) * TU;
        if (weather === 'snow') {
          for (let v = 0; v < TU; v += 4) for (let u = 0; u < TU; u += 4) {
            P.top(lx + u, ly + v, 4, 4, hash(x * 4 + u, y * 4 + v) < 0.93 ? 'rgba(238,243,252,0.94)' : 'rgba(225,233,248,0.6)', 0);
          }
          if (hash(x, y) < 0.5) P.top(lx + 3 + Math.floor(hash(y, x) * 8), ly + 4 + Math.floor(hash(x + 1, y) * 8), 3, 1, 'rgba(196,210,236,0.9)', 0);
        } else if (weather === 'rain') {
          P.top(lx, ly, TU, TU, (c) => dk(c, 0.12), 0);
          if (hash(x, y) < 0.34) {
            P.top(lx + 3, ly + 4, 9, 7, 'rgba(70,96,150,0.5)', 0);
            P.top(lx + 4, ly + 5, 4, 1, 'rgba(220,235,255,0.55)', 0);
          }
        } else if (weather === 'petals' || weather === 'leaves') {
          // A few fallen pieces lying flat.
          for (let i = 0; i < 3; i++) {
            if (hash(x * 3 + i, y) > 0.65) continue;
            const rows = PIECES[weather][(x + y + i) % 2 ? 0 : 3];
            const cols = PIECE_COLS[weather][(x * 7 + y + i) % 3];
            const [sx, sy] = P.p(lx + 2 + Math.floor(hash(x, y * 3 + i) * 10), ly + 2 + Math.floor(hash(y, x + i) * 10), 0);
            rows.forEach((row, j) => [...row].forEach((ch, k) => { if (cols[ch]) P.set(sx + k, sy + j * 0.6, cols[ch]); }));
          }
        }
      }
    }
    // Snow on the front lip as well, so the cover reads from the side.
    if (weather === 'snow' && lay.areas[f].kind !== 'room') {
      for (let x = x0; x < x0 + w; x++) if (exposed(room, f, x, y0 + d - 1)) P.left((x - x0) * TU, -2, TU, 3, '#e6edf8', d * TU);
      for (let y = y0; y < y0 + d; y++) if (exposed(room, f, x0 + w - 1, y)) P.right(d * TU - (y - y0) * TU, -2, TU, 3, '#cfd9ea', w * TU);
    }
  }

  function slabSprite(room, f, r, weather) {
    const a = layoutOf(room).areas[f];
    const { floor } = floorOf(room, f);
    const base = (WALLS[floorOf(room, 0).wall] || WALLS.brick).base;
    const fl = FLOORS[floor] || FLOORS.wood;
    const [, , w, d] = r;
    const stilts = a.thin && a.base === 'stilts';
    const depth = a.depth || 40;
    const h = a.kind === 'water' ? depth + SLAB : stilts ? a.z + SLAB : a.thin ? SLAB : a.z + SLAB;
    const lay = layoutOf(room);
    const wet = a.kind !== 'room' && a.kind !== 'water' ? weather || '' : '';
    return cached(`slab|${lay.id}|${f}|${r}|${floor}|${base}|${wet}`, () => renderSprite(w, d, 8, (P) => {
      if (a.kind === 'water') { waterBox(P, w, d, depth, r, floor === 'sand'); return; }
      if (a.thin) { // a floor on joists: a timber edge with a beam showing underneath
        if (stilts) stiltPosts(P, w, d, a.z);
        P.box(0, 0, -SLAB, w * TU, d * TU, SLAB, { t: fl.base, l: '#5a3a2a', r: '#432a1e' }, false);
        P.left(0, -SLAB, w * TU, 2, '#3a2418', d * TU);
        P.right(d * TU, -SLAB, d * TU, 2, '#2e1c13', w * TU);
        // Little lanterns hung under the front edge of a high outdoor deck.
        if (a.kind !== 'room' && a.z >= 40) {
          for (let u = 8; u < w * TU - 4; u += 22) {
            if (hash(r[0] * 13 + u, r[1] * 7) > 0.6) continue;
            P.left(u, -SLAB - 6, 1, 6, '#3a2a20', d * TU + 0.5);
            P.left(u - 2, -SLAB - 12, 5, 6, '#7a3a2a', d * TU + 0.6);
            P.left(u - 1, -SLAB - 11, 3, 4, '*#ffd27a', d * TU + 0.7);
            P.glow(u, d * TU + 1, -SLAB - 9, 12, 'rgba(255,200,120,0.4)');
          }
        }
        // Vines trailing off the front edges of a low outdoor deck (a high one would hang them over
        // the rooms below).
        if (a.kind !== 'room' && a.z <= 64) {
          const vine = (u, len, onLeft) => {
            for (let v = 0; v < len; v++) {
              const sway = Math.round(Math.sin(v / 3 + u) * 1);
              const c = v % 3 === 0 ? '#62a656' : '#4f8f45';
              if (onLeft) P.left(u + sway, -SLAB - v, 1, 1, c, d * TU + 0.5); else P.right(d * TU - u - sway, -SLAB - v, 1, 1, c, w * TU + 0.5);
              if (v % 3 === 1) { if (onLeft) P.left(u + sway + 1, -SLAB - v, 2, 1, '#7cbf6a', d * TU + 0.5); else P.right(d * TU - u - sway + 1, -SLAB - v, 2, 1, '#7cbf6a', w * TU + 0.5); }
            }
          };
          for (let u = 3; u < w * TU - 3; u += 7) if (hash(r[0] * 31 + u, r[1]) < 0.4) vine(u, 6 + Math.floor(hash(u, r[1] + 3) * 14), true);
          for (let u = 3; u < d * TU - 3; u += 7) if (hash(r[1] * 31 + u, r[0]) < 0.4) vine(u, 6 + Math.floor(hash(u, r[0] + 5) * 14), false);
        }
      } else if (a.z > 0 && a.base === 'earth') earthFaces(P, w, d, h, floor === 'grass', floor === 'sand');
      else if (a.z > 0) {
        brickFaces(P, w, d, h, base);
        facadeDetail(P, w, d, h - SLAB, r[0] * 7 + r[1] * 13 + f);
      }
      else if (a.base === 'earth') earthFaces(P, w, d, SLAB + 6, floor === 'grass', floor === 'sand');
      else P.box(0, 0, -SLAB, w * TU, d * TU, SLAB, { t: fl.base, l: dk(fl.base, 0.3), r: dk(fl.base, 0.45) }, false);
      for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) fl.draw(P, x, y, 0);
      shadeFloor(P, room, f, r);
      if (a.kind !== 'room' && a.kind !== 'water') groundDetail(P, room, f, r);
      if (wet) weatherFloor(P, room, f, r, wet);
      // A lit lip along the front edges, so each layer reads as separate.
      P.left(0, -2, w * TU, 2, lt(fl.base, 0.2), d * TU);
      P.right(d * TU, -2, d * TU, 2, lt(fl.base, 0.1), w * TU);
      // An arch under a base that has no street in front of it.
      if (a.z > 0 && !a.thin && !layoutOf(room).areas[0].rects.some((s) => s[1] === r[1] + d || s[0] === r[0] + w)) {
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
    const wallId = floorOf(room, f).wall;
    const w = WALLS[wallId] || WALLS.plum;
    const L = (to - from) * TU;
    // Timber framing: a cap along the top and a post at the open end.
    const cap = w.cap || '#6e4a32';
    return cached(`wall|${f}|${wall}|${wallId}`, () => renderSprite(plane === 'y' ? to - from : 1, plane === 'y' ? 1 : to - from + 1, h + 6, (P) => {
      if (w.glass) {
        const bar = { t: lt(w.trim, 0.2), l: w.trim, r: dk(w.trim, 0.2) };
        if (plane === 'y') {
          P.left(0, 0, L, h, w.base, 0);
          for (let u = 0; u <= L; u += TU) P.box(Math.min(u, L - 2), -2, 0, 2, 2, h, bar, false);
          for (const v of [0, h / 2, h - 2]) P.box(0, -2, v, L, 2, 2, bar, false);
          for (let u = 4; u < L; u += TU) P.left(u, h / 2 + 6, 1, 10, 'rgba(255,255,255,0.4)', 0.5);
        } else {
          P.right(L, 0, L, h, w.base, 0);
          for (let u = 0; u <= L; u += TU) P.box(-2, Math.min(u, L - 2), 0, 2, 2, h, bar, false);
          for (const v of [0, h / 2, h - 2]) P.box(-2, 0, v, 2, L, 2, bar, false);
          for (let u = 4; u < L; u += TU) P.right(L - u, h / 2 + 6, 1, 10, 'rgba(255,255,255,0.4)', 0.5);
        }
        return;
      }
      if (plane === 'y') { // plane y = 0 in local space, running along x
        P.box(0, -5, 0, L, 5, h, { t: lt(w.trim, 0.25), l: w.base, r: w.trim }, false);
        w.paint((u, v, ww, hh, c) => P.left(u, v, ww, hh, c, 0), L, h);
        P.left(0, 0, L, 5, w.trim, 0);
        P.left(0, 5, L, 1, lt(w.trim, 0.2), 0);
        P.left(0, 22, L, 2, dk(w.base, 0.14), 0);
        P.left(0, 24, L, 1, lt(w.base, 0.12), 0);
        P.left(0, 0, 3, h, dk(w.base, 0.12), 0);
        P.box(L - 4, -1, 0, 4, 2, h, cap, false);
        P.box(-1, -6, h, L + 1, 7, 3, { t: lt(cap, 0.15), l: cap, r: dk(cap, 0.25) }, false);
      } else { // plane x = 0, running along y
        P.box(-5, -5, 0, 5, L + 5, h, { t: lt(w.trim, 0.25), l: w.trim, r: dk(w.base, 0.08) }, false);
        w.paint((u, v, ww, hh, c) => P.right(L - u, v, ww, hh, c, 0), L, h);
        P.right(L, 0, L, 5, w.trim, 0);
        P.right(L, 5, L, 1, lt(w.trim, 0.15), 0);
        P.right(L, 22, L, 2, dk(w.base, 0.2), 0);
        P.right(L, 24, L, 1, lt(w.base, 0.06), 0);
        P.box(-1, L - 4, 0, 2, 4, h, dk(cap, 0.1), false);
        P.box(-6, -6, h, 7, L + 6, 3, { t: lt(cap, 0.15), l: dk(cap, 0.1), r: dk(cap, 0.3) }, false);
      }
    }, false));
  }

  // One step. Solid steps are stone blocks down to the ground; open ones are metal treads.
  // One stair tile: four treads climbing the way the flight goes, from half a rise below the
  // tile's height to half a rise above, so neighbouring tiles and the floors at each end meet in an
  // even run of steps. Solid steps are stone built up from the ground; open ones are metal treads
  // on a stringer.
  function stairSprite(c, room) {
    if (c.style === 'spiral') return spiralSprite(c);
    const h = c.z - c.base;
    const fl = FLOORS[floorOf(room, c.f).floor] || FLOORS.stone;
    const base = (WALLS[floorOf(room, 0).wall] || WALLS.brick).base;
    const up = c.up || -1;
    const [lo, hi] = (c.span || [c.z - c.rise / 2, c.z + c.rise / 2]).map((v) => v - c.z);
    const TREADS = Math.max(3, Math.min(6, Math.round((hi - lo) / 7)));
    return cached(`stair|${c.style}|${c.dir}|${up}|${h}|${lo}|${hi}|${fl.base}|${base}`, () => renderSprite(1, 1, 16 + hi, (P) => {
      const D = TU / TREADS;
      // Tread i (0 = lowest) as [u, height]: u is its start along the climb axis.
      const treads = Array.from({ length: TREADS }, (_, i) => [up > 0 ? i * D : TU - (i + 1) * D, lo + ((hi - lo) * (i + 1)) / TREADS]);
      // Back to front, so nearer treads paint over the ones behind.
      treads.sort((a, b) => a[0] - b[0]);
      const at = (u, z0, hh, col, rim) => (c.dir === 'x' ? P.box(u, 0, z0, D, TU, hh, col, rim) : P.box(0, u, z0, TU, D, hh, col, rim));
      if (c.style === 'solid') {
        const stone = { t: lt(fl.base, 0.08), l: base, r: dk(base, 0.32) };
        for (const [u, z1] of treads) at(u, -h, z1 + h, stone, false);
        for (const [u, z1] of treads) {
          // A worn lit nosing on each tread.
          if (c.dir === 'x') P.top(up > 0 ? u : u + D - 1, 0, 1, TU, lt(fl.base, 0.3), z1);
          else P.top(0, up > 0 ? u : u + D - 1, TU, 1, lt(fl.base, 0.3), z1);
        }
        return;
      }
      const metal = { t: '#8a92aa', l: '#555c72', r: '#41475a' };
      // Stringer along the open side, sloping with the treads.
      for (const [u, z1] of treads) {
        if (c.dir === 'x') P.box(u, TU - 2, z1 - 6, D, 2, 5, '#3a3f50', false);
        else P.box(TU - 2, u, z1 - 6, 2, D, 5, '#3a3f50', false);
      }
      for (const [u, z1] of treads) at(u, z1 - 2, 2, metal, true);
    }, false, Math.max(h, -lo) + 8));
  }

  // A spiral stair in one tile: wooden treads winding round an iron pole from the bottom landing's
  // side up to the top landing's side, with a rail following them round.
  function spiralSprite(c) {
    const total = c.rise * 2;
    const [fx, fy] = c.from;
    const [tx, ty] = c.to;
    return cached(`spiral|${c.rise}|${fx - c.x},${fy - c.y}|${tx - c.x},${ty - c.y}`, () => renderSprite(1, 1, 24 + c.rise, (P) => {
      const a0 = Math.atan2(fy - c.y, fx - c.x);
      const a1 = Math.atan2(ty - c.y, tx - c.x);
      let sweep = (((a1 - a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (sweep < Math.PI / 2) sweep += Math.PI * 2;
      if (total > 80) sweep += Math.PI * 2;
      const n = Math.max(6, Math.round(total / 6));
      const treads = Array.from({ length: n }, (_, i) => {
        const a = a0 + (sweep * (i + 0.5)) / n;
        return { a, z: -c.rise + (total * (i + 1)) / n, x: 8 + Math.cos(a) * 4.5, y: 8 + Math.sin(a) * 4.5 };
      });
      const wood = { t: '#b07a4a', l: '#8a5a36', r: '#6e4428' };
      const tread = (t) => {
        P.box(t.x - 3, t.y - 3, t.z - 2, 6, 6, 2, wood, false);
        const rx = 8 + Math.cos(t.a) * 7;
        const ry = 8 + Math.sin(t.a) * 7;
        P.box(rx - 0.5, ry - 0.5, t.z, 1, 1, 11, '#5a6075', false);
        P.box(rx - 1, ry - 1, t.z + 11, 2, 2, 1, '#8a92aa', false);
      };
      const behind = treads.filter((t) => t.x + t.y < 16).sort((p, q) => (p.x + p.y) - (q.x + q.y) || p.z - q.z);
      const before = treads.filter((t) => t.x + t.y >= 16).sort((p, q) => (p.x + p.y) - (q.x + q.y) || p.z - q.z);
      behind.forEach(tread);
      P.box(7, 7, -c.rise, 2, 2, total + 14, { t: '#9aa3b2', l: '#5a6075', r: '#41475a' }, false);
      P.box(6.5, 6.5, c.rise + 13, 3, 3, 2, '#e8b13a', false);
      before.forEach(tread);
    }, false, c.rise + 8));
  }

  // A run of railing along one edge of a tile: posts and a top bar, maybe hung with fairy lights.
  function railSprite(room, f, plane, lights, k) {
    const w = WALLS[floorOf(room, f).wall] || WALLS.navy;
    const bulbs = ['#ffd65a', '#ff8fb1', '#7ad1ff', '#9dff8a'];
    return cached(`rail|${plane}|${w.base}|${lights ? k % 4 : '-'}`, () => renderSprite(1, 1, 18, (P) => {
      const c = lt(w.base, 0.15);
      const at = (u, z) => (plane === 'y' ? [u, -1, z] : [-1, u, z]);
      if (plane === 'y') {
        for (const u of [1, 8]) P.box(u, -2, 0, 2, 2, 14, c, false);
        P.box(0, -2, 13, TU, 2, 2, lt(c, 0.2), false);
        P.box(0, -2, 6, TU, 2, 1, c, false);
      } else {
        for (const u of [1, 8]) P.box(-2, u, 0, 2, 2, 14, c, false);
        P.box(-2, 0, 13, 2, TU, 2, lt(c, 0.2), false);
        P.box(-2, 0, 6, 2, TU, 1, c, false);
      }
      if (lights) {
        for (const [u, z, i] of [[3, 12, 0], [8, 11, 1], [13, 12, 2]]) {
          P.dot(...at(u, z), `*${bulbs[(k + i) % 4]}`, 1, 2);
          P.glow(...at(u, z - 1), 5, 'rgba(255,214,120,0.28)');
        }
      }
    }, false));
  }

  // Everything that needs depth sorting, as boxes in tile space with z in world units.
  function sceneItems(room, s) {
    const L = layoutOf(room);
    const items = [];
    const e = 0.02;
    const C = cells(room);
    L.areas.forEach((a, f) => {
      for (const r of a.rects) {
        const [x, y, w, d] = r;
        const z0 = a.kind === 'water' ? a.z - (a.depth || 40) - SLAB : a.thin ? a.z - SLAB : -SLAB;
        items.push({ x0: x, y0: y, x1: x + w - e, y1: y + d - e, z0, z1: a.z, sprite: () => slabSprite(room, f, r, s(-1).weather), wx: x * TU, wy: y * TU, wz: a.z });
        if (a.kind === 'water') items.push({ x0: x, y0: y, x1: x + w - e, y1: y + d - e, z0: a.z - 0.02, z1: a.z - 0.001, sprite: () => waterSurface(room, f, r, (s(-1).frame || 0) % 8), wx: x * TU, wy: y * TU, wz: a.z });
      }
      for (const wall of a.walls) {
        if (wall[5]) continue;
        const [plane, at, from, to, h] = wall;
        const box = plane === 'y' ? { x0: from, x1: to, y0: at - 0.3, y1: at - e } : { x0: at - 0.3, x1: at - e, y0: from, y1: to };
        items.push({ ...box, z0: a.z, z1: a.z + h, sprite: () => wallSprite(room, f, wall), wx: (plane === 'y' ? from : at) * TU, wy: (plane === 'y' ? at : from) * TU, wz: a.z });
      }
      if (a.rails) {
        // Railing on every open edge: not inside the area, not along a wall, and not where a
        // neighbouring floor or the top of a flight meets it.
        const inside = (x, y) => a.rects.some((r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]);
        const onWall = (plane, at, u) => a.walls.some((w) => !w[5] && w[0] === plane && w[1] === at && u >= w[2] && u < w[3]);
        const meets = (x, y) => (C.at.get(`${x},${y}`) || []).some((c) => Math.abs(c.z - a.z) <= 20) || L.higher(x, y, a.z);
        let k = 0;
        for (const r of a.rects) {
          for (let x = r[0]; x < r[0] + r[2]; x++) {
            for (const [edge, out] of [[r[1], r[1] - 1], [r[1] + r[3], r[1] + r[3]]]) {
              if (inside(x, out) || onWall('y', edge, x) || meets(x, out)) continue;
              const n = k++;
              items.push({ x0: x, x1: x + 1, y0: edge - 0.1, y1: edge - e / 2, z0: a.z, z1: a.z + 16, sprite: () => railSprite(room, f, 'y', a.lights, n), wx: x * TU, wy: edge * TU, wz: a.z });
            }
          }
          for (let y = r[1]; y < r[1] + r[3]; y++) {
            for (const [edge, out] of [[r[0], r[0] - 1], [r[0] + r[2], r[0] + r[2]]]) {
              if (inside(out, y) || onWall('x', edge, y) || meets(out, y)) continue;
              const n = k++;
              items.push({ x0: edge - 0.1, x1: edge - e / 2, y0: y, y1: y + 1, z0: a.z, z1: a.z + 16, sprite: () => railSprite(room, f, 'x', a.lights, n), wx: edge * TU, wy: y * TU, wz: a.z });
            }
          }
        }
      }
    });
    for (const c of cells(room).list) {
      if (c.kind !== 'stair') continue;
      const z0 = c.style === 'solid' ? c.base : c.z - c.rise;
      items.push({ x0: c.x, y0: c.y, x1: c.x + 1 - e, y1: c.y + 1 - e, z0, z1: c.span ? c.span[1] : c.z + c.rise / 2, sprite: () => stairSprite(c, room), wx: c.x * TU, wy: c.y * TU, wz: c.z });
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
  function glows(ctx, room, sp, wx, wy, wz, z, alpha = 1) {
    if (!sp.glows.length) return;
    const p = project(room, wx, wy, wz);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    for (const g of sp.glows) {
      const x = (p.x - sp.ax + g.x) * z;
      const y = (p.y - sp.ay + g.y) * z;
      bloom(ctx, x, y, g.r * z, g.c, g.pool);
    }
    ctx.restore();
  }
  function bloom(ctx, x, y, r, c, pool) {
    ctx.save();
    ctx.translate(x, y);
    if (pool) ctx.scale(1, 0.5);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, c);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  // Light by the hour: night sinks the room into blue and lets every lamp and screen bloom;
  // dusk and dawn warm it; the day is plain and the lamps fade.
  // Light by the hour and the weather. After dark (and at dusk, and under rain) the room is lit with
  // a light map: everything sinks to a cool ambient colour, and every lamp, screen and lit room
  // gives back a warm circle of its own light, falling off with distance; the edges sink into a
  // vignette. The day keeps its own colours, with a warm wash late in the afternoon.
  function lightFor(hour, weather) {
    let L;
    if (hour >= 20 || hour < 5) L = { ambient: [62, 70, 128], glow: 0.9, indoor: 1, vignette: 0.45, reach: 1 };
    else if (hour >= 18 || hour < 6) L = { ambient: [205, 150, 170], glow: 0.8, indoor: 0.5, vignette: 0.25, reach: 0.7, warm: 'rgba(255,130,70,0.08)' };
    else if (hour >= 16) L = { warm: 'rgba(255,170,90,0.08)', sun: 'rgba(255,236,200,0.12)', glow: 0.9 };
    else L = { sun: 'rgba(255,250,232,0.16)', glow: 0.6 };
    if (weather === 'rain') {
      const a = L.ambient ? L.ambient.map((v, i) => v * [0.82, 0.86, 0.92][i]) : [222, 228, 240];
      L = { ...L, sun: null, ambient: a, indoor: Math.max(L.indoor || 0, 0.35), vignette: Math.max(L.vignette || 0, L.ambient ? 0.3 : 0.12), reach: L.reach || 0.5, glow: (L.glow || 0.75) + 0.2 };
    }
    if (weather === 'snow') {
      if (L.ambient) L = { ...L, ambient: L.ambient.map((v) => Math.min(255, v + 18)) };
      else L = { ...L, sky: ['rgba(225,235,255,0.12)', 'rgba(200,215,245,0.06)'] };
    }
    return L;
  }

  const rgbaParts = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const mix = (a, k) => `rgb(${a.map((v) => Math.round(Math.min(255, v * k))).join(',')})`;
  // Brighten what is drawn (and only that) by screening a colour over it.
  let SUNMAP = null;
  function screenOver(ctx, color) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (!SUNMAP || SUNMAP.width !== W || SUNMAP.height !== H) SUNMAP = makeCanvas(W, H);
    const g = SUNMAP.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(SUNMAP, 0, 0);
    ctx.restore();
  }
  let LIGHTMAP = null;
  function applyLightmap(ctx, room, z, lights, light) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (!LIGHTMAP || LIGHTMAP.width !== W || LIGHTMAP.height !== H) LIGHTMAP = makeCanvas(W, H);
    const g = LIGHTMAP.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    // Ambient, a touch brighter up top where the sky reaches.
    const amb = g.createLinearGradient(0, 0, 0, H);
    amb.addColorStop(0, mix(light.ambient, 1.12));
    amb.addColorStop(1, mix(light.ambient, 0.86));
    g.fillStyle = amb;
    g.fillRect(0, 0, W, H);
    g.setTransform(ctx.getTransform());
    g.globalCompositeOperation = 'lighter';
    // Lit rooms: a broad warm light over every indoor floor.
    if (light.indoor) {
      layoutOf(room).areas.forEach((a) => {
        if (a.kind !== 'room') return;
        for (const [x, y, w, d] of a.rects) {
          const p = project(room, (x + w / 2) * TU, (y + d / 2) * TU, a.z + 24);
          bloom(g, p.x * z, p.y * z, Math.max(w, d) * TU * 1.05 * z, `rgba(255,196,128,${0.85 * light.indoor})`, false);
        }
      });
    }
    // Every glow in the scene is a light: wider and stronger than its bloom.
    for (const [sp, it] of lights) {
      const p = project(room, it.wx, it.wy, it.wz);
      for (const gl of sp.glows) {
        const [r, gg, b, a = 1] = rgbaParts(gl.c);
        const x = (p.x - sp.ax + gl.x) * z;
        const y = (p.y - sp.ay + gl.y) * z;
        bloom(g, x, y, gl.r * z * (gl.pool ? 1.6 : 2.4), `rgba(${r},${gg},${b},${Math.min(1, a * 2 * light.reach)})`, gl.pool);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (light.vignette) {
      const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.22, W / 2, H * 0.55, Math.max(W, H) * 0.72);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${light.vignette})`);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
    // Only over what is drawn, then multiplied in.
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(LIGHTMAP, 0, 0);
    ctx.restore();
  }

  // Falling weather, worked out from the clock alone: each particle loops from up high down to a
  // random tile open to the sky, and rain splashes where it lands.
  const SKY = new Map();
  function skyTiles(room) {
    const lay = layoutOf(room);
    if (!SKY.has(lay.id)) {
      const out = [];
      lay.areas.forEach((a, f) => a.rects.forEach(([x0, y0, w, d]) => {
        for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) if (exposed(room, f, x, y)) out.push({ x, y, z: a.z });
      }));
      if (SKY.size > 20) SKY.clear();
      SKY.set(lay.id, out);
    }
    return SKY.get(lay.id);
  }
  // Little drawn pieces for blossom and leaves, a few turns of each as they tumble.
  // p/P: petal and its shade; l/L: leaf and its shade; s: stem.
  const PIECES = {
    petals: [
      ['.pp.', 'pppP', '.pPP', '..P.'],
      ['.p..', 'ppP.', 'pPP.', '.P..'],
      ['pP', 'PP'],
      ['..p.', '.ppP', 'pPP.', '.P..'],
    ],
    leaves: [
      ['..l..', 'l.l.l', 'lllll', '.lLl.', '..s..'],
      ['.l.', 'llL', 'lLL', '.s.'],
      ['lL', 'Ls'],
      ['..l..', '.lll.', 'llLll', '.lLL.', '...s.'],
    ],
  };
  const PIECE_COLS = {
    petals: [{ p: '#ffd1dc', P: '#f29bb4' }, { p: '#ffbfd0', P: '#e982a2' }, { p: '#fff0f4', P: '#f5b3c6' }],
    leaves: [{ l: '#e0873a', L: '#b5602a', s: '#6e4428' }, { l: '#c9472a', L: '#97301d', s: '#6e4428' }, { l: '#e8b04a', L: '#c08a2e', s: '#6e4428' }],
  };
  function drawPiece(ctx, kind, turn, flip, cols, x, y, z) {
    const rows = PIECES[kind][turn % PIECES[kind].length];
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < rows[j].length; i++) {
        const c = cols[rows[j][i]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect((x + (flip ? rows[j].length - 1 - i : i)) * z, (y + j) * z, z, z);
      }
    }
  }

  const FALL = {
    rain: { n: 2.6, T: 0.5, H: 120, cols: ['rgba(190,210,255,0.55)'] },
    snow: { n: 1.1, T: 7, H: 130, cols: ['rgba(255,255,255,0.95)', 'rgba(230,238,255,0.85)'] },
    petals: { n: 0.7, T: 8, H: 140, cols: [] },
    leaves: { n: 0.5, T: 9, H: 140, cols: [] },
  };
  function drawWeather(ctx, room, z, now, weather) {
    const kind = FALL[weather];
    const sky = kind && skyTiles(room);
    if (!sky?.length) return;
    const time = now / 1000;
    const count = Math.min(140, Math.round(sky.length * kind.n));
    ctx.save();
    for (let i = 0; i < count; i++) {
      const run = time / kind.T + hash(i, 7);
      const n = Math.floor(run);
      const t = run - n;
      const cell = sky[Math.floor(hash(i * 31 + n, 1) * sky.length)];
      let x = (cell.x + hash(i + n, 3)) * TU;
      let y = (cell.y + hash(i + n, 4)) * TU;
      const up = kind.H * (1 - t);
      const col = kind.cols[i % kind.cols.length];
      if (weather === 'rain') {
        x += up * 0.12;
        if (t > 0.9) {
          const p = project(room, x, y, cell.z);
          const k = (t - 0.9) / 0.1;
          ctx.strokeStyle = `rgba(210,225,255,${0.6 * (1 - k)})`;
          ctx.lineWidth = Math.max(1, z / 2);
          ctx.beginPath();
          ctx.ellipse(p.x * z, p.y * z, (1 + k * 4) * z, (0.5 + k * 2) * z, 0, 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }
        const p = project(room, x, y, cell.z + up);
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(p.x) * z, Math.round(p.y) * z, Math.max(1, z / 2), 8 * z);
        continue;
      }
      if (weather === 'snow') {
        x += Math.sin(time * 1.3 + i) * 4;
        y += Math.cos(time * 1.1 + i * 2) * 3;
      } else {
        x += (1 - t) * 36 - 18 + Math.sin(time * 2 + i) * 5;
        y += Math.sin(time * 1.5 + i * 3) * 6;
      }
      const p = project(room, x, y, cell.z + up);
      ctx.globalAlpha = t > 0.92 ? (1 - t) / 0.08 : 1;
      if (weather === 'snow') {
        ctx.fillStyle = col;
        const big = hash(i, 9) < 0.35;
        ctx.fillRect(Math.round(p.x) * z, Math.round(p.y) * z, (big ? 2 : 1) * z, (big ? 2 : 1) * z);
        continue;
      }
      // Petals and leaves tumble through their turns at their own pace.
      const turn = Math.floor(time * (3 + hash(i, 11) * 3) + i);
      drawPiece(ctx, weather, turn, hash(i, 12) < 0.5, PIECE_COLS[weather][i % 3], Math.round(p.x) - 2, Math.round(p.y) - 2, z);
    }
    ctx.restore();
  }

  function wash(ctx, cols, op) {
    if (!cols) return;
    const [a, b] = Array.isArray(cols) ? cols : [cols, cols];
    const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Draw the whole room. `extra` are more sortable boxes {x0..z1, draw(ctx)} (characters, parcels).
  function drawRoom(ctx, room, z, objState, extra, light) {
    const st = objState(-1);
    light = light || lightFor(st.hour ?? 12, st.weather);
    const lights = [];
    drawBackdrop(ctx, room, z, st.weather);
    for (const it of sortItems([...sceneItems(room, objState), ...extra])) {
      if (it.draw) { it.draw(ctx); continue; }
      const sp = it.sprite();
      blit(ctx, room, sp, it.wx, it.wy, it.wz, z);
      if (sp.glows.length) lights.push([sp, it]);
    }
    // The light map when it is dark enough to need one; washes of colour otherwise. The canvas must
    // hold only this room: the light map is cut to what is drawn there.
    if (light.ambient) applyLightmap(ctx, room, z, lights, light);
    if (light.sun) screenOver(ctx, light.sun);
    ctx.save();
    for (const c of [light.sky, light.warm]) wash(ctx, c, 'source-atop');
    ctx.restore();
    for (let pass = light.glow; pass > 0; pass -= 1) {
      for (const [sp, it] of lights) glows(ctx, room, sp, it.wx, it.wy, it.wz, z, Math.min(1, pass));
    }
    drawWeather(ctx, room, z, st.now ?? Date.now(), st.weather);
    postFx(ctx, light);
  }

  // Grade the picture a touch richer, then bloom: the bright parts, blurred, added back on top -
  // lamps, screens, neon and fire spill soft light round themselves, most of all after dark.
  let POST = null;
  let BLOOM = null;
  function postFx(ctx, light) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (typeof ctx.filter !== 'string') return;
    if (!POST || POST.width !== W || POST.height !== H) { POST = makeCanvas(W, H); BLOOM = makeCanvas(W, H); }
    const p = POST.getContext('2d');
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.globalCompositeOperation = 'copy';
    p.filter = light.ambient ? 'saturate(1.15) contrast(1.06)' : 'saturate(1.12) contrast(1.05)';
    p.drawImage(ctx.canvas, 0, 0);
    p.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(POST, 0, 0);
    ctx.restore();
    const strength = light.ambient ? (light.indoor >= 1 ? 0.55 : 0.4) : 0.18;
    const b = BLOOM.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'copy';
    // Keep only what is bright (contrast pushes the rest to black), then spread it.
    b.filter = `brightness(0.7) contrast(2.6) blur(${Math.max(2, Math.round(W / 160))}px)`;
    b.drawImage(POST, 0, 0);
    b.filter = 'none';
    b.globalCompositeOperation = 'destination-in';
    b.drawImage(POST, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = strength;
    ctx.drawImage(BLOOM, 0, 0);
    ctx.restore();
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
    const key = layoutOf(room).id;
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

  // Weather choices, and what 'auto' picks: mostly clear, sometimes rain, and in season snow,
  // blossom or falling leaves; it changes every three hours.
  const WEATHERS = { auto: '自動', clear: '晴天', rain: '下雨', snow: '下雪', petals: '櫻花', leaves: '落葉' };
  function weatherFor(choice, now = Date.now()) {
    if (choice && choice !== 'auto') return choice === 'clear' ? null : choice;
    const r = hash(Math.floor(now / 10800000), 5);
    const m = new Date(now).getMonth();
    const season = m === 11 || m <= 1 ? 'snow' : m <= 3 ? 'petals' : m >= 8 && m <= 10 ? 'leaves' : null;
    if (r < 0.6) return null;
    if (r < 0.8) return 'rain';
    return season;
  }

  // Dev preview: the street corner unbuilt and built, the other blueprints fully built, plus every
  // object on its own.
  function preview(canvas, z = 2, opts = {}) {
    const rooms = Object.keys(BLUEPRINTS).map((id) => generateRoom(id));
    const S = rooms.map(size).reduce((m, q) => ({ w: Math.max(m.w, q.w), h: Math.max(m.h, q.h) }));
    const themes = rooms;
    canvas.width = S.w * z * themes.length;
    canvas.height = S.h * z + 300;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const st = { frame: 1, active: true, now: Date.now(), hour: opts.hour ?? 20, weather: opts.weather, meeting: true };
    rooms.forEach((room, k) => {
      const one = makeCanvas(size(room).w * z, size(room).h * z);
      const oc = one.getContext('2d');
      oc.imageSmoothingEnabled = false;
      drawRoom(oc, room, z, () => st, []);
      ctx.drawImage(one, k * S.w * z, (S.h - size(room).h) * z);
    });
    // The backdrop goes in last, so the light falls on the rooms only, as it does in the app.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#1b1826';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
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
    TU, SLAB, STEP_Z, LAND, WEATHERS, weatherFor, BACKDROPS, BACKDROP_PRESETS, BACKDROP_PLANTS, BACKDROP_GROUNDS, backdropOf, backdropThumb, ZONE_KINDS, FLOORS, WALLS, OBJECTS, BLUEPRINTS, migrate, derive,
    pick, addZone, addTile, removeTile, addFlight, removeFlightAt, setZoneZ,
    BLOCKS, pickBlock, blockTarget, placeBlock, removeBlock, stairPlan, placeStairs, placeSpiral, stairSprite, blockSprite,
    size, origin, project, floorZ, levels, cells, resetCells, cellAt, neighbours, door, walkable, footprint, canPlace, stationSpots,
    generateRoom, objectSprite, drawRoom, blit, tileAt, wallAt, solidAt, preview,
  };
});
