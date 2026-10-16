/* global Sprites */
// Pictures in and out of the game: a character as a drawing, a photo turned into pixels, and the
// character card friends pass around.
//
// A drawing here is an array of ART.W x ART.H colours ('#rrggbb' or null), feet on the bottom row.
(function () {
  const { W: AW, H: AH } = Sprites.ART;

  const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const blank = () => new Array(AW * AH).fill(null);

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Any character the game can draw (built-in, dress-up, drawn), standing still, as a drawing.
  function skinToArt(skin) {
    const c = canvas(Sprites.W * Sprites.RES, Sprites.H * Sprites.RES);
    const x = c.getContext('2d');
    Sprites.drawCharacterAt(x, Sprites.RES, 0, 0, skin, 'rest', 0, Sprites.colorsFor(210), 1, { prop: false });
    // The drawing box sits over the body box: centred on it, feet on its bottom row.
    const d = x.getImageData(13, 10, AW, AH).data;
    const px = blank();
    for (let i = 0; i < px.length; i++) if (d[i * 4 + 3] > 128) px[i] = hex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    return px;
  }

  // ---- Photo -> pixels ---------------------------------------------------------------
  // Shrinks a photo (a doll on the table, a drawing on paper) into a little sprite: lift it off
  // its background, crop, average down, keep a few colours and give it soft darker edges like the
  // rest of the cast. `cut` is how hard to remove the background (0-3), `size` how tall (0-2).
  function photoToArt(img, { cut = 2, size = 2 } = {}) {
    const max = 220;
    const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
    const c = canvas(w, h);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const at = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    const fg = new Uint8Array(w * h).fill(1);
    // Already see-through (a PNG cut-out): use that.
    let clear = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] < 128) { fg[i] = 0; clear++; }
    if (!clear && cut > 0) {
      // Grow the background in from the border while colours stay close to it.
      const T = [0, 18, 30, 48][cut];
      const border = [];
      for (let i = 0; i < w; i++) border.push(i, (h - 1) * w + i);
      for (let j = 0; j < h; j++) border.push(j * w, j * w + w - 1);
      const sum = [0, 0, 0];
      for (const i of border) { const p = at(i); sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
      const ref = sum.map((v) => v / border.length);
      const stack = [];
      for (const i of border) if (fg[i] && dist(at(i), ref) < T * 1.6) { fg[i] = 0; stack.push(i); }
      while (stack.length) {
        const i = stack.pop();
        const px = i % w;
        const p = at(i);
        for (const n of [px > 0 ? i - 1 : -1, px < w - 1 ? i + 1 : -1, i - w, i + w]) {
          if (n < 0 || n >= w * h || !fg[n]) continue;
          const q = at(n);
          // Close to the background, or a soft step off a pixel that really is background.
          if (dist(q, ref) < T || (dist(q, p) < 10 && dist(p, ref) < T && dist(q, ref) < T * 1.6)) { fg[n] = 0; stack.push(n); }
        }
      }
      // Shave the halo the background leaves around the edge.
      if (cut >= 2) {
        const edge = [];
        for (let i = 0; i < w * h; i++) {
          if (!fg[i]) continue;
          const px = i % w;
          if ((px > 0 && !fg[i - 1]) || (px < w - 1 && !fg[i + 1]) || (i >= w && !fg[i - w]) || (i < w * (h - 1) && !fg[i + w])) edge.push(i);
        }
        for (const i of edge) fg[i] = 0;
      }
    }
    // Crop to what is left.
    let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let i = 0; i < w * h; i++) {
      if (!fg[i]) continue;
      const px = i % w;
      const py = (i / w) | 0;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    if (x1 < 0) return blank();
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    const tall = [32, 38, AH][size];
    const s = Math.min(AW / cw, tall / ch);
    const tw = Math.max(1, Math.round(cw * s));
    const th = Math.max(1, Math.round(ch * s));
    // Average every block of photo pixels into one sprite pixel; half-covered blocks stay solid.
    const cells = [];
    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        const sx0 = x0 + Math.floor(tx / s); const sx1 = Math.max(sx0 + 1, x0 + Math.floor((tx + 1) / s));
        const sy0 = y0 + Math.floor(ty / s); const sy1 = Math.max(sy0 + 1, y0 + Math.floor((ty + 1) / s));
        let n = 0; let on = 0; const acc = [0, 0, 0];
        for (let yy = sy0; yy < Math.min(sy1, h); yy++) {
          for (let xx = sx0; xx < Math.min(sx1, w); xx++) {
            const i = yy * w + xx;
            n++;
            if (!fg[i]) continue;
            on++;
            const p = at(i);
            acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2];
          }
        }
        cells.push(on && on * 2 >= n ? acc.map((v) => v / on) : null);
      }
    }
    // A few colours, a bit livelier than the photo.
    const pal = medianCut(cells.filter(Boolean), 12).map(boost);
    const px = blank();
    const ox = Math.floor((AW - tw) / 2);
    const oy = AH - th;
    cells.forEach((p, i) => {
      if (!p) return;
      let best = pal[0]; let bd = Infinity;
      for (const q of pal) { const dd = dist(p, q); if (dd < bd) { bd = dd; best = q; } }
      px[(oy + Math.floor(i / tw)) * AW + ox + (i % tw)] = hex(...best);
    });
    return softEdges(px);
  }

  function medianCut(points, n) {
    if (!points.length) return [[128, 128, 128]];
    let boxes = [points];
    while (boxes.length < n) {
      let bi = -1; let bRange = 0; let bAxis = 0;
      boxes.forEach((b, i) => {
        if (b.length < 2) return;
        for (let a = 0; a < 3; a++) {
          let lo = 255; let hi = 0;
          for (const p of b) { lo = Math.min(lo, p[a]); hi = Math.max(hi, p[a]); }
          if (hi - lo > bRange) { bRange = hi - lo; bi = i; bAxis = a; }
        }
      });
      if (bi < 0 || bRange < 10) break;
      const b = boxes[bi].slice().sort((p, q) => p[bAxis] - q[bAxis]);
      const mid = b.length >> 1;
      boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
    }
    return boxes.map((b) => [0, 1, 2].map((a) => b.reduce((s, p) => s + p[a], 0) / b.length));
  }

  function boost([r, g, b]) {
    const m = (r + g + b) / 3;
    return [r, g, b].map((v) => Math.max(0, Math.min(255, m + (v - m) * 1.18)));
  }

  // Outer pixels a little darker, so the shape reads without a black line.
  function softEdges(px) {
    const out = px.slice();
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        const c = px[y * AW + x];
        if (!c) continue;
        const open = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([a, b]) => a < 0 || a >= AW || b < 0 || b >= AH || !px[b * AW + a]);
        if (open) out[y * AW + x] = hex(...rgb(c).map((v) => v * 0.78));
      }
    }
    return out;
  }

  // ---- Character cards ----------------------------------------------------------------
  // A card is a picture that works anywhere a picture goes. Saved as a file it carries the exact
  // character inside the PNG; pasted into a chat app (which may shrink or re-compress it) the game
  // can still read the big pixels, the colour column and the little barcode of the name.
  const CARD = { W: 680, H: 620 };
  const MARKS = ['#e2564a', '#f0b54d', '#7cc47f', '#5aa7ff'];
  // The see-through colour behind the pixels: whichever of these is furthest from the character's
  // own colours. It is painted beside the markers so the reader knows it.
  const KEYS = ['#cfe8dc', '#d6e2f5', '#f5d6e6', '#ece6c4', '#c4eef0', '#e2d6f5', '#9fd8b4', '#f2c6b0'];
  const KEY_AT = [72, 20];
  const CREAM = '#fff4e2';
  const BIG = { x: 24, y: 64, cell: 8 };
  const SMALL = [[300, 64], [470, 64], [300, 296], [470, 296]]; // walk, work, sleep, happy at 5px cells
  const SMALL_CELL = 5;
  const SMALL_POSES = ['walk', 'work', 'sleep', 'happy'];
  const PAL_AT = (i) => [642 + (i % 2) * 14, 64 + Math.floor(i / 2) * 13];
  const BAR = { x: 32, y: 536, cell: 8, cols: 72, rows: 5 };
  const POSE_ICONS = { walk: '🚶', work: '💻', sleep: '😴', happy: '🎉' };

  // { name, poses: { base: px[], walk?, ... }, data } -> canvas. `data` is what rides inside the PNG.
  function drawCard({ name, poses }) {
    // Keep colours clear of the see-through green and of each other, and at most 52 of them.
    const all = [];
    for (const k of Sprites.ART_POSES) for (const c of poses[k] || []) if (c && !all.includes(c)) all.push(c);
    const gap = (k) => Math.min(...all.map((c) => dist(rgb(c), rgb(k))), 999);
    const KEY = KEYS.reduce((b, k) => (gap(k) > gap(b) ? k : b), KEYS[0]);
    const keyRgb = rgb(KEY);
    const fixed = new Map();
    const pal = [];
    for (const c of all) {
      let v = rgb(c);
      if (dist(v, keyRgb) < 40) v = v.map((u, i) => u + (u >= keyRgb[i] ? 1 : -1) * 30);
      const near = pal.find((p) => dist(rgb(p), v) < 10);
      const out = near || (pal.length < 52 ? hex(...v) : pal.reduce((b, p) => (dist(rgb(p), v) < dist(rgb(b), v) ? p : b), pal[0]));
      if (!near && pal.length < 52) pal.push(out);
      fixed.set(c, out);
    }
    const c = canvas(CARD.W, CARD.H);
    const x = c.getContext('2d');
    x.fillStyle = CREAM;
    x.fillRect(0, 0, CARD.W, CARD.H);
    x.fillStyle = '#f0b54d';
    x.fillRect(0, 0, CARD.W, 6);
    x.fillRect(0, CARD.H - 6, CARD.W, 6);
    MARKS.forEach((m, i) => { x.fillStyle = m; x.fillRect(20 + i * 12, 20, 12, 12); });
    x.fillStyle = KEY;
    x.fillRect(KEY_AT[0], KEY_AT[1], 12, 12);
    const font = (size, weight = 800) => `${weight} ${size}px "Microsoft JhengHei UI", "Microsoft JhengHei", sans-serif`;
    x.fillStyle = '#3a2a20';
    x.font = font(30);
    x.fillText(name, 96, 40);
    x.font = font(14, 600);
    x.fillStyle = '#9a7a5a';
    x.textAlign = 'right';
    x.fillText('Deskmates 角色卡', CARD.W - 24, 36);
    x.textAlign = 'left';
    const grid = (px, gx, gy, cell) => {
      x.fillStyle = KEY;
      x.fillRect(gx, gy, AW * cell, AH * cell);
      if (!px) return;
      for (let i = 0; i < px.length; i++) {
        if (!px[i]) continue;
        x.fillStyle = fixed.get(px[i]);
        x.fillRect(gx + (i % AW) * cell, gy + Math.floor(i / AW) * cell, cell, cell);
      }
    };
    grid(poses.base, BIG.x, BIG.y, BIG.cell);
    SMALL.forEach(([sx, sy], i) => {
      grid(poses[SMALL_POSES[i]], sx, sy, SMALL_CELL);
      x.font = font(13, 600);
      x.fillStyle = 'rgba(58,42,32,0.55)';
      if (!poses[SMALL_POSES[i]]) x.fillText(`${POSE_ICONS[SMALL_POSES[i]]} 自動`, sx + 50, sy + 115);
    });
    pal.forEach((p, i) => { const [px, py] = PAL_AT(i); x.fillStyle = p; x.fillRect(px, py, 12, 12); });
    // The barcode: version, colour count, which poses, the name.
    const nameBytes = [...new TextEncoder().encode(name)].slice(0, 36);
    const mask = SMALL_POSES.reduce((m, k, i) => m | (poses[k] ? 1 << i : 0), 0);
    const bytes = [1, pal.length, mask, nameBytes.length, ...nameBytes];
    bytes.push(bytes.reduce((s, b) => (s + b) & 255, 0));
    x.fillStyle = '#3a2a20';
    bytes.forEach((b, i) => {
      for (let bit = 0; bit < 8; bit++) {
        if (!((b >> (7 - bit)) & 1)) continue;
        const n = i * 8 + bit;
        x.fillRect(BAR.x + (n % BAR.cols) * BAR.cell, BAR.y + Math.floor(n / BAR.cols) * BAR.cell, BAR.cell, BAR.cell);
      }
    });
    x.font = font(13, 600);
    x.fillStyle = '#9a7a5a';
    x.fillText('把這張圖拖進 Deskmates 的「💌 朋友」就能收下這個角色 · github.com/crazyjimmy0623/deskmates', 24, 602);
    return c;
  }

  // The exact character, tucked into the PNG as a text chunk.
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return (bytes) => { let c = 0xffffffff; for (const b of bytes) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  })();
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const bytesToB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const KEYWORD = 'deskmates';

  function withData(dataUrl, data) {
    const png = b64ToBytes(dataUrl.split(',')[1]);
    const text = `${KEYWORD}\0${bytesToB64(new TextEncoder().encode(JSON.stringify(data)))}`;
    const body = Uint8Array.from([...'tEXt'].map((ch) => ch.charCodeAt(0)).concat([...text].map((ch) => ch.charCodeAt(0))));
    const chunk = new Uint8Array(12 + body.length - 4);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, body.length - 4);
    chunk.set(body, 4);
    dv.setUint32(chunk.length - 4, CRC(body));
    const iend = png.length - 12;
    const out = new Uint8Array(png.length + chunk.length);
    out.set(png.subarray(0, iend), 0);
    out.set(chunk, iend);
    out.set(png.subarray(iend), iend + chunk.length);
    return `data:image/png;base64,${bytesToB64(out)}`;
  }

  function dataOf(bytes) {
    if (bytes.length < 8 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let p = 8; p + 8 <= bytes.length;) {
      const len = dv.getUint32(p);
      const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
      if (type === 'tEXt') {
        const text = String.fromCharCode(...bytes.subarray(p + 8, p + 8 + len));
        if (text.startsWith(`${KEYWORD}\0`)) {
          try { return JSON.parse(new TextDecoder().decode(b64ToBytes(text.slice(KEYWORD.length + 1)))); } catch { return null; }
        }
      }
      if (type === 'IEND') break;
      p += 12 + len;
    }
    return null;
  }

  // Reads the visible card back (it may have been shrunk or turned into a JPEG on the way).
  function readCardImage(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (Math.abs(w / h - CARD.W / CARD.H) > 0.04 || w < CARD.W / 3) return null;
    const c = canvas(w, h);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    const s = w / CARD.W;
    const sample = (cx, cy, r = 2) => {
      const acc = [0, 0, 0];
      let n = 0;
      const px = Math.floor(cx * s);
      const py = Math.floor(cy * s);
      const rr = Math.max(0, Math.round(r * s) - 1);
      for (let yy = py - rr; yy <= py + rr; yy++) {
        for (let xx = px - rr; xx <= px + rr; xx++) {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const i = (yy * w + xx) * 4;
          acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; n++;
        }
      }
      return acc.map((v) => v / Math.max(1, n));
    };
    if (!MARKS.every((m, i) => dist(sample(26 + i * 12, 26, 3), rgb(m)) < 70)) return null;
    const bytes = [];
    for (let i = 0; i < BAR.cols * BAR.rows / 8; i++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const n = i * 8 + bit;
        const p = sample(BAR.x + (n % BAR.cols) * BAR.cell + 4, BAR.y + Math.floor(n / BAR.cols) * BAR.cell + 4, 2);
        b = (b << 1) | ((p[0] + p[1] + p[2]) / 3 < 150 ? 1 : 0);
      }
      bytes.push(b);
    }
    const [version, count, mask, nameLen] = bytes;
    if (version !== 1 || count > 52 || nameLen > 36) return null;
    const head = bytes.slice(0, 4 + nameLen);
    if (head.reduce((t, b) => (t + b) & 255, 0) !== bytes[4 + nameLen]) return null;
    let name = '';
    try { name = new TextDecoder().decode(new Uint8Array(bytes.slice(4, 4 + nameLen))); } catch { /* keep blank */ }
    const pal = [];
    for (let i = 0; i < count; i++) { const [px, py] = PAL_AT(i); pal.push(sample(px + 6, py + 6, 3)); }
    const keyRgb = sample(KEY_AT[0] + 6, KEY_AT[1] + 6, 3);
    // Chat apps keep brightness sharper than colour, so trust brightness more when snapping.
    const ycc = ([r, g, b]) => [0.299 * r + 0.587 * g + 0.114 * b, -0.169 * r - 0.331 * g + 0.5 * b, 0.5 * r - 0.419 * g - 0.081 * b];
    const near = (p, q) => { const a = ycc(p); const b = ycc(q); return Math.hypot(2 * (a[0] - b[0]), 0.7 * (a[1] - b[1]), 0.7 * (a[2] - b[2])); };
    const snap = (p) => {
      let best = null;
      let bd = near(p, keyRgb);
      for (const q of pal) { const dd = near(p, q); if (dd < bd) { bd = dd; best = q; } }
      return best ? hex(...best) : null;
    };
    const readGrid = (gx, gy, cell) => {
      const px = blank();
      for (let i = 0; i < px.length; i++) px[i] = snap(sample(gx + (i % AW) * cell + cell / 2, gy + Math.floor(i / AW) * cell + cell / 2, cell >= 8 ? 2 : 1.5));
      return px;
    };
    const poses = { base: readGrid(BIG.x, BIG.y, BIG.cell) };
    SMALL_POSES.forEach((k, i) => { if (mask & (1 << i)) poses[k] = readGrid(SMALL[i][0], SMALL[i][1], SMALL_CELL); });
    return { name, poses };
  }

  // Bytes of an image file (or a pasted image) -> { name, art | recipe } or null if it isn't a card.
  async function readCard(bytes) {
    const data = dataOf(bytes);
    if (data?.v === 1 && (data.art?.base || data.recipe)) return { name: data.name, art: data.art, recipe: data.recipe, exact: true };
    const img = await imageOf(bytes);
    const seen = img && readCardImage(img);
    if (!seen) return null;
    const art = {};
    for (const [k, px] of Object.entries(seen.poses)) art[k] = Sprites.encodeArt(px);
    return { name: seen.name, art };
  }

  // As a data: URL (the pages only load pictures from themselves or data:).
  function imageOf(bytes) {
    const type = bytes[0] === 0xff ? 'jpeg' : bytes[0] === 0x47 ? 'gif' : bytes[0] === 0x52 ? 'webp' : bytes[0] === 0x42 ? 'bmp' : 'png';
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `data:image/${type};base64,${bytesToB64(bytes)}`;
    });
  }

  // A saved character (drawing, dress-up or friend) -> the card's data URL, exact data inside.
  function cardFor(entry) {
    const poses = {};
    if (entry.art) for (const [k, a] of Object.entries(entry.art)) poses[k] = Sprites.decodeArt(a);
    else poses.base = skinToArt(entry.skin);
    const c = drawCard({ name: entry.name, poses });
    const data = { v: 1, name: entry.name, ...(entry.art ? { art: entry.art } : { recipe: entry.recipe }) };
    return { canvas: c, dataUrl: withData(c.toDataURL('image/png'), data) };
  }

  window.Pixels = { blank, skinToArt, photoToArt, cardFor, readCard, imageOf, readCardImage, CARD, hex, rgb };
})();
