/* global desk, Sprites, Iso, Catalog, Common */
// Room mode: a little isometric street corner floating above the taskbar. Every character walks (and climbs
// the stairs) to the furniture that matches what it is doing.
const DPR = window.devicePixelRatio || 1;
const TU = Iso.TU;
const SPEED = 2.5; // tiles per second
const M = Sprites.MINI;
const DRAWER_H = 290;
const TOOLBAR_H = 34;

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
const toolbar = document.getElementById('toolbar');
const editorEl = document.getElementById('editor');
// Editor, guild book and settings open in a drawer beside the room, along the taskbar.
const drawer = Drawer.create({
  editor: editorEl,
  onChange: (pane) => {
    window.RoomEditor?.setEditing(pane === 'edit');
    layout();
  },
});
document.getElementById('frame').prepend(drawer.el);

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const state = {
  room: Iso.generateRoom('shop'),
  zoom: 2,
  settings: null,
  progress: null,
  editing: false,
  open: new Set(), // walkable cell ids
  spots: [],
  claims: new Map(), // spot cell id -> actor id
  views: new Map(),
  fx: [],
  drag: null,
  onDrawTop: null, // editor ghost
  orbs: [],
};
// Device pixels per fine pixel; characters take device pixels per logical pixel (2 fine).
// Never bigger than the screen can hold: a room taller than the screen would hang under the
// taskbar and sit over everything behind it.
function maxZoom() {
  const S = Iso.size(state.room);
  const fitH = Math.floor(((window.screen.availHeight || 800) - TOOLBAR_H - 12) * DPR / S.h);
  const fitW = Math.floor(((window.screen.availWidth || 1280) * 0.6) * DPR / S.w);
  return clamp(Math.min(fitH, fitW), 1, 4);
}
const Z = () => clamp(Math.round(state.zoom) || 2, 1, maxZoom());
const spotKey = (s) => s.cell;
const cellOf = (id) => Iso.cells(state.room).list[id];

// ---- Layout ----------------------------------------------------------------------

function rebuildNav() {
  Iso.resetCells(state.room);
  state.open = Iso.walkable(state.room);
  state.spots = Iso.stationSpots(state.room);
  const valid = new Set(state.spots.map(spotKey));
  for (const [key, id] of [...state.claims]) {
    if (!valid.has(key)) {
      state.claims.delete(key);
      const v = state.views.get(id);
      if (v) { v.spot = null; v.atStation = false; }
    }
  }
  for (const v of state.views.values()) {
    // Cell ids move when an upgrade opens a layer, so check the cell is still where we stand.
    const c0 = cellOf(v.cell);
    if (!c0 || !walkable(v.cell) || c0.x !== Math.round(v.x) || c0.y !== Math.round(v.y) || Math.abs(c0.z - v.z) > 20) {
      const c = nearestWalkable(v.x, v.y, v.z);
      if (c) place(v, c);
    }
    v.path = [];
  }
}

function layout() {
  const S = Iso.size(state.room);
  const z = Z();
  canvas.width = S.w * z;
  canvas.height = S.h * z;
  const w = canvas.width / DPR;
  const h = canvas.height / DPR;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  viewport.style.width = `${w}px`;
  viewport.style.height = `${h}px`;
  ctx.imageSmoothingEnabled = false;
  const dw = drawer.current ? Drawer.widthBeside(w) : 0;
  drawer.el.style.width = `${dw}px`;
  drawer.el.style.height = `${DRAWER_H}px`;
  desk.invoke('room:resize', { width: w + (dw ? dw + 6 : 0), height: h + TOOLBAR_H, drawerH: dw ? DRAWER_H : 0 })
    .then((gap) => { document.getElementById('roomcol').style.marginBottom = `${gap || 0}px`; });
  rebuildNav();
}

function setRoom(room, { save = false, relayout = true } = {}) {
  state.room = room;
  Iso.resetCells(room);
  if (relayout) layout(); else rebuildNav();
  if (save) {
    clearTimeout(setRoom.timer);
    setRoom.timer = setTimeout(() => desk.invoke('room:set', state.room), 400);
  }
}

// ---- Navigation -------------------------------------------------------------------

function walkable(id) {
  return state.open.has(id);
}

function place(v, c) {
  v.cell = c.id;
  v.x = c.x;
  v.y = c.y;
  v.z = c.z;
}

function nearestWalkable(x, y, z = 0) {
  let best = null;
  let bestD = Infinity;
  for (const c of Iso.cells(state.room).list) {
    if (!walkable(c.id) || c.kind === 'stair') continue;
    const d = Math.abs(c.x - x) + Math.abs(c.y - y) + Math.abs(c.z - z) / 20;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Breadth-first over cells; neighbours connect when they are at most a stair step apart.
function findPath(from, to) {
  if (!walkable(to)) return null;
  const prev = new Map([[from, null]]);
  const queue = [cellOf(from)];
  while (queue.length) {
    const c = queue.shift();
    if (c.id === to) {
      const path = [];
      for (let k = to; k !== from; k = prev.get(k)) path.unshift(cellOf(k));
      return path;
    }
    for (const o of Iso.neighbours(state.room, c)) {
      if (!walkable(o.id) || prev.has(o.id)) continue;
      prev.set(o.id, c.id);
      queue.push(o);
    }
  }
  return null;
}

function route(v, to) {
  let from = v.cell;
  if (!cellOf(from) || !walkable(from)) from = nearestWalkable(v.x, v.y, v.z)?.id ?? from;
  const path = cellOf(from) ? findPath(from, to) : null;
  v.path = path || [];
  return !!path;
}

// Characters arrive at, and leave from, the street door.
function door() {
  const c = Iso.door(state.room);
  return c && walkable(c.id) ? c : nearestWalkable(c?.x ?? 0, c?.y ?? 0, 0);
}

function releaseSpot(v) {
  if (v.spot != null && state.claims.get(v.spot) === v.id) state.claims.delete(v.spot);
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
    const tc = cellOf(talkTo.cell);
    const here = tc && Iso.neighbours(state.room, tc).some((o) => o.id === v.cell);
    if (!here && !v.path.length && tc) {
      for (const o of Iso.neighbours(state.room, tc)) if (walkable(o.id) && route(v, o.id)) break;
    }
    v.talking = !v.path.length;
    return;
  }
  v.talking = false;
  const want = desiredStation(v.actor);
  if (want === 'exit') {
    releaseSpot(v);
    const d = door();
    if (d && !v.path.length && v.cell !== d.id) route(v, d.id);
    return;
  }
  if (want) {
    const prefs = FALLBACK[want] || [want];
    const current = v.spot != null && state.spots.find((s) => spotKey(s) === v.spot);
    if (current && prefs.includes(current.type)) {
      if (v.cell !== current.cell && !v.path.length) route(v, current.cell);
      return;
    }
    releaseSpot(v);
    for (const type of prefs) {
      const free = state.spots.filter((s) => s.type === type && !state.claims.has(spotKey(s)));
      if (!free.length) continue;
      const cost = (s) => Math.abs(s.x - v.x) + Math.abs(s.y - v.y) + Math.abs(Iso.floorZ(state.room, s.f) - v.z) / 10;
      free.sort((a, b) => cost(a) - cost(b));
      for (const s of free) {
        if (route(v, s.cell)) {
          v.spot = spotKey(s);
          state.claims.set(v.spot, v.id);
          return;
        }
      }
    }
  } else {
    releaseSpot(v);
  }
  // Idle: amble around, now and then up or down a floor.
  if (!v.path.length && now > v.nextWander && ['idle', 'done', 'think'].includes(v.actor.state)) {
    v.nextWander = now + 5000 + Math.random() * 9000;
    const here = cellOf(v.cell);
    const options = Iso.cells(state.room).list.filter((c) => c.kind === 'floor' && walkable(c.id) && !state.claims.has(c.id)
      && (Math.random() < 0.2 || c.f === here?.f));
    for (let i = 0; i < 10 && options.length; i++) {
      const c = options[Math.floor(Math.random() * options.length)];
      const crowded = [...state.views.values()].some((o) => o !== v && (o.path.at(-1)?.id ?? o.cell) === c.id);
      if (!crowded && route(v, c.id)) break;
    }
  }
}

// ---- Actors ------------------------------------------------------------------------

function createView(actor) {
  const start = door() || Iso.cells(state.room).list[0];
  const plate = document.createElement('div');
  plate.className = 'tag nameplate';
  const bubble = document.createElement('div');
  bubble.className = 'tag bubble hidden';
  overlay.append(plate, bubble);
  const v = {
    id: actor.id, actor, cell: start.id, x: start.x, y: start.y, z: start.z, path: [], spot: null, atStation: false, facing: 1,
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

// Where a character's feet are, in fine pixels on the room canvas.
function feetOf(v) {
  const spot = v.atStation && state.spots.find((s) => spotKey(s) === v.spot);
  const sit = spot?.sit || [0, 0, 0];
  return Iso.project(state.room, (v.x + 0.5) * TU + sit[0], (v.y + 0.5) * TU + sit[1], v.z + sit[2]);
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
    const dz = (next.z - v.z) / TU;
    const dist = Math.hypot(dx, dy, dz);
    const step = SPEED * dt * (Math.abs(dz) > 0.01 ? 0.8 : 1);
    if (dist <= step) {
      place(v, next);
      v.path.shift();
    } else {
      v.x += (dx / dist) * step;
      v.y += (dy / dist) * step;
      v.z += ((next.z - v.z) / dist) * step;
    }
    // Screen direction: +x walks down-right, +y walks down-left.
    const sx = dx - dy;
    if (Math.abs(sx) > 0.01) v.facing = Math.sign(sx);
    moving = true;
  }
  const spot = v.spot != null && state.spots.find((s) => spotKey(s) === v.spot);
  v.atStation = !!spot && !v.path.length && v.cell === spot.cell;
  if (v.atStation) v.facing = spot.facing;
  if (v.talking) {
    const t = state.views.get(v.talkTarget);
    if (t) v.facing = Math.sign((t.x - t.y) - (v.x - v.y)) || v.facing;
  }
  if (v.actor.state === 'leaving' && !v.path.length) {
    const d = door();
    if (d && v.cell === d.id) v.gone = true;
  }
  v.moving = moving;
}

function drawView(v, now) {
  const a = v.actor;
  const z = Z();
  const u = 2 * z;
  const fighting = now < v.fightUntil;
  let { pose, frame } = Common.poseFor(a, { moving: v.moving, dragging: v.dragging, now, atStation: v.atStation });
  if (v.talking && !v.moving && !v.dragging) {
    pose = 'rest';
    frame = Math.floor(now / 300) % 2;
  }
  if (fighting && !v.moving) {
    pose = 'command';
    frame = Math.floor(now / 200) % 2;
  }
  const f = v.dragging ? { x: v.dragX / z, y: v.dragY / z + M.feet * 2 - 10 } : feetOf(v);
  const anchor = (v.facing > 0 ? M.anchor : M.W - M.anchor) * 2;
  const x = Math.round(f.x - anchor) * z;
  const y = Math.round(f.y - M.feet * 2 - v.drop) * z;
  if (v.gone) ctx.globalAlpha = 0.4;
  if (!v.dragging) {
    // A soft contact shadow.
    ctx.fillStyle = 'rgba(20,10,30,0.28)';
    ctx.beginPath();
    ctx.ellipse(f.x * z, f.y * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Helpers stand beside their owner, typing away.
  for (let i = 0; i < Math.min(a.helpers, 3); i++) {
    const side = i % 2 ? 1 : -1;
    const off = (18 + Math.floor(i / 2) * 14) * z * side;
    Common.drawMiniAt(ctx, u, x + off, y + 2 * z, a, 'command', (Math.floor(now / 240) + i) % 2, side > 0 ? -1 : 1, now);
  }
  Common.drawMiniAt(ctx, u, x, y, a, pose, frame, v.facing, now);
  ctx.globalAlpha = 1;
  if (fighting) {
    const gx = v.facing > 0 ? x + 24 * z : x - 28 * z;
    Sprites.drawFxAt(ctx, u, gx, y + 10 * z, 'bug', Math.floor(now / 200) % 2, v.facing > 0 ? -1 : 1);
  }
  const top = (y + (M.H * 2 - 40) * z) / DPR;
  return { x: f.x * z / DPR, top, bottom: f.y * z / DPR };
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
    v.card.style.left = `${clamp(pos.x, 110, viewport.clientWidth - 110)}px`;
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
  h.textContent = `${v.actor.kind === 'user' ? '⭐' : '🤖'} ${v.actor.name}`;
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
  floatText(v.pos.x, v.pos.top, text, cls);
}

function floatText(x, y, text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  overlay.append(el);
  setTimeout(() => el.remove(), 1600);
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.add('hidden'), 4500);
}

function tileScreen(c) {
  return Iso.project(state.room, (c.x + 0.5) * TU, (c.y + 0.5) * TU, c.z);
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
    case 'bug': if (v) v.fightUntil = Date.now() + f.duration; break;
    case 'chest': {
      if (!v) break;
      const here = cellOf(v.cell);
      const tile = (here && Iso.neighbours(state.room, here).find((o) => walkable(o.id) && o.kind !== 'stair')) || here;
      if (!tile) break;
      const hit = document.createElement('div');
      hit.className = 'chest-hit';
      hit.title = '打開包裹';
      hit.addEventListener('click', () => desk.invoke('chest:open', f.id));
      overlay.append(hit);
      state.fx.push({ type: 'chest', id: f.id, x: tile.x, y: tile.y, z: tile.z, open: false, hit });
      break;
    }
    case 'chest-open': {
      const c = state.fx.find((e) => e.id === f.id);
      if (!c) break;
      c.open = true;
      c.hit.remove();
      const p = tileScreen(c);
      floatText((p.x * Z()) / DPR, ((p.y - 30) * Z()) / DPR, `+${f.coins} 🪙`, 'float-coin');
      setTimeout(() => { state.fx = state.fx.filter((e) => e !== c); }, 1600);
      break;
    }
    case 'chest-gone': {
      const c = state.fx.find((e) => e.id === f.id);
      c?.hit.remove();
      state.fx = state.fx.filter((e) => e !== c);
      break;
    }
    case 'ufo':
      state.fx.push({ type: 'ufo', start: Date.now() });
      break;
  }
}

// ---- Drawing -----------------------------------------------------------------------

function draw(now) {
  const { room } = state;
  const z = Z();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const active = new Set();
  let meeting = false;
  for (const v of state.views.values()) {
    if (!v.atStation) continue;
    const s = state.spots.find((sp) => spotKey(sp) === v.spot);
    if (s && (v.actor.state === 'work' || v.actor.state === 'wait')) active.add(s.objIndex);
    if (s?.type === 'meeting') meeting = true;
  }
  // The room's light and weather: the clock, or whatever the settings pin them to.
  const hour = { day: 13, dusk: 18, night: 22 }[state.settings?.timeOfDay] ?? new Date(now).getHours();
  const weather = Iso.weatherFor(state.settings?.weather, now);
  const frame = Math.floor(now / 250);
  const objState = (i) => ({ frame, active: active.has(i), now, hour, meeting, weather });

  const extra = [];
  for (const v of state.views.values()) {
    if (v.dragging) continue;
    // Sitting characters keep the box of the tile in front, so the sofa or bed stays behind them.
    extra.push({ x0: v.x + 0.15, y0: v.y + 0.15, x1: v.x + 0.85, y1: v.y + 0.85, z0: v.z + 0.02, z1: v.z + 40, draw: () => placeTags(v, drawView(v, now), now) });
  }
  for (const c of state.fx) {
    if (c.type !== 'chest') continue;
    extra.push({ x0: c.x + 0.2, y0: c.y + 0.2, x1: c.x + 0.8, y1: c.y + 0.8, z0: c.z + 0.02, z1: c.z + 20, draw: () => {
      const p = tileScreen(c);
      Sprites.drawFxAt(ctx, 2 * z, Math.round(p.x - 16) * z, Math.round(p.y - 26) * z, 'chest', c.open ? 1 : 0);
      Object.assign(c.hit.style, { left: `${((p.x - 16) * z) / DPR}px`, top: `${((p.y - 26) * z) / DPR}px`, width: `${(32 * z) / DPR}px`, height: `${(28 * z) / DPR}px` });
    } });
  }
  Iso.drawRoom(ctx, room, z, objState, extra);
  drawOrbs(now, z);
  for (const v of state.views.values()) if (v.dragging) placeTags(v, drawView(v, now), now);

  state.fx = state.fx.filter((f) => {
    if (f.type !== 'ufo') return true;
    const t = (now - f.start) / 6000;
    if (t >= 1) return false;
    const x = Math.round((canvas.width / z) * (1 - t) - 32 * t) * z;
    Sprites.drawFxAt(ctx, 2 * z, x, Math.round(4 + Math.sin(t * 12) * 4) * z, 'ufo', Math.floor(now / 200) % 2, -1);
    return true;
  });

  state.onDrawTop?.(ctx, z, now);
}

// Glowing orbs drifting around the diorama, like dust in neon light.
function drawOrbs(now, z) {
  const S = Iso.size(state.room);
  if (!state.orbs.length) {
    const cols = ['54,249,255', '194,123,255', '255,62,165', '255,200,120'];
    for (let i = 0; i < 9; i++) {
      state.orbs.push({ x: Math.random() * S.w, y: 20 + Math.random() * (S.h - 60), r: 1.5 + Math.random() * 2.5, c: cols[i % cols.length], p: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.5 });
    }
  }
  // After dark they are fireflies, warm and blinking; by day the neon colours dim to drifting motes.
  const hour = { day: 13, dusk: 18, night: 22 }[state.settings?.timeOfDay] ?? new Date(now).getHours();
  const night = hour >= 18 || hour < 6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, o] of state.orbs.entries()) {
    const t = now / 1000 * o.sp + o.p;
    const x = (o.x + Math.sin(t) * 10) * z;
    const y = (o.y + Math.cos(t * 0.7) * 8) * z;
    const c = night ? ['255,226,120', '196,255,140'][i % 2] : o.c;
    const k = night ? Math.max(0, Math.sin(t * 2.3 + i)) : 0.6;
    if (k < 0.05) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, o.r * 4 * z);
    g.addColorStop(0, `rgba(${c},${0.55 * k})`);
    g.addColorStop(0.35, `rgba(${c},${0.18 * k})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - o.r * 4 * z, y - o.r * 4 * z, o.r * 8 * z, o.r * 8 * z);
    ctx.fillStyle = `rgba(${c},${0.9 * k})`;
    ctx.fillRect(Math.round(x - z), Math.round(y - z), 2 * z, 2 * z);
  }
  ctx.restore();
}

// ---- Mouse --------------------------------------------------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * DPR, y: (e.clientY - r.top) * DPR };
}

// Fine-pixel point on the room canvas.
function finePoint(e) {
  const p = canvasPoint(e);
  return { x: p.x / Z(), y: p.y / Z() };
}

function tileAt(e) {
  const p = finePoint(e);
  return Iso.tileAt(state.room, p.x, p.y);
}

function actorAt(e) {
  const p = finePoint(e);
  let hit = null;
  for (const v of state.views.values()) {
    const f = feetOf(v);
    if (Math.abs(p.x - f.x) <= 12 && p.y >= f.y - 40 - v.drop && p.y <= f.y + 3) {
      if (!hit || v.x + v.y > hit.x + hit.y) hit = v;
    }
  }
  return hit;
}

// Clicks fall through to the desktop wherever the window is empty.
let ignoring = null;
function setIgnore(ignore) {
  if (ignoring === ignore) return;
  ignoring = ignore;
  desk.send('mouse:ignore', ignore);
}
window.addEventListener('mousemove', (e) => {
  if (state.drag || winDrag) return setIgnore(false);
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const onRoom = el === canvas || el === viewport || el === overlay;
  if (el && !onRoom && !el.matches?.('#frame, #roomcol, body, html')) return setIgnore(false);
  if (onRoom && state.editing) return setIgnore(false);
  const p = finePoint(e);
  setIgnore(!(Iso.solidAt(state.room, p.x, p.y) || actorAt(e)));
});
// Moving into one of the drawer's frames also counts as leaving this document.
document.addEventListener('mouseleave', (e) => { if (!state.drag && !winDrag && !drawer.contains(e.clientX, e.clientY)) setIgnore(true); });

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
    const c = t && Iso.cellAt(state.room, t.x, t.y, t.f);
    const spot = c && walkable(c.id) ? c : nearestWalkable(t?.x ?? 0, t?.y ?? 0, t ? Iso.floorZ(state.room, t.f) : 0);
    if (spot) place(d.v, spot);
    d.v.path = [];
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

// ---- Moving the window ----------------------------------------------------------------

let winDrag = false;
document.getElementById('grip').addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  winDrag = true;
  setIgnore(false);
  desk.send('room:drag', true);
});
window.addEventListener('mouseup', () => {
  if (!winDrag) return;
  winDrag = false;
  desk.send('room:drag', false);
});

// ---- Toolbar & wiring ---------------------------------------------------------------

function setZoom(z) {
  const top = maxZoom();
  if (z > top) showToast('已經是螢幕放得下的最大尺寸了');
  desk.invoke('settings:set', { roomZoom: clamp(z, 1, top) });
}

document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 1));
document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 1));
document.getElementById('btn-focus').addEventListener('click', () => desk.invoke('focus:toggle'));
document.getElementById('btn-guild').addEventListener('click', () => drawer.toggle('guild'));
document.getElementById('btn-settings').addEventListener('click', () => drawer.toggle('settings'));
desk.on('dock:open', ({ pane, tab }) => drawer.open(pane, tab));
document.getElementById('btn-strip').addEventListener('click', () => desk.send('room:hide'));
document.getElementById('btn-quit').addEventListener('click', () => desk.invoke('app:quit'));

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
  const r = Iso.migrate(room);
  if (r && JSON.stringify(r) !== JSON.stringify(state.room)) setRoom(r);
});
desk.on('assets', (assets) => {
  Common.loadSheets(assets);
  state.assets = assets;
});

window.RoomApp = { state, setRoom, layout, tileAt, finePoint, Z, clone, rebuildNav, toolbar, editorEl, drawer };

desk.invoke('init').then((init) => {
  state.settings = init.settings;
  state.zoom = init.settings.roomZoom;
  state.assets = init.assets;
  Common.loadSheets(init.assets);
  applyProgress(init.progress);
  // Older saved rooms are carried over to the grid, keeping their furniture.
  const saved = Iso.migrate(init.room && clone(init.room));
  if (saved) state.room = saved;
  if (saved?.iso !== init.room?.iso || !saved) desk.invoke('room:set', state.room);
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
