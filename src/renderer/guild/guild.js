/* global desk, Catalog, Sprites, Iso, Common */
// In the drawer the page lays its cards out side by side, scrolling sideways.
if (new URLSearchParams(location.search).has('docked')) document.documentElement.classList.add('docked');
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
    const f = Iso.FLOORS[key];
    return canvasOf(32 * size / 2, 32 * size / 2, (x) => {
      const s = (size / 2) * DPR;
      x.fillStyle = f?.base || '#888';
      x.beginPath();
      x.moveTo(16 * s, 6 * s); x.lineTo(31 * s, 14 * s); x.lineTo(16 * s, 22 * s); x.lineTo(1 * s, 14 * s);
      x.fill();
    });
  }
  if (type === 'wall') {
    const w = Iso.WALLS[key];
    return canvasOf(32 * size / 2, 32 * size / 2, (x) => {
      const s = (size / 2) * DPR;
      x.fillStyle = w?.base || '#888';
      x.fillRect(4 * s, 3 * s, 24 * s, 24 * s);
      x.fillStyle = w?.trim || '#444';
      x.fillRect(4 * s, 23 * s, 24 * s, 4 * s);
    });
  }
  if (type === 'obj') {
    const sp = Iso.objectSprite(key, false, { frame: 0, active: true, now: Date.now(), hour: 12, meeting: true });
    const s = Math.max(1, Math.min(2, Math.floor(80 / sp.canvas.width)));
    return canvasOf((sp.canvas.width * s) / DPR, (sp.canvas.height * s) / DPR, (x) => {
      x.imageSmoothingEnabled = false;
      x.drawImage(sp.canvas, 0, 0, sp.canvas.width * s, sp.canvas.height * s);
    });
  }
  if (type === 'block' && Iso.BLOCKS[key]) {
    const sp = Iso.blockSprite(key);
    return canvasOf((sp.canvas.width * 2) / DPR, (sp.canvas.height * 2) / DPR, (x) => {
      x.imageSmoothingEnabled = false;
      x.drawImage(sp.canvas, 0, 0, sp.canvas.width * 2, sp.canvas.height * 2);
    });
  }
  if (type === 'block' || type === 'land') {
    // Stairs and plots: a big emoji is enough.
    return canvasOf(40, 40, (x) => {
      x.font = `${26 * DPR}px sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(type === 'land' ? '🟩' : key === 'spiral' ? '🌀' : '🪜', 20 * DPR, 21 * DPR);
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
  for (const a of actors) if (a.kind === 'ai' && a.name) names.add(a.name);
  return [...names].sort();
}

function slotFor(t) {
  const c = settings.characters;
  if (t === 'user') return c.user;
  if (t === 'ai') return c.ai;
  if (t.startsWith('resident:')) return (c.residents || []).find((r) => r.id === t.slice(9)) || c.user;
  return c.projects[t.slice(8)] || c.ai;
}
const residents = () => settings.characters.residents || [];

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
  for (const r of residents()) add(`resident:${r.id}`, `🏡 ${r.name}`);
  add('ai', '🤖 AI 夥伴預設');
  for (const n of projectNames()) add(`project:${n}`, `📁 ${n}`);
  // Residents: anyone can invite a few characters to live in the room, AI or not.
  const invite = document.createElement('button');
  invite.className = 'invite';
  invite.textContent = '＋ 邀請居民';
  invite.title = '找個角色住進房間，他會自己看書、喝咖啡、打電動，晚上去睡覺';
  invite.addEventListener('click', async () => {
    const res = await desk.invoke('resident:add', '');
    if (res?.error) { $('equip-name').textContent = res.error; return; }
    target = `resident:${res.id}`;
    renderEquip();
  });
  targets.append(invite);
  if (target.startsWith('resident:') && !residents().some((r) => r.id === target.slice(9))) target = 'user';

  const slot = slotFor(target);
  const skins = ITEMS.filter((i) => i.type === 'skin' && owns(i.id)).map((i) => ({ key: i.id.slice(5), name: i.name }));
  for (const m of settings.characters.customs || []) skins.push({ key: `mix:${m.id}`, name: `👗 ${m.name}` });
  for (const d of settings.characters.drawings || []) skins.push({ key: `draw:${d.id}`, name: `${d.friend ? '💌' : '🖌️'} ${d.name}` });
  for (const c of assets.characters) skins.push({ key: c.id, name: `${c.name}（自訂）`, custom: true });
  if (target === 'ai' || target.startsWith('project:')) skins.unshift({ key: 'auto', name: '🎲 每開一個新對話就換', custom: true });
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
  const res = target.startsWith('resident:') ? residents().find((r) => r.id === target.slice(9)) : null;
  $('equip-name').textContent = target === 'user' ? settings.userName : target === 'ai' ? 'AI 夥伴' : res ? res.name : target.slice(8);
  // A resident's name, and seeing them out.
  const own = $('resident-tools');
  own.classList.toggle('hidden', !res);
  if (res) {
    const input = $('resident-name');
    if (document.activeElement !== input) input.value = res.name;
    input.onchange = () => desk.invoke('resident:rename', { id: res.id, name: input.value });
    $('resident-remove').onclick = () => {
      if (window.confirm(`確定請「${res.name}」搬走嗎？`)) desk.invoke('resident:remove', res.id);
    };
  }
}

function animateEquip() {
  const c = $('equip-canvas');
  const scale = 5;
  c.width = Sprites.W * even(scale);
  c.height = Sprites.H * even(scale);
  c.style.width = `${c.width / DPR}px`;
  c.style.height = `${c.height / DPR}px`;
  const ctx = c.getContext('2d');
  const poses = ['rest', 'type', 'command', 'read', 'done', 'dance'];
  const tickEquip = () => {
    if (settings && tab === 'equip') {
      const now = Date.now();
      const slot = slotFor(target);
      const pose = poses[Math.floor(now / 2500) % poses.length];
      const skin = slot.skin === 'auto' ? ['office', 'scientist', 'cat', 'robot'][Math.floor(now / 2500) % 4] : slot.skin;
      const fake = { id: target, hue: 210, skin, accessory: slot.accessory };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      Common.drawActorAt(ctx, even(scale), 0, 0, fake, pose, Math.floor(now / 300) % 2, 1, { prop: true }, now);
    }
    requestAnimationFrame(tickEquip);
  };
  tickEquip();
}

// ---- Character studio ------------------------------------------------------------------
// Dress-up, not a form: a big character in the middle, pictures to click underneath, a dice for
// a surprise. Parts from recruited characters unlock with them.

const studio = { id: null, cat: 'head', recipe: null, saved: false, mode: 'dress' };
const STUDIO_CATS = [['head', '🙂', '頭'], ['hat', '💇', '頭髮'], ['body', '👕', '身體'], ['extra', '🎀', '配件'], ['colors', '🎨', '顏色']];
const COLOR_ROWS = [['skin', '膚色／毛色'], ['body', '衣服'], ['leg', '褲子'], ['boot', '鞋子'], ['hair', '頭髮']];
const partOpen = (kind, key) => !Sprites.PART_FROM[`${kind}:${key}`] || owns(`skin:${Sprites.PART_FROM[`${kind}:${key}`]}`);
const freshRecipe = () => ({ head: 'face', hat: 'hair', body: 'shirt', extra: 'none', colors: { skin: '#f6cfa6', body: '#f4f4f6', leg: '#3b4256', boot: '#262a38', hair: '#3a2a20' } });

// A whole character with this recipe, small, for a tile.
function recipeCanvas(recipe, unit = 2, pose = 'rest') {
  Sprites.SKINS['mix:__tile'] = Sprites.skinFor(recipe);
  return canvasOf((Sprites.W * unit) / DPR, (Sprites.H * unit) / DPR, (x) => Sprites.drawCharacterAt(x, unit, 0, 0, 'mix:__tile', pose, 0, Sprites.colorsFor(210), 1, {}));
}

function renderStudio() {
  if (!studio.recipe) studio.recipe = freshRecipe();
  // Three ways to make someone: dress up, draw, or bring a photo.
  document.querySelectorAll('.studio-modes .mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === studio.mode));
  for (const m of ['dress', 'draw', 'photo']) document.querySelectorAll(`#tab-studio .mode-${m}`).forEach((el) => el.classList.toggle('hidden', studio.mode !== m));
  renderMine();
  if (studio.mode === 'draw') renderPaint();
  if (studio.mode === 'photo') renderPhoto();
  if (studio.mode !== 'dress') return;
  const r = studio.recipe;
  // Categories along the top: icons first.
  const cats = $('studio-cats');
  cats.replaceChildren();
  for (const [id, icon, name] of STUDIO_CATS) {
    if (id === 'hat' && r.head !== 'face') continue;
    const b = document.createElement('button');
    b.innerHTML = `<span class="ico">${icon}</span><span>${name}</span>`;
    b.classList.toggle('active', studio.cat === id);
    b.addEventListener('click', () => { studio.cat = id; renderStudio(); });
    cats.append(b);
  }
  if (studio.cat === 'hat' && r.head !== 'face') studio.cat = 'head';
  // The choices: each one a picture of your character wearing it.
  const box = $('studio-options');
  box.replaceChildren();
  box.className = `studio-options ${studio.cat === 'colors' ? 'colors' : ''}`;
  if (studio.cat === 'colors') {
    for (const [key, label] of COLOR_ROWS) {
      if (key === 'hair' && !(r.head === 'face' && r.hat !== 'none')) continue;
      const row = document.createElement('div');
      row.className = 'swatch-row';
      const b = document.createElement('b');
      b.textContent = label;
      row.append(b);
      for (const col of Sprites.SWATCHES[key]) {
        const s = document.createElement('button');
        s.className = 'swatch';
        s.style.background = col;
        s.classList.toggle('active', (r.colors[key] || '') === col);
        s.addEventListener('click', () => { r.colors[key] = col; studio.saved = false; renderStudio(); });
        row.append(s);
      }
      box.append(row);
    }
  } else {
    for (const [key, name] of Object.entries(Sprites.PARTS[studio.cat])) {
      const open = partOpen(studio.cat, key);
      const b = document.createElement('button');
      b.className = 'part';
      b.append(recipeCanvas({ ...r, [studio.cat]: key }, 3));
      const label = document.createElement('span');
      label.textContent = open ? name : '🔒 抽到才有';
      b.append(label);
      b.classList.toggle('active', r[studio.cat] === key);
      b.classList.toggle('locked', !open);
      if (!open) b.title = `招募到「${ITEMS.find((i) => i.id === `skin:${Sprites.PART_FROM[`${studio.cat}:${key}`]}`)?.name}」就能用`;
      b.addEventListener('click', () => {
        if (!open) return;
        r[studio.cat] = key;
        studio.saved = false;
        renderStudio();
      });
      box.append(b);
    }
  }
  $('studio-delete').classList.toggle('hidden', !studio.id);
  $('studio-wear').classList.toggle('hidden', !studio.id);
  $('studio-save').textContent = studio.id && studio.saved ? '✓ 已存好' : '✨ 完成';
}

// Your characters, dressed-up and drawn, and a fresh one.
function renderMine() {
  const list = $('studio-list');
  list.replaceChildren();
  const fresh = document.createElement('button');
  fresh.className = 'mine new';
  fresh.innerHTML = '<span class="ico">＋</span><span>新角色</span>';
  fresh.addEventListener('click', () => {
    if (studio.mode === 'draw') loadPaint(null);
    else if (studio.mode === 'photo') photo.img = null;
    else {
      Object.assign(studio, { id: null, recipe: freshRecipe(), saved: false });
      $('studio-name').value = '';
    }
    renderStudio();
  });
  list.append(fresh);
  for (const m of settings.characters.customs || []) {
    const b = document.createElement('button');
    b.className = 'mine';
    b.append(recipeCanvas(m.recipe, 3));
    const label = document.createElement('span');
    label.textContent = `👗 ${m.name}`;
    b.append(label);
    b.classList.toggle('active', studio.mode === 'dress' && studio.id === m.id);
    b.addEventListener('click', () => {
      Object.assign(studio, { id: m.id, recipe: JSON.parse(JSON.stringify(m.recipe)), saved: true, mode: 'dress' });
      studio.recipe.colors ||= {};
      $('studio-name').value = m.name;
      renderStudio();
    });
    list.append(b);
  }
  for (const d of (settings.characters.drawings || []).filter((x) => !x.friend)) {
    const b = document.createElement('button');
    b.className = 'mine';
    b.append(canvasOf((Sprites.W * 3) / DPR, (Sprites.H * 3) / DPR, (x) => Sprites.drawCharacterAt(x, 3, 0, 0, `draw:${d.id}`, 'rest', 0, Sprites.colorsFor(210), 1, { prop: false })));
    const label = document.createElement('span');
    label.textContent = `🖌️ ${d.name}`;
    b.append(label);
    b.classList.toggle('active', studio.mode === 'draw' && paint.id === d.id);
    b.addEventListener('click', () => {
      if (studio.mode === 'draw' && !paint.saved && paint.poses.base.some(Boolean) && paint.id !== d.id && !window.confirm('現在這張還沒存，要換掉嗎？')) return;
      loadPaint(d);
      studio.mode = 'draw';
      renderStudio();
    });
    list.append(b);
  }
}

async function saveStudio() {
  const res = await desk.invoke('custom:save', { id: studio.id, name: $('studio-name').value, recipe: studio.recipe });
  if (res?.error) { $('studio-save').textContent = res.error; return null; }
  studio.id = res.id;
  studio.saved = true;
  return res.id;
}

$('studio-random').addEventListener('click', () => {
  studio.recipe = Sprites.randomRecipe(partOpen);
  studio.saved = false;
  renderStudio();
});
$('studio-save').addEventListener('click', async () => { await saveStudio(); renderStudio(); });
$('studio-wear').addEventListener('click', async () => {
  const id = studio.saved ? studio.id : await saveStudio();
  if (id) desk.invoke('equip', { target: 'user', skin: `mix:${id}` });
  $('studio-wear').textContent = '👕 穿上了！';
  setTimeout(() => { $('studio-wear').textContent = '👕 我要穿'; }, 1800);
});
$('studio-delete').addEventListener('click', () => {
  if (!studio.id || !window.confirm('確定刪掉這個角色嗎？')) return;
  desk.invoke('custom:remove', studio.id);
  Object.assign(studio, { id: null, recipe: freshRecipe(), saved: false });
  $('studio-name').value = '';
});

// The big preview: walking, working, dancing in turn.
function animateStudio() {
  const c = $('studio-canvas');
  const unit = even(4.5);
  c.width = Sprites.W * unit;
  c.height = Sprites.H * unit;
  c.style.width = `${c.width / DPR}px`;
  c.style.height = `${c.height / DPR}px`;
  const ctx = c.getContext('2d');
  const poses = ['rest', 'walk', 'type', 'read', 'dance', 'done'];
  const tick = () => {
    if (settings && tab === 'studio' && studio.recipe) {
      const now = Date.now();
      Sprites.SKINS['mix:__studio'] = Sprites.skinFor(studio.recipe);
      const pose = poses[Math.floor(now / 2200) % poses.length];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      Common.drawActorAt(ctx, unit, 0, 0, { id: 'studio', hue: 210, skin: 'mix:__studio' }, pose, Math.floor(now / 300) % 2, 1, { prop: true }, now);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

// ---- Gacha -------------------------------------------------------------------------

async function pull(count) {
  $('gacha-error').textContent = '';
  for (const [i, d] of [1, -1, 1, 0].entries()) setTimeout(() => drawMachine(d), i * 70);
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

// A little capsule machine, drawn in pixels: a glass dome of capsules on a red stand. It shakes
// while pulling.
function drawMachine(shake = 0) {
  const c = $('gacha-machine');
  const S = 4;
  c.width = 32 * S;
  c.height = 40 * S;
  c.style.width = `${32 * 3}px`;
  c.style.height = `${40 * 3}px`;
  const x = c.getContext('2d');
  const px = (X, Y, w, h, col) => { x.fillStyle = col; x.fillRect((X + shake) * S, Y * S, w * S, h * S); };
  // Dome.
  for (let y = 0; y < 18; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 81 - (y - 9) ** 2)) * 1.25);
    px(16 - half, 2 + y, half * 2, 1, y < 2 || y > 15 ? '#9ec9d8' : '#cfe9f1');
  }
  const caps = ['#f2685a', '#f0b54d', '#7cc47f', '#5aa7ff', '#c27bff', '#ff8fb1'];
  [[8, 11], [13, 13], [18, 12], [22, 10], [10, 15], [16, 16], [21, 15], [12, 8], [17, 7]].forEach(([cx, cy], i) => {
    px(cx, cy, 3, 3, caps[i % caps.length]);
    px(cx, cy + 1.5, 3, 1.5, '#fff6ea');
  });
  px(10, 4, 3, 1, '#ffffff');
  px(8, 5, 2, 2, '#ffffff');
  // Stand, slot, handle.
  px(6, 20, 20, 3, '#c9473d');
  px(5, 23, 22, 14, '#e2564a');
  px(5, 35, 22, 2, '#a83a31');
  px(11, 26, 10, 7, '#7a2a24');
  px(13, 28, 6, 3, '#3a1512');
  px(22, 25, 3, 3, '#f0b54d');
  px(21, 26, 5, 1, '#d79a32');
  px(8, 37, 4, 2, '#5a2420');
  px(20, 37, 4, 2, '#5a2420');
}

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
  const groups = [['skin', '角色'], ['accessory', '配件'], ['furniture', '家具'], ['plant', '植物'], ['block', '建材'], ['land', '土地'], ['floor', '地板'], ['wall', '牆面']];
  for (const [type, label] of groups) {
    const h = document.createElement('h3');
    const items = ITEMS.filter((i) => i.type === type);
    h.textContent = `${label}（${items.filter((i) => owns(i.id)).length}/${items.length}）`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const i of items) grid.append(itemCard(i.id, { locked: !owns(i.id) }));
    const group = document.createElement('div');
    group.className = 'group';
    group.append(h, grid);
    book.append(group);
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
    ctx.fillStyle = (x / 32) % 2 ? '#8a5a38' : '#94613c';
    ctx.fillRect(x, floorY, 32, 32);
    ctx.fillStyle = '#6e4428';
    ctx.fillRect(x, floorY + 15, 32, 2);
  }
  ctx.restore();
  const crew = [];
  const user = actors.find((a) => a.kind === 'user');
  crew.push(user || { id: 'user', hue: 35, skin: settings.characters.user.skin, accessory: settings.characters.user.accessory });
  for (const a of actors.filter((x) => x.kind !== 'user').slice(0, 3)) crew.push(a);
  if (crew.length < 3) crew.push({ id: 'ai', hue: 200, skin: settings.characters.ai.skin, accessory: settings.characters.ai.accessory });
  const poses = ['done', 'command', 'read', 'type'];
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
  ctx.fillText(`${fmt(w.from)} – ${fmt(w.to)}・團隊 Lv.${progress.level}・連續上工 ${progress.stats.streak} 天`, 52, 134);

  const stats = [
    ['做完的事', w.turns],
    ['動手次數', w.tools],
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
document.querySelectorAll('.studio-modes .mode').forEach((b) => b.addEventListener('click', () => { studio.mode = b.dataset.mode; renderStudio(); }));

function render() {
  if (!settings || !progress) return;
  $('coins').textContent = `${progress.coins} 🪙`;
  $('level').textContent = `Lv.${progress.level}（${progress.xp - progress.levelFloor}/${progress.levelCeil - progress.levelFloor} XP）`;
  if (tab === 'equip') renderEquip();
  if (tab === 'studio') renderStudio();
  if (tab === 'friends') renderFriends();
  if (tab === 'book') renderBook();
  if (tab === 'achievements') renderAchievements();
  if (tab === 'stats') renderShare();
}

desk.on('settings', (s) => { settings = s; Sprites.useCustoms(s.characters?.customs); Sprites.useDrawings(s.characters?.drawings); render(); });
desk.on('progress', (p) => { progress = p; render(); });
desk.on('actors', (list) => {
  const before = projectNames && settings ? projectNames().join() : '';
  actors = list;
  if (tab === 'equip' && settings && projectNames().join() !== before) renderEquip();
});
desk.on('assets', (a) => { assets = a; Common.loadSheets(a); render(); });
function openTab(t) {
  if (!t) return;
  if (t.startsWith('equip:')) {
    target = t.slice(6);
    showTab('equip');
  } else {
    showTab(t);
  }
}
desk.on('guild:tab', openTab);
// The drawer asks for a tab by message once this page is loaded.
window.addEventListener('message', (e) => {
  openTab(e.data?.guildTab);
  // A picture dropped on the room that isn't a character card: make a character of it.
  if (e.data?.photo) Pixels.imageOf(e.data.photo).then((img) => img && takePhoto(img));
});

// After every script on the page has run (draw.js comes after this file).
window.addEventListener('DOMContentLoaded', () => desk.invoke('init').then((init) => {
  settings = init.settings;
  Sprites.useCustoms(init.settings.characters?.customs); Sprites.useDrawings(init.settings.characters?.drawings);
  progress = init.progress;
  actors = init.actors;
  assets = init.assets;
  Common.loadSheets(assets);
  renderRates();
  drawMachine();
  animateEquip();
  animateStudio();
  initDraw();
  render();
  openTab(new URLSearchParams(location.search).get('tab'));
}));
