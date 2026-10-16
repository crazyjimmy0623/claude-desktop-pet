/* global desk, Sprites, Catalog, Common */
// Taskbar strip: characters stand above the taskbar, wander, can be dragged and clicked.
const DPR = window.devicePixelRatio || 1;
const GRAVITY = 1800;
const MAX_MINIS = 3;
const OUCH = ['唉唷！', '頭好暈…', '放我下來啦', '咚！'];

const stage = document.getElementById('stage');
const toastEl = document.getElementById('toast');
const views = new Map();
let settings = null;
let scale = 3;
let drag = null;
let mouseIgnored = true;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Whole device pixels per fine art pixel (half a logical pixel) keeps sprites crisp at any Windows display scaling.
const devUnit = (s) => 2 * Math.max(1, Math.round((s * DPR) / 2));
const spriteW = () => (Sprites.W * devUnit(scale)) / DPR;
const spriteH = () => (Sprites.H * devUnit(scale)) / DPR;
const snapCss = (v) => Math.round(v * DPR) / DPR;
const spacing = () => Math.max(150, spriteW() + 80);

function makeCanvas(unitScale, className) {
  const canvas = document.createElement('canvas');
  const u = devUnit(unitScale);
  canvas.width = Sprites.W * u;
  canvas.height = Sprites.H * u;
  canvas.style.width = `${canvas.width / DPR}px`;
  canvas.style.height = `${canvas.height / DPR}px`;
  if (className) canvas.className = className;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function freeSpot(self) {
  const W = window.innerWidth;
  const taken = [...views.values()].filter((v) => v !== self).map((v) => v.target ?? v.x);
  for (let x = W - 150; x > 80; x -= spacing()) {
    if (taken.every((t) => Math.abs(t - x) > spacing() - 30)) return x;
  }
  return 80 + Math.random() * (W - 200);
}

// ---- Views -------------------------------------------------------------------

function createView(actor) {
  const el = document.createElement('div');
  el.className = 'actor';
  const helpersEl = document.createElement('div');
  helpersEl.className = 'helpers';
  const bubble = document.createElement('div');
  bubble.className = 'bubble hidden';
  const zzz = document.createElement('div');
  zzz.className = 'zzz hidden';
  zzz.innerHTML = '<span>z</span><span>z</span><span>Z</span>';
  const { canvas, ctx } = makeCanvas(scale, 'body hit');
  const plate = document.createElement('div');
  plate.className = 'nameplate';
  el.append(helpersEl, bubble, zzz, canvas, plate);
  stage.append(el);

  const v = {
    id: actor.id, actor, el, canvas, ctx, bubble, zzz, plate, helpersEl, minis: [],
    x: 0, y: 170, vy: 0, facing: -1, target: null, nextWander: Date.now() + 4000 + Math.random() * 6000,
    dragging: false, wasDropped: false, card: null, drawKey: '', hop: 0,
  };
  v.x = freeSpot(v);
  el.style.setProperty('--c', Common.colorOf(actor).main);
  el.style.width = `${spriteW()}px`;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    drag = { v, sx: e.clientX, sy: e.clientY, moved: false };
  });
  canvas.addEventListener('dblclick', () => desk.send('actor:pat', v.id));
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    desk.send('actor:menu', v.id);
  });
  views.set(v.id, v);
  return v;
}

function removeView(v) {
  v.el.remove();
  views.delete(v.id);
}

function syncActors(list) {
  const seen = new Set();
  for (const actor of list) {
    seen.add(actor.id);
    const v = views.get(actor.id) || createView(actor);
    const wasLeaving = v.actor.state === 'leaving';
    v.actor = actor;
    v.plate.textContent = actor.kind === 'user' ? `⭐ ${actor.name}` : actor.name;
    v.plate.classList.toggle('user', actor.kind === 'user');
    if (actor.state === 'leaving' && !wasLeaving) {
      closeCard(v);
      v.target = v.x > window.innerWidth / 2 ? window.innerWidth + 80 : -80;
    }
    if (actor.state !== 'idle' && actor.state !== 'leaving') v.target = null;
    v.drawKey = '';
  }
  for (const v of [...views.values()]) if (!seen.has(v.id)) removeView(v);
}

function rebuildCanvases() {
  for (const v of views.values()) {
    const { canvas, ctx } = makeCanvas(scale, 'body hit');
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      drag = { v, sx: e.clientX, sy: e.clientY, moved: false };
    });
    canvas.addEventListener('dblclick', () => desk.send('actor:pat', v.id));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      desk.send('actor:menu', v.id);
    });
    v.canvas.replaceWith(canvas);
    v.canvas = canvas;
    v.ctx = ctx;
    v.el.style.width = `${spriteW()}px`;
    v.minis.forEach((m) => m.canvas.remove());
    v.minis = [];
    v.drawKey = '';
  }
}

// ---- Behaviour ---------------------------------------------------------------

function pickWander(v, now) {
  const W = window.innerWidth;
  for (let tries = 0; tries < 6; tries++) {
    const step = (60 + Math.random() * 160) * (Math.random() < 0.5 ? -1 : 1);
    const t = clamp(v.x + step, 70, W - 70);
    const crowded = [...views.values()].some((o) => o !== v && Math.abs((o.target ?? o.x) - t) < spacing() - 30);
    if (!crowded) {
      v.target = t;
      return;
    }
  }
  v.nextWander = now + 5000;
}

function renderMinis(v, now) {
  const want = Math.min(v.actor.helpers, MAX_MINIS);
  const miniScale = Math.max(1, scale - 1);
  while (v.minis.length < want) {
    const m = makeCanvas(miniScale);
    m.key = '';
    v.minis.push(m);
    v.helpersEl.append(m.canvas);
  }
  while (v.minis.length > want) v.minis.pop().canvas.remove();
  v.minis.forEach((m, i) => {
    const frame = Math.floor(now / 240 + i * 0.5) % 2;
    const key = `${frame}:${v.actor.skin}`;
    if (m.key === key) return;
    m.key = key;
    m.ctx.setTransform(1, 0, 0, 1, 0, 0);
    m.ctx.clearRect(0, 0, m.canvas.width, m.canvas.height);
    Common.drawActorAt(m.ctx, devUnit(miniScale), 0, 0, v.actor, 'command', frame, 1, { prop: false }, now);
  });
  let more = v.helpersEl.querySelector('.more');
  if (v.actor.helpers > MAX_MINIS) {
    if (!more) {
      more = document.createElement('div');
      more.className = 'more';
      v.helpersEl.append(more);
    }
    more.textContent = `+${v.actor.helpers - MAX_MINIS}`;
  } else if (more) {
    more.remove();
  }
}

function update(v, dt, now) {
  const a = v.actor;
  if (!v.dragging && v.y > 0) {
    v.vy -= GRAVITY * dt;
    v.y = Math.max(0, v.y + v.vy * dt);
    if (v.y === 0) {
      v.vy = 0;
      if (v.wasDropped) {
        v.wasDropped = false;
        showFloat(v, pick(OUCH), 'float-text');
      }
    }
  }

  let moving = false;
  const talkTo = now < (v.talkUntil || 0) ? views.get(v.talkTarget) : null;
  if (talkTo && !v.dragging && v.y === 0) {
    const side = v.x <= talkTo.x ? -1 : 1;
    const goal = clamp(talkTo.x + side * (spriteW() * 0.75), 40, window.innerWidth - 40);
    const d = goal - v.x;
    if (Math.abs(d) > 2) {
      v.x += Math.sign(d) * Math.min(Math.abs(d), 110 * dt);
      v.facing = Math.sign(d);
      moving = true;
    } else {
      v.facing = Math.sign(talkTo.x - v.x) || v.facing;
    }
    v.target = null;
  }
  const canWalk = !talkTo && !v.dragging && v.y === 0 && (a.state === 'idle' || a.state === 'leaving');
  if (canWalk) {
    if (a.state === 'idle' && v.target == null && now > v.nextWander) pickWander(v, now);
    if (v.target != null) {
      const d = v.target - v.x;
      const speed = a.state === 'leaving' ? 90 : 30;
      if (Math.abs(d) < 1) {
        v.x = v.target;
        v.target = null;
        v.nextWander = now + 5000 + Math.random() * 10000;
      } else {
        v.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        v.facing = Math.sign(d);
        moving = true;
      }
    }
  }

  const talking = talkTo && !moving;
  const { pose, frame, station } = talking
    ? { pose: 'rest', frame: Math.floor(now / 300) % 2, station: null }
    : Common.poseFor(a, { moving, dragging: v.dragging, now });
  const prop = !!(station && Catalog.STATIONS[station].prop);
  const key = `${pose}:${frame}:${v.facing}:${a.skin}:${a.accessory}:${prop}:${Common.sheets.has(a.skin) ? Math.floor(now / 80) : ''}`;
  if (key !== v.drawKey) {
    v.drawKey = key;
    v.ctx.setTransform(1, 0, 0, 1, 0, 0);
    v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
    Common.drawActorAt(v.ctx, devUnit(scale), 0, 0, a, pose, frame, v.facing, { prop }, now);
  }

  const hop = a.state === 'wait' && !v.dragging ? Math.abs(Math.sin(now / 160)) * 8 : 0;
  v.el.style.transform = `translate(${snapCss(v.x - spriteW() / 2)}px, ${-snapCss(v.y + hop)}px)`;
  v.el.classList.toggle('dragging', v.dragging);
  v.el.style.zIndex = v.card || v.dragging ? 5 : a.state === 'wait' ? 4 : a.state === 'done' ? 3 : a.kind === 'user' ? 2 : 1;

  const b = v.card ? null : Common.bubbleFor(a, now);
  v.bubble.classList.toggle('hidden', !b);
  if (b) {
    if (v.bubble.textContent !== b.text) v.bubble.textContent = b.text;
    const cls = `bubble ${b.cls}`.trim();
    if (v.bubble.className !== cls) v.bubble.className = cls;
  }
  v.zzz.classList.toggle('hidden', a.state !== 'sleep' || v.dragging);
  renderMinis(v, now);
  if (v.card && now >= v.cardUntil) closeCard(v);
  else if (v.card && Math.floor(now / 1000) !== v.cardSecond) fillCard(v, now);
}

// ---- Info card -----------------------------------------------------------------

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
    s.title = value;
    row.append(b, s);
    v.card.append(row);
  }
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = '雙擊摸頭・右鍵更多・拖曳甩一甩';
  v.card.append(hint);
}

function openCard(v) {
  v.card = document.createElement('div');
  v.card.className = 'card hit';
  v.card.addEventListener('mousedown', () => closeCard(v));
  v.el.append(v.card);
  v.cardUntil = Date.now() + 10000;
  fillCard(v, Date.now());
}

function closeCard(v) {
  if (!v.card) return;
  v.card.remove();
  v.card = null;
}

// ---- Effects -------------------------------------------------------------------

function showFloat(v, text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  v.el.append(el);
  setTimeout(() => el.remove(), 1600);
}

function fxCanvas(kind, unit) {
  const fx = Sprites.FX[kind];
  const canvas = document.createElement('canvas');
  canvas.width = fx.w * devUnit(unit);
  canvas.height = fx.h * devUnit(unit);
  canvas.style.width = `${canvas.width / DPR}px`;
  canvas.style.height = `${canvas.height / DPR}px`;
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}

function animateFx(canvas, kind, unit, ms, facing = 1, frameFn) {
  const ctx = canvas.getContext('2d');
  const start = performance.now();
  let last = -1;
  const step = (t) => {
    if (!canvas.isConnected) return;
    const frame = frameFn ? frameFn(t - start) : Math.floor((t - start) / 200) % 2;
    if (frame !== last) {
      last = frame;
      Sprites.drawFx(ctx, devUnit(unit), kind, frame, facing);
    }
    if (!ms || t - start < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const chests = new Map();

function onFx(f) {
  const v = f.actorId ? views.get(f.actorId) : null;
  switch (f.type) {
    case 'coins':
      if (v) showFloat(v, `+${f.amount} 🪙`, 'float-coin');
      break;
    case 'heart':
      if (v) {
        const c = fxCanvas('heart', scale);
        c.className = 'float-heart';
        v.el.append(c);
        Sprites.drawFx(c.getContext('2d'), devUnit(scale), 'heart', 0);
        setTimeout(() => c.remove(), 1200);
      }
      break;
    case 'toast':
      showToast(f.text);
      break;
    case 'talk':
      if (v) {
        v.talkTarget = f.targetId;
        v.talkUntil = Date.now() + f.duration;
      }
      break;
    case 'bug': {
      if (!v) break;
      const c = fxCanvas('bug', scale);
      c.className = 'bug';
      v.el.append(c);
      animateFx(c, 'bug', scale, f.duration, -1);
      v.bugUntil = Date.now() + f.duration;
      setTimeout(() => {
        c.classList.add('poof');
        setTimeout(() => c.remove(), 400);
      }, f.duration);
      break;
    }
    case 'chest': {
      if (!v) break;
      const c = fxCanvas('chest', scale);
      c.className = 'chest hit';
      c.style.left = `${clamp(v.x + 40, 20, window.innerWidth - 60)}px`;
      stage.append(c);
      Sprites.drawFx(c.getContext('2d'), devUnit(scale), 'chest', 0);
      c.addEventListener('click', () => desk.invoke('chest:open', f.id));
      chests.set(f.id, c);
      break;
    }
    case 'chest-open': {
      const c = chests.get(f.id);
      if (!c) break;
      Sprites.drawFx(c.getContext('2d'), devUnit(scale), 'chest', 1);
      c.classList.remove('hit');
      const label = document.createElement('div');
      label.className = 'float-coin';
      label.textContent = `+${f.coins} 🪙`;
      label.style.left = c.style.left;
      label.style.bottom = '50px';
      label.style.position = 'absolute';
      stage.append(label);
      setTimeout(() => { c.remove(); label.remove(); chests.delete(f.id); }, 1600);
      break;
    }
    case 'chest-gone':
      chests.get(f.id)?.remove();
      chests.delete(f.id);
      break;
    case 'ufo': {
      const c = fxCanvas('ufo', scale);
      c.className = 'ufo';
      stage.append(c);
      animateFx(c, 'ufo', scale, 6000, -1);
      setTimeout(() => c.remove(), 6000);
      break;
    }
  }
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.add('hidden'), 4500);
}

function maybeButterfly() {
  if (!settings?.ambient || document.querySelector('.butterfly')) return;
  const c = fxCanvas('butterfly', scale);
  c.className = 'butterfly';
  const fromLeft = Math.random() < 0.5;
  c.style.setProperty('--from', fromLeft ? '-40px' : `${window.innerWidth + 40}px`);
  c.style.setProperty('--to', fromLeft ? `${window.innerWidth + 40}px` : '-40px');
  stage.append(c);
  animateFx(c, 'butterfly', scale, 20000, fromLeft ? 1 : -1, (t) => Math.floor(t / 150) % 2);
  setTimeout(() => c.remove(), 20000);
}

// ---- Mouse: click-through except over characters, plus drag & drop -------------

function setMouseIgnored(ignore) {
  if (ignore === mouseIgnored) return;
  mouseIgnored = ignore;
  desk.send('mouse:ignore', ignore);
}

window.addEventListener('mousemove', (e) => {
  if (drag) {
    const { v } = drag;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
      drag.moved = true;
      v.dragging = true;
      v.target = null;
      closeCard(v);
    }
    if (drag.moved) {
      v.x = clamp(e.clientX, 40, window.innerWidth - 40);
      v.y = clamp(window.innerHeight - e.clientY - spriteH() + 20, 0, window.innerHeight - spriteH() - 50);
      v.vy = 0;
    }
  }
  const overHit = !!e.target.closest?.('.hit');
  setMouseIgnored(!overHit && !drag);
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  const { v } = drag;
  if (drag.moved) {
    v.dragging = false;
    v.wasDropped = v.y > 20;
    v.nextWander = Date.now() + 4000;
  } else if (v.card) {
    closeCard(v);
  } else {
    openCard(v);
  }
  drag = null;
});

document.addEventListener('mouseleave', () => {
  if (!drag) setMouseIgnored(true);
});

// ---- Wiring ----------------------------------------------------------------------

function applySettings(s) {
  settings = s;
  if (s.scale !== scale) {
    scale = s.scale;
    rebuildCanvases();
  }
}

document.querySelectorAll('#dock button').forEach((b) => b.addEventListener('click', () => {
  const action = b.dataset.action;
  if (action === 'room') desk.invoke('settings:set', { mode: 'room' });
  else if (action === 'focus') desk.invoke('focus:toggle');
  else if (action === 'quit') desk.invoke('app:quit');
  else desk.invoke('window:open', action);
}));

desk.on('actors', syncActors);
desk.on('settings', applySettings);
desk.on('fx', onFx);
desk.on('assets', (assets) => {
  Common.loadSheets(assets);
  for (const v of views.values()) v.drawKey = '';
});
desk.on('command', (cmd) => {
  if (cmd.type !== 'regroup') return;
  const W = window.innerWidth;
  [...views.values()].forEach((v, i) => {
    v.x = clamp(W - 150 - i * spacing(), 70, W - 70);
    v.y = 120;
    v.target = null;
    v.nextWander = Date.now() + 6000;
  });
});

desk.invoke('init').then((init) => {
  scale = init.settings.scale;
  settings = init.settings;
  Common.loadSheets(init.assets);
  syncActors(init.actors);
});

setInterval(() => { if (Math.random() < 0.08) maybeButterfly(); }, 60000);

let last = performance.now();
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const now = Date.now();
  for (const v of [...views.values()]) update(v, dt, now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
