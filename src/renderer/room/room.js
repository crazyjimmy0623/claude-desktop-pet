/* global desk, Sprites, Iso, Catalog, Common */
// Room mode: an isometric diorama floating above the taskbar. Every character walks (and climbs the
// stairs) to the furniture that matches what it is doing.
const DPR = window.devicePixelRatio || 1;
const TU = Iso.TU;
const SPEED = 2.5; // tiles per second
const M = Sprites.MINI;
const EDITOR_H = 170;
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

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const state = {
  room: Iso.generateRoom(),
  zoom: 2,
  settings: null,
  progress: null,
  editing: false,
  grid: [],
  spots: [],
  claims: new Map(), // spot key -> actor id
  views: new Map(),
  fx: [],
  drag: null,
  onDrawTop: null, // editor ghost
  onDecor: null,
};
// Device pixels per fine pixel; characters take device pixels per logical pixel (2 fine).
const Z = () => clamp(Math.round(state.zoom) || 2, 1, 4);
const spotKey = (s) => `${s.x},${s.y}`;

// ---- Layout ----------------------------------------------------------------------

function rebuildNav() {
  state.grid = Iso.walkGrid(state.room);
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
    if (!walkable(Math.round(v.x), Math.round(v.y))) {
      const t = nearestWalkable(Math.round(v.x), Math.round(v.y));
      if (t) { v.x = t.x; v.y = t.y; }
      v.path = [];
    }
  }
}

function layout() {
  const S = Iso.size(state.room.n);
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
  desk.invoke('room:resize', { width: Math.max(w, state.editing ? 560 : 0), height: h + TOOLBAR_H + (state.editing ? EDITOR_H : 0) });
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
  for (let ty = 0; ty < state.room.n; ty++) {
    for (let tx = 0; tx < state.room.n; tx++) {
      if (!walkable(tx, ty)) continue;
      const d = Math.abs(tx - x) + Math.abs(ty - y);
      if (d < bestD) { bestD = d; best = { x: tx, y: ty }; }
    }
  }
  return best;
}

// Breadth-first over tiles; neighbours connect when their surfaces are a stair step apart at most.
function findPath(sx, sy, tx, ty) {
  if (!walkable(tx, ty)) return null;
  const n = state.room.n;
  const key = (x, y) => y * n + x;
  const prev = new Map([[key(sx, sy), null]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) {
      const path = [];
      let k = key(x, y);
      while (k !== key(sx, sy)) {
        path.unshift({ x: k % n, y: Math.floor(k / n) });
        k = prev.get(k);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(nx, ny) || prev.has(key(nx, ny)) || !Iso.linked(state.room, x, y, nx, ny)) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

function route(v, x, y) {
  let sx = Math.round(v.x);
  let sy = Math.round(v.y);
  if (!walkable(sx, sy)) ({ x: sx, y: sy } = nearestWalkable(sx, sy) || { x: sx, y: sy });
  const path = findPath(sx, sy, x, y);
  v.path = path || [];
  return !!path;
}

function door() {
  const n = state.room.n;
  const x = Math.floor(n / 2);
  return walkable(x, n - 1) ? { x, y: n - 1 } : nearestWalkable(x, n - 1);
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
    const d = Math.abs(Math.round(v.x) - tx) + Math.abs(Math.round(v.y) - ty);
    if (d !== 1 && !v.path.length) {
      for (const [x, y] of [[tx - 1, ty], [tx, ty + 1], [tx + 1, ty], [tx, ty - 1]]) if (walkable(x, y) && route(v, x, y)) break;
    }
    v.talking = !v.path.length;
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
  // Idle: amble around, sometimes up the stairs.
  if (!v.path.length && now > v.nextWander && ['idle', 'done', 'think'].includes(v.actor.state)) {
    v.nextWander = now + 5000 + Math.random() * 9000;
    const n = state.room.n;
    for (let i = 0; i < 10; i++) {
      const tx = Math.floor(Math.random() * n);
      const ty = Math.floor(Math.random() * n);
      const crowded = [...state.views.values()].some((o) => o !== v && Math.abs(Math.round(o.path.at(-1)?.x ?? o.x) - tx) + Math.abs(Math.round(o.path.at(-1)?.y ?? o.y) - ty) < 2);
      if (walkable(tx, ty) && !Iso.isStair(state.room, tx, ty) && !crowded && !state.claims.has(`${tx},${ty}`) && route(v, tx, ty)) break;
    }
  }
}

// ---- Actors ------------------------------------------------------------------------

function createView(actor) {
  const start = door() || { x: 1, y: state.room.n - 1 };
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

// Where a character's feet are, in fine pixels on the room canvas.
function feetOf(v) {
  const spot = v.atStation && state.spots.find((s) => spotKey(s) === v.spot);
  const sit = spot?.sit || [0, 0, 0];
  const z = Iso.standZ(state.room, v.x, v.y);
  return Iso.project(state.room.n, (v.x + 0.5) * TU + sit[0], (v.y + 0.5) * TU + sit[1], z + sit[2]);
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
    // Screen direction: +x walks down-right, +y walks down-left.
    const sx = dx - dy;
    if (Math.abs(sx) > 0.01) v.facing = Math.sign(sx);
    moving = true;
  }
  const spot = v.spot && state.spots.find((s) => spotKey(s) === v.spot);
  v.atStation = !!spot && !v.path.length && Math.round(v.x) === spot.x && Math.round(v.y) === spot.y;
  if (v.atStation) v.facing = spot.facing;
  if (v.talking) {
    const t = state.views.get(v.talkTarget);
    if (t) v.facing = Math.sign((t.x - t.y) - (v.x - v.y)) || v.facing;
  }
  if (v.actor.state === 'leaving' && !v.path.length) {
    const d = door();
    if (d && Math.round(v.x) === d.x && Math.round(v.y) === d.y) v.gone = true;
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

function tileScreen(t) {
  const z = Iso.heightAt(state.room, t.x, t.y) ?? 0;
  return Iso.project(state.room.n, (t.x + 0.5) * TU, (t.y + 0.5) * TU, z);
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
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ({ x: Math.round(v.x) + dx, y: Math.round(v.y) + dy }));
      const tile = around.find((t) => walkable(t.x, t.y) && Iso.linked(state.room, Math.round(v.x), Math.round(v.y), t.x, t.y)) || { x: Math.round(v.x), y: Math.round(v.y) };
      const hit = document.createElement('div');
      hit.className = 'chest-hit';
      hit.title = '打開包裹';
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
  const hour = new Date(now).getHours();
  const frame = Math.floor(now / 250);
  const objState = (i) => ({ frame, active: active.has(i), now, hour, meeting });

  const extra = [];
  for (const v of state.views.values()) {
    if (v.dragging) continue;
    // Sitting characters keep the box of the tile in front, so the sofa or bed stays behind them.
    extra.push({ x0: v.x + 0.15, y0: v.y + 0.15, x1: v.x + 0.85, y1: v.y + 0.85, draw: () => placeTags(v, drawView(v, now), now) });
  }
  for (const c of state.fx) {
    if (c.type !== 'chest') continue;
    extra.push({ x0: c.x + 0.2, y0: c.y + 0.2, x1: c.x + 0.8, y1: c.y + 0.8, draw: () => {
      const p = tileScreen(c);
      Sprites.drawFxAt(ctx, 2 * z, Math.round(p.x - 16) * z, Math.round(p.y - 26) * z, 'chest', c.open ? 1 : 0);
      Object.assign(c.hit.style, { left: `${((p.x - 16) * z) / DPR}px`, top: `${((p.y - 26) * z) / DPR}px`, width: `${(32 * z) / DPR}px`, height: `${(28 * z) / DPR}px` });
    } });
  }
  Iso.drawRoom(ctx, room, z, objState, extra, (c) => state.onDecor?.(c, z));
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
  if (state.editing || state.drag || winDrag) return setIgnore(false);
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el !== canvas && el !== viewport && el !== overlay && !el.matches?.('#frame, body, html')) return setIgnore(false);
  const p = finePoint(e);
  setIgnore(!(Iso.solidAt(state.room, p.x, p.y) || actorAt(e)));
});
document.addEventListener('mouseleave', () => { if (!state.drag && !winDrag) setIgnore(true); });

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
    const spot = t && walkable(t.x, t.y) ? t : nearestWalkable(t?.x ?? 0, t?.y ?? 0);
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
  desk.invoke('settings:set', { roomZoom: clamp(z, 1, 4) });
}

document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 1));
document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 1));
document.getElementById('btn-focus').addEventListener('click', () => desk.invoke('focus:toggle'));
document.getElementById('btn-guild').addEventListener('click', () => desk.invoke('window:open', 'guild'));
document.getElementById('btn-settings').addEventListener('click', () => desk.invoke('window:open', 'settings'));
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
  if (room?.iso && JSON.stringify(room) !== JSON.stringify(state.room)) setRoom(room);
});
desk.on('assets', (assets) => {
  Common.loadSheets(assets);
  state.assets = assets;
});

window.RoomApp = { state, setRoom, layout, tileAt, finePoint, Z, clone, rebuildNav, toolbar, editorEl };

desk.invoke('init').then((init) => {
  state.settings = init.settings;
  state.zoom = init.settings.roomZoom;
  state.assets = init.assets;
  Common.loadSheets(init.assets);
  applyProgress(init.progress);
  if (init.room?.iso) state.room = clone(init.room);
  else desk.invoke('room:set', state.room);
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
