/* global desk, Catalog, Sprites, Furniture, Common */
const $ = (id) => document.getElementById(id);
const DPR = window.devicePixelRatio || 1;
// Even device-pixel units so the 2x fine art grid lands on whole pixels.
const even = (cssScale) => 2 * Math.max(1, Math.round((cssScale * DPR) / 2));
const { ITEMS, RARITY, ACHIEVEMENTS } = Catalog;
const ACH_ICONS = ['🏅', '🎖️', '🏆', '⭐', '👑', '💎'];

let settings = null;
let progress = null;
let actors = [];
let assets = { characters: [], tiles: [] };
let target = 'user';
let tab = 'equip';

const itemById = (id) => ITEMS.find((i) => i.id === id);
const owns = (id) => progress?.owned.includes(id);

// ---- Previews ----------------------------------------------------------------------

function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w * DPR;
  c.height = h * DPR;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
}

function itemPreview(id, size = 2) {
  const [type, key] = id.split(':');
  const col = Sprites.colorsFor(210);
  if (type === 'skin') {
    const u = even(size);
    return canvasOf((Sprites.W * u) / DPR, (Sprites.H * u) / DPR, (x) => Sprites.drawCharacterAt(x, u, 0, 0, key, 'rest', 0, col, 1, {}));
  }
  if (type === 'accessory' || type === 'acc') {
    const u = even(size);
    return canvasOf((Sprites.W * u) / DPR, (Sprites.H * u) / DPR, (x) => Sprites.drawCharacterAt(x, u, 0, 0, 'office', 'rest', 0, col, 1, { accessory: key }));
  }
  if (type === 'floor') {
    return canvasOf(32 * size / 2, 32 * size / 2, (x) => {
      for (let i = 0; i < 4; i++) Furniture.drawFloorTile(x, (size / 2) * DPR, i % 2, Math.floor(i / 2), key);
    });
  }
  if (type === 'wall') {
    return canvasOf(32 * size / 2, 32 * size / 2, (x) => Furniture.drawWall(x, (size / 3) * DPR, { wall: key, w: 3, wallRows: 3 }));
  }
  if (type === 'obj') {
    const def = Furniture.OBJECTS[key];
    const s = Math.min(2, 64 / (def.w * 16));
    const top = def.wall ? 0 : 20;
    return canvasOf(def.w * 16 * s, (def.h * 16 + top) * s, (x) => {
      x.translate(0, top * s * DPR);
      Furniture.drawObject(x, even(s), { type: key, x: 0, y: 0 }, { frame: 0, active: true, now: Date.now(), hour: 12, meeting: true });
    });
  }
  return canvasOf(32, 32, () => {});
}

function itemCard(id, { locked = false, tag = null } = {}) {
  const item = itemById(id);
  const card = document.createElement('div');
  card.className = `item-card${locked ? ' locked' : ''}`;
  card.style.setProperty('--rarity', RARITY[item.rarity].color);
  card.append(itemPreview(id));
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = locked ? '？？？' : item.name;
  const rarity = document.createElement('div');
  rarity.className = 'rarity';
  rarity.textContent = RARITY[item.rarity].name;
  card.append(name, rarity);
  if (item.desc && !locked) card.title = item.desc;
  if (tag) {
    const t = document.createElement('span');
    t.className = `tag${tag === '重複' ? ' dup' : ''}`;
    t.textContent = tag;
    card.append(t);
  }
  return card;
}

// ---- Equip -------------------------------------------------------------------------

function projectNames() {
  const names = new Set(Object.keys(settings.characters.projects));
  for (const a of actors) if (a.kind !== 'user' && a.name) names.add(a.name);
  return [...names].sort();
}

function slotFor(t) {
  const c = settings.characters;
  if (t === 'user') return c.user;
  if (t === 'ai') return c.ai;
  return c.projects[t.slice(8)] || c.ai;
}

function renderEquip() {
  const targets = $('targets');
  targets.replaceChildren();
  const add = (id, label) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('active', target === id);
    b.addEventListener('click', () => { target = id; renderEquip(); });
    targets.append(b);
  };
  add('user', `⭐ ${settings.userName}`);
  add('ai', '🤖 AI 夥伴預設');
  for (const n of projectNames()) add(`project:${n}`, `📁 ${n}`);

  const slot = slotFor(target);
  const skins = ITEMS.filter((i) => i.type === 'skin' && owns(i.id)).map((i) => ({ key: i.id.slice(5), name: i.name }));
  for (const c of assets.characters) skins.push({ key: c.id, name: `${c.name}（自訂）`, custom: true });
  if (target !== 'user') skins.unshift({ key: 'auto', name: '🎲 每個 session 自動換', custom: true });
  const skinList = $('skin-list');
  skinList.replaceChildren();
  for (const s of skins) {
    const b = document.createElement('button');
    if (!s.custom) b.append(canvasOf((Sprites.MINI.W * 4) / DPR, (Sprites.MINI.H * 4) / DPR, (x) => Sprites.drawMiniAt(x, 4, 0, 0, s.key, 'rest', 0, Sprites.colorsFor(210), 1, {})));
    b.append(document.createTextNode(s.name));
    b.classList.toggle('active', slot.skin === s.key);
    b.addEventListener('click', () => desk.invoke('equip', { target, skin: s.key }));
    skinList.append(b);
  }
  const accList = $('acc-list');
  accList.replaceChildren();
  const accs = [{ key: null, name: '無' }, ...ITEMS.filter((i) => i.type === 'accessory' && owns(i.id)).map((i) => ({ key: i.id.slice(4), name: i.name }))];
  for (const a of accs) {
    const b = document.createElement('button');
    b.textContent = a.name;
    b.classList.toggle('active', (slot.accessory || null) === a.key);
    b.addEventListener('click', () => desk.invoke('equip', { target, accessory: a.key }));
    accList.append(b);
  }
  if (target.startsWith('project:') && settings.characters.projects[target.slice(8)]) {
    const b = document.createElement('button');
    b.textContent = '↺ 改回 AI 預設';
    b.addEventListener('click', () => desk.invoke('project:forget', target.slice(8)));
    accList.append(b);
  }
  $('equip-name').textContent = target === 'user' ? settings.userName : target === 'ai' ? 'AI 夥伴' : target.slice(8);
}

function animateEquip() {
  const c = $('equip-canvas');
  const scale = 5;
  c.width = Sprites.W * even(scale);
  c.height = Sprites.H * even(scale);
  c.style.width = `${c.width / DPR}px`;
  c.style.height = `${c.height / DPR}px`;
  const ctx = c.getContext('2d');
  const poses = ['rest', 'type', 'hammer', 'read', 'done', 'dance'];
  const tickEquip = () => {
    if (settings && tab === 'equip') {
      const now = Date.now();
      const slot = slotFor(target);
      const pose = poses[Math.floor(now / 2500) % poses.length];
      const skin = slot.skin === 'auto' ? ['office', 'mage', 'cat', 'robot'][Math.floor(now / 2500) % 4] : slot.skin;
      const fake = { id: target, hue: 210, skin, accessory: slot.accessory };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      Common.drawActorAt(ctx, even(scale), 0, 0, fake, pose, Math.floor(now / 300) % 2, 1, { prop: true }, now);
    }
    requestAnimationFrame(tickEquip);
  };
  tickEquip();
}

// ---- Gacha -------------------------------------------------------------------------

async function pull(count) {
  $('gacha-error').textContent = '';
  const res = await desk.invoke('gacha:pull', count);
  if (res.error) {
    $('gacha-error').textContent = res.error;
    return;
  }
  const box = $('gacha-results');
  box.replaceChildren();
  res.results.forEach((r, i) => {
    const card = itemCard(r.id, { tag: r.duplicate ? '重複' : 'NEW' });
    card.style.animationDelay = `${i * 0.12}s`;
    box.append(card);
  });
}

$('pull-1').addEventListener('click', () => pull(1));
$('pull-10').addEventListener('click', () => pull(10));

function renderRates() {
  const pool = ITEMS.filter((i) => RARITY[i.rarity].weight > 0);
  const total = pool.reduce((s, i) => s + RARITY[i.rarity].weight, 0);
  const by = {};
  for (const i of pool) by[i.rarity] = (by[i.rarity] || 0) + RARITY[i.rarity].weight;
  $('rates').textContent = `機率：${Object.entries(by).map(([r, w]) => `${RARITY[r].name} ${(w / total * 100).toFixed(1)}%`).join('・')}`;
}

// ---- Book & achievements -------------------------------------------------------------

function renderBook() {
  const book = $('book');
  book.replaceChildren();
  const groups = [['skin', '角色'], ['accessory', '配件'], ['furniture', '家具'], ['floor', '地板'], ['wall', '牆面']];
  for (const [type, label] of groups) {
    const h = document.createElement('h3');
    const items = ITEMS.filter((i) => i.type === type);
    h.textContent = `${label}（${items.filter((i) => owns(i.id)).length}/${items.length}）`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const i of items) grid.append(itemCard(i.id, { locked: !owns(i.id) }));
    book.append(h, grid);
  }
  $('book-count').textContent = `${progress.owned.length}/${ITEMS.length}`;
}

function renderAchievements() {
  const box = $('achievements');
  box.replaceChildren();
  let got = 0;
  ACHIEVEMENTS.forEach((a, idx) => {
    const at = progress.achievements[a.id];
    if (at) got += 1;
    const el = document.createElement('div');
    el.className = `achievement${at ? '' : ' locked'}`;
    el.innerHTML = `<span class="icon">${ACH_ICONS[idx % ACH_ICONS.length]}</span><div><b></b><small></small></div>`;
    el.querySelector('b').textContent = `${a.name}（+${a.reward} 🪙）`;
    el.querySelector('small').textContent = at ? `${a.desc}・${new Date(at).toLocaleDateString()}` : a.desc;
    box.append(el);
  });
  $('ach-count').textContent = `${got}/${ACHIEVEMENTS.length}`;
}

// ---- Share card ----------------------------------------------------------------------

function weekSummary() {
  const days = progress.days;
  const totals = { turns: 0, tools: 0, activeMinutes: 0, focus: 0, projects: {}, toolsBy: {} };
  const d = new Date();
  const first = new Date();
  first.setDate(first.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = days[key];
    if (day) {
      totals.turns += day.turns;
      totals.tools += day.tools;
      totals.activeMinutes += day.activeMinutes;
      totals.focus += day.focus;
      for (const [k, v] of Object.entries(day.projects)) totals.projects[k] = (totals.projects[k] || 0) + v;
      for (const [k, v] of Object.entries(day.toolsBy)) totals.toolsBy[k] = (totals.toolsBy[k] || 0) + v;
    }
    d.setDate(d.getDate() - 1);
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
  return { ...totals, topProject: top(totals.projects), topTool: top(totals.toolsBy), from: first, to: new Date() };
}

function renderShare() {
  const W = 1200;
  const H = 630;
  const c = $('share');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const w = weekSummary();

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b2540');
  g.addColorStop(1, '#3d2f5a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1d1b26';
  ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8); ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);

  // Floor strip with the crew standing on it.
  const floorY = 470;
  ctx.save();
  for (let x = 40; x < 560; x += 32) {
    ctx.save();
    ctx.translate(x, floorY);
    Furniture.drawFloorTile(ctx, 2, 0, 0, 'wood');
    ctx.restore();
  }
  ctx.restore();
  const crew = [];
  const user = actors.find((a) => a.kind === 'user');
  crew.push(user || { id: 'user', hue: 35, skin: settings.characters.user.skin, accessory: settings.characters.user.accessory });
  for (const a of actors.filter((x) => x.kind !== 'user').slice(0, 3)) crew.push(a);
  if (crew.length < 3) crew.push({ id: 'ai', hue: 200, skin: settings.characters.ai.skin, accessory: settings.characters.ai.accessory });
  const poses = ['done', 'hammer', 'read', 'type'];
  crew.forEach((a, i) => {
    const scale = 4;
    Common.drawActorAt(ctx, scale, 50 + i * 130, floorY - Sprites.H * scale + 6, a, poses[i % poses.length], 1, 1, { prop: false }, Date.now());
  });

  const font = (size, weight = 800) => `${weight} ${size}px "Microsoft JhengHei UI", "Microsoft JhengHei", sans-serif`;
  ctx.fillStyle = '#ffe066';
  ctx.font = font(52);
  ctx.fillText('Deskmates 本週戰績', 50, 92);
  ctx.fillStyle = '#c9bfe6';
  ctx.font = font(24, 400);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  ctx.fillText(`${fmt(w.from)} – ${fmt(w.to)}・公會 Lv.${progress.level}・連續上工 ${progress.stats.streak} 天`, 52, 134);

  const stats = [
    ['完成回合', w.turns],
    ['使用工具', w.tools],
    ['陪伴時數', `${(w.activeMinutes / 60).toFixed(1)} h`],
    ['番茄鐘', w.focus],
    ['最常用工具', w.topTool ? `${w.topTool[0]}` : '—'],
    ['最忙專案', w.topProject ? w.topProject[0] : '—'],
    ['成就', `${Object.keys(progress.achievements).length}/${ACHIEVEMENTS.length}`],
    ['收藏', `${progress.owned.length}/${ITEMS.length}`],
  ];
  stats.forEach(([label, value], i) => {
    const x = 640 + (i % 2) * 270;
    const y = 200 + Math.floor(i / 2) * 100;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y - 44, 250, 84);
    ctx.fillStyle = '#c9bfe6';
    ctx.font = font(20, 400);
    ctx.fillText(label, x + 16, y - 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(32);
    const text = String(value);
    ctx.fillText(text.length > 12 ? `${text.slice(0, 11)}…` : text, x + 16, y + 26);
  });

  ctx.fillStyle = '#8f86ad';
  ctx.font = font(18, 400);
  ctx.fillText('github.com/crazyjimmy0623/deskmates', 52, H - 36);
}

$('share-save').addEventListener('click', async () => {
  const file = await desk.invoke('share:save', $('share').toDataURL('image/png'));
  $('share-status').textContent = `已儲存：${file}`;
});
$('share-copy').addEventListener('click', async () => {
  await desk.invoke('share:copy', $('share').toDataURL('image/png'));
  $('share-status').textContent = '已複製，可以直接貼上';
});

// ---- Tabs & wiring -------------------------------------------------------------------

function showTab(name) {
  tab = name;
  document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== `tab-${name}`));
  render();
}

document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

function render() {
  if (!settings || !progress) return;
  $('coins').textContent = `${progress.coins} 🪙`;
  $('level').textContent = `Lv.${progress.level}（${progress.xp - progress.levelFloor}/${progress.levelCeil - progress.levelFloor} XP）`;
  if (tab === 'equip') renderEquip();
  if (tab === 'book') renderBook();
  if (tab === 'achievements') renderAchievements();
  if (tab === 'stats') renderShare();
}

desk.on('settings', (s) => { settings = s; render(); });
desk.on('progress', (p) => { progress = p; render(); });
desk.on('actors', (list) => {
  const before = projectNames && settings ? projectNames().join() : '';
  actors = list;
  if (tab === 'equip' && settings && projectNames().join() !== before) renderEquip();
});
desk.on('assets', (a) => { assets = a; Common.loadSheets(a); render(); });
desk.on('guild:tab', (t) => {
  if (!t) return;
  if (t.startsWith('equip:')) {
    target = t.slice(6);
    showTab('equip');
  } else {
    showTab(t);
  }
});

desk.invoke('init').then((init) => {
  settings = init.settings;
  progress = init.progress;
  actors = init.actors;
  assets = init.assets;
  Common.loadSheets(assets);
  renderRates();
  animateEquip();
  render();
});
