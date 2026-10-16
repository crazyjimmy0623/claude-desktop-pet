/* global desk, Sprites, Furniture, Catalog, Common */
// Room mode: a tile room where every character walks to the furniture that matches what it is doing.
const DPR = window.devicePixelRatio || 1;
const T = Furniture.T;
const SPEED = 2.5; // tiles per second
const M = Sprites.MINI;
const EDITOR_H = 160;
const ROOM_ROWS = 8;

// Station → acceptable furniture, best first.
const FALLBACK = {
  code: ['code', 'terminal'], terminal: ['terminal', 'code'], read: ['read', 'web'], web: ['web', 'read'],
  write: ['code', 'read'], art: ['art', 'code'], game: ['game', 'code'], music: ['music', 'rest'], chat: ['code'],
  meeting: ['meeting', 'code'], wait: ['wait'], rest: ['rest', 'coffee'], coffee: ['coffee', 'rest'],
};

const canvas = document.getElementById('room');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport');
const overlay = document.getElementById('overlay');
const toastEl = document.getElementById('toast');
const coinsEl = document.getElementById('coins');

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const state = {
  room: clone(Furniture.DEFAULT_ROOM),
  zoom: 3,
  settings: null,
  progress: null,
  editing: false,
  grid: [],
  spots: [],
  claims: new Map(), // spot key -> actor id
  views: new Map(),
  fx: [],
  customTiles: {},
  drag: null,
  onDrawTop: null, // editor ghost
};
// Whole device pixels per art pixel, so every sprite pixel lands exactly on the screen grid.
const unit = () => Math.max(1, Math.round(state.zoom * DPR));
const cssUnit = () => unit() / DPR;
const snap = (artPx) => Math.round(artPx) * unit();
const spotKey = (s) => `${s.x},${s.y}`;

// ---- Layout ----------------------------------------------------------------------

function rebuildNav() {
  state.grid = Furniture.walkGrid(state.room);
  state.spots = Furniture.stationSpots(state.room);
  const valid = new Set(state.spots.map(spotKey));
  for (const [key, id] of [...state.claims]) {
    if (!valid.has(key)) {
      state.claims.delete(key);
      const v = state.views.get(id);
      if (v) { v.spot = null; v.atStation = false; }
    }
  }
  for (const v of state.views.values()) {
    if (!walkable(Math.round(v.x), Math.round(v.y))) {
      const t = nearestWalkable(Math.round(v.x), Math.round(v.y));
      if (t) { v.x = t.x; v.y = t.y; }
      v.path = [];
    }
  }
}

function tilesAcross() {
  return Math.max(10, Math.floor((window.screen.availWidth * DPR) / (T * unit())));
}

function layout() {
  const across = tilesAcross();
  if (state.room.w !== across) {
    state.room = Furniture.fitRoom(state.room, across);
    desk.invoke('room:set', state.room);
  }
  const { room } = state;
  canvas.width = room.w * T * unit();
  canvas.height = room.h * T * unit();
  const w = canvas.width / DPR;
  const h = canvas.height / DPR;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  viewport.style.width = '100%';
  viewport.style.height = `${h}px`;
  document.documentElement.style.setProperty('--room-h', `${h}px`);
  ctx.imageSmoothingEnabled = false;
  desk.invoke('room:resize', { width: window.innerWidth, height: h + (state.editing ? EDITOR_H : 0) });
  rebuildNav();
}

function setRoom(room, { save = false, relayout = true } = {}) {
  state.room = room;
  if (relayout) layout(); else rebuildNav();
  if (save) {
    clearTimeout(setRoom.timer);
    setRoom.timer = setTimeout(() => desk.invoke('room:set', state.room), 400);
  }
}

// ---- Navigation -------------------------------------------------------------------

function walkable(x, y) {
  return !!state.grid[y]?.[x];
}

function nearestWalkable(x, y) {
  let best = null;
  let bestD = Infinity;
  for (let ty = 0; ty < state.room.h; ty++) {
    for (let tx = 0; tx < state.room.w; tx++) {
      if (!walkable(tx, ty)) continue;
      const d = Math.abs(tx - x) + Math.abs(ty - y);
      if (d < bestD) { bestD = d; best = { x: tx, y: ty }; }
    }
  }
  return best;
}

function findPath(sx, sy, tx, ty) {
  if (!walkable(tx, ty)) return null;
  const key = (x, y) => y * state.room.w + x;
  const prev = new Map([[key(sx, sy), null]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) {
      const path = [];
      let k = key(x, y);
      while (k !== key(sx, sy)) {
        path.unshift({ x: k % state.room.w, y: Math.floor(k / state.room.w) });
        k = prev.get(k);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

function route(v, x, y) {
  const sx = Math.round(v.x);
  const sy = Math.round(v.y);
  const path = findPath(walkable(sx, sy) ? sx : nearestWalkable(sx, sy)?.x ?? sx, walkable(sx, sy) ? sy : nearestWalkable(sx, sy)?.y ?? sy, x, y);
  v.path = path || [];
  return !!path;
}

function door() {
  const x = Math.floor(state.room.w / 2);
  const y = state.room.h - 1;
  return walkable(x, y) ? { x, y } : nearestWalkable(x, y);
}

function releaseSpot(v) {
  if (v.spot && state.claims.get(v.spot) === v.id) state.claims.delete(v.spot);
  v.spot = null;
  v.atStation = false;
}

function desiredStation(a) {
  if (a.state === 'leaving') return 'exit';
  if (a.state === 'think') return a.kind === 'user' ? null : 'code';
  if (a.state === 'work') return a.station || 'code';
  if (a.state === 'wait') return 'wait';
  if (a.state === 'sleep') return 'rest';
  return null;
}

function decide(v, now) {
  const talkTo = now < (v.talkUntil || 0) ? state.views.get(v.talkTarget) : null;
  if (talkTo) {
    releaseSpot(v);
    const tx = Math.round(talkTo.x);
    const ty = Math.round(talkTo.y);
    const here = Math.round(v.x) === tx - 1 && Math.round(v.y) === ty || Math.round(v.x) === tx + 1 && Math.round(v.y) === ty;
    if (!here && !v.path.length) {
      const options = [[tx - 1, ty], [tx + 1, ty], [tx, ty + 1], [tx - 1, ty + 1], [tx + 1, ty + 1]];
      for (const [x, y] of options) if (walkable(x, y) && route(v, x, y)) break;
    }
    v.talking = !v.path.length;
    if (v.talking) v.facing = Math.sign(talkTo.x - v.x) || v.facing;
    return;
  }
  v.talking = false;
  const want = desiredStation(v.actor);
  if (want === 'exit') {
    releaseSpot(v);
    const d = door();
    if (d && !v.path.length && (Math.round(v.x) !== d.x || Math.round(v.y) !== d.y)) route(v, d.x, d.y);
    return;
  }
  if (want) {
    const prefs = FALLBACK[want] || [want];
    const current = v.spot && state.spots.find((s) => spotKey(s) === v.spot);
    if (current && prefs.includes(current.type)) {
      const there = Math.round(v.x) === current.x && Math.round(v.y) === current.y;
      if (!there && !v.path.length) route(v, current.x, current.y);
      return;
    }
    releaseSpot(v);
    for (const type of prefs) {
      const free = state.spots.filter((s) => s.type === type && !state.claims.has(spotKey(s)));
      if (!free.length) continue;
      free.sort((a, b) => (Math.abs(a.x - v.x) + Math.abs(a.y - v.y)) - (Math.abs(b.x - v.x) + Math.abs(b.y - v.y)));
      for (const s of free) {
        if (route(v, s.x, s.y)) {
          v.spot = spotKey(s);
          state.claims.set(v.spot, v.id);
          return;
        }
      }
    }
  } else {
    releaseSpot(v);
  }
  // Idle: amble around.
  if (!v.path.length && now > v.nextWander && (v.actor.state === 'idle' || v.actor.state === 'done' || v.actor.state === 'think')) {
    v.nextWander = now + 5000 + Math.random() * 9000;
    for (let i = 0; i < 8; i++) {
      const tx = Math.round(v.x) + Math.floor(Math.random() * 9) - 4;
      const ty = Math.round(v.y) + Math.floor(Math.random() * 7) - 3;
      const crowded = [...state.views.values()].some((o) => o !== v && Math.abs(Math.round(o.path.at(-1)?.x ?? o.x) - tx) + Math.abs(Math.round(o.path.at(-1)?.y ?? o.y) - ty) < 2);
      if (walkable(tx, ty) && !crowded && !state.claims.has(`${tx},${ty}`) && route(v, tx, ty)) break;
    }
  }
}

// ---- Actors ------------------------------------------------------------------------

function createView(actor) {
  const start = door() || { x: 1, y: state.room.wallRows };
  const plate = document.createElement('div');
  plate.className = 'tag nameplate';
  const bubble = document.createElement('div');
  bubble.className = 'tag bubble hidden';
  overlay.append(plate, bubble);
  const v = {
    id: actor.id, actor, x: start.x, y: start.y, path: [], spot: null, atStation: false, facing: 1,
    drop: 30, vy: 0, nextWander: Date.now() + 2000, plate, bubble, card: null, fightUntil: 0,
  };
  plate.style.setProperty('--c', Common.colorOf(actor).main);
  state.views.set(actor.id, v);
  return v;
}

function removeView(v) {
  releaseSpot(v);
  v.plate.remove();
  v.bubble.remove();
  v.card?.remove();
  state.views.delete(v.id);
}

function syncActors(list) {
  const seen = new Set();
  for (const actor of list) {
    seen.add(actor.id);
    const v = state.views.get(actor.id) || createView(actor);
    v.actor = actor;
    v.plate.textContent = actor.kind === 'user' ? `⭐ ${actor.name}` : actor.name;
    v.plate.classList.toggle('user', actor.kind === 'user');
    v.decideAt = 0;
  }
  for (const v of [...state.views.values()]) if (!seen.has(v.id)) removeView(v);
}

// Pixel helpers (device pixels on the canvas).
function feet(v) {
  return { x: snap((v.x + 0.5) * T), y: snap((v.y + 1) * T - 2) };
}

function spriteTopLeft(v, facing) {
  const f = feet(v);
  const anchor = facing > 0 ? M.anchor : M.W - M.anchor;
  return { x: f.x - anchor * unit(), y: f.y - M.feet * unit() };
}

function updateView(v, dt, now) {
  if (v.drop > 0 && !v.dragging) {
    v.vy += 300 * dt;
    v.drop = Math.max(0, v.drop - v.vy * dt);
    if (v.drop === 0) v.vy = 0;
  }
  if (!v.dragging && now >= (v.decideAt || 0)) {
    decide(v, now);
    v.decideAt = now + 400;
  }
  let moving = false;
  if (!v.dragging && v.path.length) {
    const next = v.path[0];
    const dx = next.x - v.x;
    const dy = next.y - v.y;
    const dist = Math.hypot(dx, dy);
    const step = SPEED * dt;
    if (dist <= step) {
      v.x = next.x;
      v.y = next.y;
      v.path.shift();
    } else {
      v.x += (dx / dist) * step;
      v.y += (dy / dist) * step;
    }
    if (Math.abs(dx) > 0.01) v.facing = Math.sign(dx);
    moving = true;
  }
  const spot = v.spot && state.spots.find((s) => spotKey(s) === v.spot);
  v.atStation = !!spot && !v.path.length && Math.round(v.x) === spot.x && Math.round(v.y) === spot.y;
  if (v.atStation) v.facing = spot.facing;
  if (v.talking) {
    const t = state.views.get(v.talkTarget);
    if (t) v.facing = Math.sign(t.x - v.x) || v.facing;
  }
  v.seat = v.atStation && spot.seat ? spot.seat : 0;
  if (v.actor.state === 'leaving' && !v.path.length) {
    const d = door();
    if (d && Math.round(v.x) === d.x && Math.round(v.y) === d.y) v.gone = true;
  }
  v.moving = moving;
}

function drawView(v, now) {
  const a = v.actor;
  const fighting = now < v.fightUntil;
  let { pose, frame } = Common.poseFor(a, { moving: v.moving, dragging: v.dragging, now, atStation: v.atStation });
  if (v.talking && !v.moving && !v.dragging) {
    pose = 'rest';
    frame = Math.floor(now / 300) % 2;
  }
  if (fighting && !v.moving) {
    pose = 'hammer';
    frame = Math.floor(now / 200) % 2;
  }
  const tl = v.dragging ? { x: snap(v.dragX / unit() - 7), y: snap(v.dragY / unit() - 3) } : spriteTopLeft(v, v.facing);
  const y = tl.y - snap(v.drop) + v.seat * unit();
  if (v.gone) ctx.globalAlpha = 0.4;
  // Helpers stand beside their owner, hammering away.
  for (let i = 0; i < Math.min(a.helpers, 3); i++) {
    const side = i % 2 ? 1 : -1;
    const off = (9 + Math.floor(i / 2) * 7) * unit() * side;
    Common.drawMiniAt(ctx, unit(), tl.x + off, y + unit(), a, 'hammer', (Math.floor(now / 240) + i) % 2, side > 0 ? -1 : 1, now);
  }
  Common.drawMiniAt(ctx, unit(), tl.x, y, a, pose, frame, v.facing, now);
  ctx.globalAlpha = 1;
  if (fighting) {
    const gx = v.facing > 0 ? tl.x + 12 * unit() : tl.x - 14 * unit();
    Sprites.drawFxAt(ctx, unit(), gx, y + 2 * unit(), 'goblin', Math.floor(now / 200) % 2, v.facing > 0 ? -1 : 1);
  }
  return { x: (tl.x + 7 * unit()) / DPR, top: y / DPR + (a.state === 'sleep' ? 2 : 0) * cssUnit(), bottom: (y + M.feet * unit()) / DPR };
}

function placeTags(v, pos, now) {
  v.plate.style.left = `${pos.x}px`;
  v.plate.style.top = `${pos.bottom + 2}px`;
  const b = state.editing || v.card ? null : Common.bubbleFor(v.actor, now);
  v.bubble.classList.toggle('hidden', !b);
  if (b) {
    if (v.bubble.textContent !== b.text) v.bubble.textContent = b.text;
    const cls = `tag bubble ${b.cls}`.trim();
    if (v.bubble.className !== cls) v.bubble.className = cls;
    v.bubble.style.left = `${pos.x}px`;
    v.bubble.style.top = `${pos.top}px`;
  }
  if (v.card) {
    v.card.style.left = `${clamp(pos.x, 120, viewport.clientWidth - 120)}px`;
    v.card.style.top = `${Math.max(pos.top, 124)}px`;
    if (now >= v.cardUntil) closeCard(v);
    else if (Math.floor(now / 1000) !== v.cardSecond) fillCard(v, now);
  }
  v.pos = pos;
}

// ---- Info card ---------------------------------------------------------------------

function fillCard(v, now) {
  v.cardSecond = Math.floor(now / 1000);
  v.card.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = `${v.actor.kind === 'user' ? '⭐' : '⚔️'} ${v.actor.name}`;
  v.card.append(h);
  for (const [label, value] of Common.infoRows(v.actor, now)) {
    const row = document.createElement('div');
    row.className = 'row';
    const b = document.createElement('b');
    b.textContent = label;
    const s = document.createElement('span');
    s.textContent = value;
    row.append(b, s);
    v.card.append(row);
  }
}

function openCard(v) {
  for (const o of state.views.values()) closeCard(o);
  v.card = document.createElement('div');
  v.card.className = 'card';
  v.card.addEventListener('mousedown', () => closeCard(v));
  overlay.append(v.card);
  v.cardUntil = Date.now() + 10000;
  fillCard(v, Date.now());
}

function closeCard(v) {
  v.card?.remove();
  v.card = null;
}

// ---- Effects -----------------------------------------------------------------------

function floatAt(v, text, cls) {
  if (!v?.pos) return;
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  el.style.position = 'absolute';
  el.style.left = `${v.pos.x}px`;
  el.style.top = `${v.pos.top}px`;
  overlay.append(el);
  setTimeout(() => el.remove(), 1600);
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.add('hidden'), 4500);
}

function onFx(f) {
  const v = f.actorId ? state.views.get(f.actorId) : null;
  switch (f.type) {
    case 'coins': floatAt(v, `+${f.amount} 🪙`, 'float-coin'); break;
    case 'heart': floatAt(v, '❤️', 'float-text'); break;
    case 'toast': showToast(f.text); break;
    case 'talk':
      if (v) {
        v.talkTarget = f.targetId;
        v.talkUntil = Date.now() + f.duration;
        v.decideAt = 0;
      }
      break;
    case 'goblin': if (v) v.fightUntil = Date.now() + f.duration; break;
    case 'chest': {
      if (!v) break;
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ({ x: Math.round(v.x) + dx, y: Math.round(v.y) + dy }));
      const tile = around.find((t) => walkable(t.x, t.y)) || { x: Math.round(v.x), y: Math.round(v.y) };
      const hit = document.createElement('div');
      hit.className = 'chest-hit';
      hit.title = '打開寶箱';
      hit.addEventListener('click', () => desk.invoke('chest:open', f.id));
      overlay.append(hit);
      state.fx.push({ type: 'chest', id: f.id, x: tile.x, y: tile.y, open: false, hit });
      break;
    }
    case 'chest-open': {
      const c = state.fx.find((e) => e.id === f.id);
      if (!c) break;
      c.open = true;
      c.hit.remove();
      const el = document.createElement('div');
      el.className = 'float-coin';
      el.textContent = `+${f.coins} 🪙`;
      el.style.position = 'absolute';
      el.style.left = `${(c.x + 0.5) * T * cssUnit()}px`;
      el.style.top = `${c.y * T * cssUnit()}px`;
      overlay.append(el);
      setTimeout(() => {
        el.remove();
        state.fx = state.fx.filter((e) => e !== c);
      }, 1600);
      break;
    }
    case 'chest-gone': {
      const c = state.fx.find((e) => e.id === f.id);
      c?.hit.remove();
      state.fx = state.fx.filter((e) => e !== c);
      break;
    }
    case 'dragon':
      state.fx.push({ type: 'dragon', start: Date.now() });
      break;
  }
}

// ---- Drawing -----------------------------------------------------------------------

function draw(now) {
  const { room } = state;
  const u = unit();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  Furniture.drawWall(ctx, u, room);
  for (let y = room.wallRows; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) Furniture.drawFloorTile(ctx, u, x, y, room.tiles[`${x},${y}`] || room.floor, state.customTiles);
  }

  const active = new Set();
  let meeting = false;
  for (const v of state.views.values()) {
    if (!v.atStation) continue;
    const s = state.spots.find((sp) => spotKey(sp) === v.spot);
    if (s && (v.actor.state === 'work' || v.actor.state === 'wait')) active.add(s.objIndex);
    if (s?.type === 'meeting') meeting = true;
  }
  const objState = (i) => ({ frame: Math.floor(now / 250), active: active.has(i), now, hour: new Date(now).getHours(), meeting });

  const drawables = [];
  room.objects.forEach((o, i) => {
    const def = Furniture.OBJECTS[o.type];
    if (!def) return;
    if (def.wall || def.flat) Furniture.drawObject(ctx, u, o, objState(i));
    else drawables.push({ base: o.y + def.h, draw: () => Furniture.drawObject(ctx, u, o, objState(i)) });
  });
  for (const c of state.fx) {
    if (c.type !== 'chest') continue;
    drawables.push({ base: c.y + 0.9, draw: () => {
      const px = c.x * T * u;
      const py = c.y * T * u + 5 * u;
      Sprites.drawFxAt(ctx, u, px, py, 'chest', c.open ? 1 : 0);
      c.hit.style.left = `${c.x * T * cssUnit()}px`;
      c.hit.style.top = `${c.y * T * cssUnit()}px`;
      c.hit.style.width = `${T * cssUnit()}px`;
      c.hit.style.height = `${T * cssUnit()}px`;
    } });
  }
  for (const v of state.views.values()) {
    drawables.push({ base: v.dragging ? 999 : v.y + 1, draw: () => placeTags(v, drawView(v, now), now) });
  }
  drawables.sort((a, b) => a.base - b.base);
  for (const d of drawables) d.draw();

  state.fx = state.fx.filter((f) => {
    if (f.type !== 'dragon') return true;
    const t = (now - f.start) / 6000;
    if (t >= 1) return false;
    const x = snap((canvas.width / u) * (1 - t) - 32 * t);
    Sprites.drawFxAt(ctx, u, x, snap(6 + Math.sin(t * 12) * 4), 'dragon', Math.floor(now / 200) % 2, -1);
    return true;
  });

  state.onDrawTop?.(ctx, u, now);
}

// ---- Mouse --------------------------------------------------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * DPR, y: (e.clientY - r.top) * DPR, cssX: e.clientX - r.left, cssY: e.clientY - r.top };
}

function tileAt(e) {
  const p = canvasPoint(e);
  return { x: Math.floor(p.x / (T * unit())), y: Math.floor(p.y / (T * unit())) };
}

function actorAt(e) {
  const p = canvasPoint(e);
  let hit = null;
  for (const v of state.views.values()) {
    const f = feet(v);
    const top = f.y - 15 * unit() - snap(v.drop) + v.seat * unit();
    if (Math.abs(p.x - f.x) <= 6 * unit() && p.y >= top && p.y <= f.y + v.seat * unit() + 2 * unit()) {
      if (!hit || v.y > hit.y) hit = v;
    }
  }
  return hit;
}

canvas.addEventListener('mousedown', (e) => {
  if (state.editing || e.button !== 0) return;
  const v = actorAt(e);
  if (v) state.drag = { v, sx: e.clientX, sy: e.clientY, moved: false };
});

window.addEventListener('mousemove', (e) => {
  if (state.editing) return;
  const d = state.drag;
  if (d) {
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
      d.moved = true;
      d.v.dragging = true;
      d.v.path = [];
      releaseSpot(d.v);
      closeCard(d.v);
    }
    if (d.moved) {
      const p = canvasPoint(e);
      d.v.dragX = p.x;
      d.v.dragY = p.y;
    }
    return;
  }
  canvas.style.cursor = actorAt(e) ? 'grab' : 'default';
});

window.addEventListener('mouseup', (e) => {
  const d = state.drag;
  if (!d) return;
  state.drag = null;
  if (d.moved) {
    const t = tileAt(e);
    const spot = walkable(t.x, t.y) ? t : nearestWalkable(t.x, t.y);
    if (spot) { d.v.x = spot.x; d.v.y = spot.y; }
    d.v.dragging = false;
    d.v.drop = 16;
    d.v.nextWander = Date.now() + 6000;
    floatAt(d.v, ['唉唷！', '咚！', '頭好暈…'][Math.floor(Math.random() * 3)], 'float-text');
  } else if (d.v.card) {
    closeCard(d.v);
  } else {
    openCard(d.v);
  }
});

canvas.addEventListener('dblclick', (e) => {
  if (state.editing) return;
  const v = actorAt(e);
  if (v) desk.send('actor:pat', v.id);
});

canvas.addEventListener('contextmenu', (e) => {
  if (state.editing) return;
  e.preventDefault();
  const v = actorAt(e);
  if (v) desk.send('actor:menu', v.id);
});

// ---- Toolbar & wiring ---------------------------------------------------------------

function setZoom(z) {
  desk.invoke('settings:set', { roomZoom: clamp(z, 1, 4) });
}

document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 1));
document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 1));
document.getElementById('btn-guild').addEventListener('click', () => desk.invoke('window:open', 'guild'));
document.getElementById('btn-settings').addEventListener('click', () => desk.invoke('window:open', 'settings'));
document.getElementById('btn-close').addEventListener('click', () => desk.send('room:hide'));

function loadCustomTiles(assets) {
  state.customTiles = {};
  for (const t of assets?.tiles || []) {
    const img = new Image();
    img.src = t.dataUrl;
    state.customTiles[t.file] = { img };
  }
}

function applySettings(s) {
  state.settings = s;
  if (s.roomZoom !== state.zoom) {
    state.zoom = s.roomZoom;
    layout();
  }
}

function applyProgress(p) {
  state.progress = p;
  coinsEl.textContent = `Lv.${p.level} · ${p.coins} 🪙`;
  window.RoomEditor?.refresh();
}

desk.on('actors', syncActors);
desk.on('settings', applySettings);
desk.on('progress', applyProgress);
desk.on('fx', onFx);
desk.on('room', (room) => {
  if (room && JSON.stringify(room) !== JSON.stringify(state.room)) setRoom(room);
});
desk.on('assets', (assets) => {
  Common.loadSheets(assets);
  loadCustomTiles(assets);
  state.assets = assets;
  window.RoomEditor?.refresh();
});

window.RoomApp = { state, setRoom, layout, tileAt, unit, clone, rebuildNav };

desk.invoke('init').then((init) => {
  state.settings = init.settings;
  state.zoom = init.settings.roomZoom;
  state.assets = init.assets;
  Common.loadSheets(init.assets);
  loadCustomTiles(init.assets);
  applyProgress(init.progress);
  state.room = init.room || Furniture.generateRoom(tilesAcross(), ROOM_ROWS);
  if (!init.room) desk.invoke('room:set', state.room);
  layout();
  syncActors(init.actors);
  window.RoomEditor?.refresh();
});

let last = performance.now();
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const now = Date.now();
  for (const v of state.views.values()) updateView(v, dt, now);
  draw(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
