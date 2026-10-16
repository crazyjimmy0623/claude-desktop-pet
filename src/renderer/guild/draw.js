/* global desk, Sprites, Pixels, Common, $, DPR, even, canvasOf, settings, studio, showTab, renderStudio, recipeCanvas, tab */
// The drawing room, photos into characters, and friends' character cards. Loaded after guild.js.

const { W: AW, H: AH } = Sprites.ART;
const POSE_TABS = [['base', '正面'], ['walk', '走路'], ['work', '工作'], ['sleep', '睡覺'], ['happy', '開心']];
const PAINT_COLORS = [
  '#f6cfa6', '#e8b48a', '#c98e64', '#8d5a3c', '#ffffff', '#f4f4f6', '#c9ced8', '#8a91a3',
  '#4a4f5e', '#2a2b33', '#e2564a', '#b8323a', '#ff8fb1', '#f5a3a3', '#f0a35e', '#f0b54d',
  '#ffe066', '#a8d86a', '#7cc47f', '#4a8a4a', '#9ed8f0', '#5aa7ff', '#2c3a5a', '#8a6ad8',
  '#c27bff', '#b07a4a', '#6b4423', '#3a2a20',
];
let CELL = 5;

const paint = {
  id: null, poses: { base: Pixels.blank() }, cur: 'base', tool: 'pen', color: '#3a2a20', big: false, mirror: true,
  undo: [], saved: false, down: false, last: null, dirty: true,
};
let guideArt = null;

// ---- Drawing board -----------------------------------------------------------------------

// Cells as big as the drawer allows, so the whole picture fits without scrolling.
function boardSize() {
  const c = $('paint-canvas');
  const room = c.parentElement.clientHeight - 6;
  if (room > 0) CELL = Math.max(3, Math.min(6, Math.floor(room / AH)));
  c.width = AW * CELL * DPR;
  c.height = AH * CELL * DPR;
  c.style.width = `${AW * CELL}px`;
  c.style.height = `${AH * CELL}px`;
}

function drawBoard() {
  const c = $('paint-canvas');
  if (c.width !== AW * CELL * DPR || c.parentElement.clientHeight - 6 < AH * CELL || Math.floor((c.parentElement.clientHeight - 6) / AH) > CELL && CELL < 6) boardSize();
  const x = c.getContext('2d');
  const s = CELL * DPR;
  x.setTransform(1, 0, 0, 1, 0, 0);
  for (let y = 0; y < AH; y++) for (let i = 0; i < AW; i++) {
    x.fillStyle = (i + y) % 2 ? '#3a322c' : '#342d28';
    x.fillRect(i * s, y * s, s, s);
  }
  // A faint person to draw over (or the front picture, when drawing another pose).
  const ghost = paint.cur === 'base' ? (guideArt ||= Pixels.skinToArt('office')) : paint.poses.base;
  x.globalAlpha = paint.cur === 'base' ? 0.16 : 0.28;
  ghost.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect((i % AW) * s, Math.floor(i / AW) * s, s, s); } });
  x.globalAlpha = 1;
  const px = paint.poses[paint.cur];
  px.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect((i % AW) * s, Math.floor(i / AW) * s, s, s); } });
  // Mirror line and the floor.
  if (paint.mirror) {
    x.fillStyle = 'rgba(240,181,77,0.35)';
    x.fillRect((AW / 2) * s - DPR / 2, 0, DPR, AH * s);
  }
  x.fillStyle = 'rgba(240,181,77,0.6)';
  x.fillRect(0, AH * s - DPR, AW * s, DPR);
}

function cellAt(e) {
  const r = $('paint-canvas').getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / CELL), Math.floor((e.clientY - r.top) / CELL)];
}

function setPx(px, x, y, col) {
  const pts = paint.big ? [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] : [[x, y]];
  for (const [a, b] of pts) {
    for (const xx of paint.mirror ? [a, AW - 1 - a] : [a]) {
      if (xx >= 0 && xx < AW && b >= 0 && b < AH) px[b * AW + xx] = col;
    }
  }
}

function fill(px, x, y, col) {
  const from = px[y * AW + x];
  if (from === col) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (a < 0 || b < 0 || a >= AW || b >= AH || px[b * AW + a] !== from) continue;
    px[b * AW + a] = col;
    stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
}

function stroke(e, first) {
  const [x, y] = cellAt(e);
  const px = paint.poses[paint.cur];
  const erase = paint.tool === 'erase' || e.buttons === 2;
  if (paint.tool === 'pick' && !erase) {
    const col = px[y * AW + x] || paint.poses.base[y * AW + x];
    if (col) { paint.color = col; paint.tool = 'pen'; renderPaint(); }
    return;
  }
  if (paint.tool === 'fill' && !erase) {
    if (first) { fill(px, x, y, paint.color); if (paint.mirror) fill(px, AW - 1 - x, y, paint.color); }
  } else {
    // Join the dots so fast strokes have no gaps.
    const [x0, y0] = paint.last && !first ? paint.last : [x, y];
    const n = Math.max(Math.abs(x - x0), Math.abs(y - y0), 1);
    for (let i = 0; i <= n; i++) setPx(px, Math.round(x0 + ((x - x0) * i) / n), Math.round(y0 + ((y - y0) * i) / n), erase ? null : paint.color);
  }
  paint.last = [x, y];
  changed();
}

function changed() {
  paint.saved = false;
  paint.dirty = true;
  drawBoard();
}

function remember() {
  paint.undo.push({ pose: paint.cur, px: paint.poses[paint.cur].slice() });
  if (paint.undo.length > 60) paint.undo.shift();
}

function wireBoard() {
  const c = $('paint-canvas');
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    remember();
    paint.down = true;
    stroke(e, true);
  });
  c.addEventListener('pointermove', (e) => { if (paint.down) stroke(e, false); });
  const up = () => { if (paint.down) { paint.down = false; paint.last = null; renderPaintSide(); } };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  document.addEventListener('keydown', (e) => {
    if (tab !== 'studio' || studio.mode !== 'draw' || e.target.tagName === 'INPUT') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); }
  });
}

function undo() {
  const u = paint.undo.pop();
  if (!u) return;
  if (!paint.poses[u.pose]) paint.poses[u.pose] = Pixels.blank();
  paint.poses[u.pose] = u.px;
  paint.cur = u.pose;
  changed();
  renderPaint();
}

// ---- Tools, colours, poses ------------------------------------------------------------------

// `icon` is a pixel icon's name (icons.js), or nothing for a word-only button.
function iconButton(icon, label, active, onClick, cls = '') {
  const b = document.createElement('button');
  b.className = `tool ${cls}`;
  b.innerHTML = `${icon ? `<span class="ico">${Icons.svg(icon, 2)}</span>` : ''}<span>${label}</span>`;
  b.classList.toggle('active', !!active);
  b.addEventListener('click', onClick);
  return b;
}

function renderPaint() {
  drawBoard();
  const tools = $('paint-tools');
  tools.replaceChildren(
    ...[['pen', 'edit', '筆'], ['erase', '', '擦掉'], ['fill', '', '倒色'], ['pick', '', '吸色']]
      .map(([id, icon, label]) => iconButton(icon, label, paint.tool === id, () => { paint.tool = id; renderPaint(); })),
  );
  $('paint-toggles').replaceChildren(
    iconButton('', paint.big ? '粗筆' : '細筆', paint.big, () => { paint.big = !paint.big; renderPaint(); }, 'small'),
    iconButton('', '對稱', paint.mirror, () => { paint.mirror = !paint.mirror; renderPaint(); }, 'small'),
    iconButton('', '復原', false, undo, 'small'),
    iconButton('', '清空', false, () => { remember(); paint.poses[paint.cur] = Pixels.blank(); changed(); renderPaintSide(); }, 'small'),
  );
  // Colours: the box of paints, the ones already in the picture, and any colour at all.
  const pal = $('paint-palette');
  pal.replaceChildren();
  const used = [];
  for (const k of Object.keys(paint.poses)) for (const c of paint.poses[k]) if (c && !used.includes(c) && !PAINT_COLORS.includes(c)) used.push(c);
  for (const col of [...PAINT_COLORS, ...used.slice(0, 13)]) {
    const s = document.createElement('button');
    s.className = 'swatch sq';
    s.style.background = col;
    s.classList.toggle('active', paint.color === col);
    s.addEventListener('click', () => { paint.color = col; if (paint.tool !== 'fill') paint.tool = 'pen'; renderPaint(); });
    pal.append(s);
  }
  const any = document.createElement('label');
  any.className = 'swatch sq any';
  any.title = '任何顏色';
  any.innerHTML = '+<input type="color">';
  any.querySelector('input').value = paint.color;
  any.querySelector('input').addEventListener('input', (e) => { paint.color = e.target.value; if (paint.tool !== 'fill') paint.tool = 'pen'; });
  any.querySelector('input').addEventListener('change', () => renderPaint());
  pal.append(any);
  renderPaintSide();
}

// Start again from a blank page, a plain person, or the dress-up character.
function startFrom(kind) {
  if (!window.confirm('重新開始會蓋掉現在的圖，確定嗎？')) return;
  remember();
  let px = Pixels.blank();
  if (kind === 'person') px = Pixels.skinToArt('office');
  if (kind === 'dress') {
    Sprites.SKINS['mix:__start'] = Sprites.skinFor(studio.recipe || {});
    px = Pixels.skinToArt('mix:__start');
  }
  paint.poses = { base: px };
  paint.cur = 'base';
  changed();
  renderPaint();
}

function renderPaintSide() {
  Sprites.setDrawing('paint', paint.poses);
  const box = $('paint-poses');
  box.replaceChildren();
  for (const [id, label] of POSE_TABS) {
    const b = document.createElement('button');
    b.className = 'pose';
    const drawn = !!paint.poses[id];
    b.append(artCanvas(drawn ? paint.poses[id] : autoFrame(id), 2, false));
    const t = document.createElement('span');
    t.textContent = label;
    b.append(t);
    if (id !== 'base' && !drawn) {
      const tag = document.createElement('i');
      tag.className = 'tag';
      tag.textContent = '自動';
      b.append(tag);
    }
    b.classList.toggle('active', paint.cur === id);
    b.title = id === 'base' ? '一定要畫的正面' : drawn ? `正在用你畫的${label}姿勢` : '沒畫也會自己動。點一下可以自己畫，會先複製正面給你改';
    b.addEventListener('click', () => {
      if (!paint.poses[id]) { remember(); paint.poses[id] = paint.poses.base.slice(); paint.saved = false; }
      paint.cur = id;
      renderPaint();
    });
    if (drawn && id !== 'base') {
      const x = document.createElement('span');
      x.className = 'auto';
      x.textContent = '↺';
      x.title = '不要了，改回自動';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        delete paint.poses[id];
        if (paint.cur === id) paint.cur = 'base';
        paint.saved = false;
        renderPaint();
      });
      b.append(x);
    }
    box.append(b);
  }
  $('paint-save').textContent = paint.id && paint.saved ? '已存好' : '完成';
  $('paint-delete').classList.toggle('hidden', !paint.id);
}

// What the game would do with a pose nobody drew: its first frame.
function autoFrame(id) {
  const pose = { walk: 'walk', work: 'type', sleep: 'sleep', happy: 'done', base: 'rest' }[id];
  const c = document.createElement('canvas');
  c.width = Sprites.W * Sprites.RES;
  c.height = Sprites.H * Sprites.RES;
  Sprites.drawCharacterAt(c.getContext('2d'), Sprites.RES, 0, 0, 'draw:__paint', pose, pose === 'walk' ? 1 : 0, Sprites.colorsFor(210), 1, { prop: false });
  const d = c.getContext('2d').getImageData(13, 10, AW, AH).data;
  const px = Pixels.blank();
  for (let i = 0; i < px.length; i++) if (d[i * 4 + 3] > 128) px[i] = Pixels.hex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  return px;
}

function artCanvas(px, scale, faded) {
  return canvasOf(AW * scale, AH * scale, (x) => {
    const s = scale * DPR;
    x.globalAlpha = faded ? 0.5 : 1;
    px.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect((i % AW) * s, Math.floor(i / AW) * s, s, s); } });
  });
}

function loadPaint(entry) {
  paint.id = entry?.id || null;
  paint.poses = { base: Pixels.blank() };
  if (entry?.art) for (const [k, a] of Object.entries(entry.art)) paint.poses[k] = Sprites.decodeArt(a);
  paint.cur = 'base';
  paint.undo = [];
  paint.saved = !!entry;
  $('paint-name').value = entry?.name || '';
}

async function savePaint() {
  if (!paint.poses.base.some(Boolean)) { $('paint-save').textContent = '先畫點東西吧'; return null; }
  const art = {};
  for (const [k, px] of Object.entries(paint.poses)) if (px.some(Boolean)) art[k] = Sprites.encodeArt(px);
  const res = await desk.invoke('drawing:save', { id: paint.id, name: $('paint-name').value, art });
  if (res?.error) { $('paint-save').textContent = res.error; return null; }
  paint.id = res.id;
  paint.saved = true;
  renderPaintSide();
  return res.id;
}

function animatePaint() {
  const c = $('paint-preview');
  const unit = even(4.5);
  c.width = Sprites.W * unit;
  c.height = Sprites.H * unit;
  c.style.width = `${c.width / DPR}px`;
  c.style.height = `${c.height / DPR}px`;
  const ctx = c.getContext('2d');
  const poses = ['rest', 'walk', 'type', 'sleep', 'done', 'dance'];
  const tick = () => {
    if (settings && tab === 'studio' && studio.mode === 'draw') {
      if (paint.dirty) { Sprites.setDrawing('paint', paint.poses); paint.dirty = false; }
      const now = Date.now();
      const pose = poses[Math.floor(now / 2200) % poses.length];
      const { frame } = Common.poseFor({ state: pose === 'rest' ? 'idle' : 'work' }, { moving: pose === 'walk', now });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      Common.drawActorAt(ctx, unit, 0, 0, { id: 'paint', hue: 210, skin: 'draw:__paint' }, pose, pose === 'walk' || pose === 'rest' ? frame : Math.floor(now / 300) % 2, 1, { prop: true }, now);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

$('paint-save').addEventListener('click', savePaint);
$('paint-wear').addEventListener('click', async () => {
  const id = paint.saved ? paint.id : await savePaint();
  if (!id) return;
  desk.invoke('equip', { target: 'user', skin: `draw:${id}` });
  $('paint-wear').textContent = '穿上了！';
  setTimeout(() => { $('paint-wear').textContent = '我要穿'; }, 1800);
});
$('paint-send').addEventListener('click', async () => {
  const id = paint.saved ? paint.id : await savePaint();
  if (id) openFriends(`draw:${id}`);
});
$('paint-delete').addEventListener('click', () => {
  if (!paint.id || !window.confirm('確定刪掉這個角色嗎？')) return;
  desk.invoke('drawing:remove', paint.id);
  loadPaint(null);
  renderPaint();
});
document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => startFrom(b.dataset.start)));

// ---- Photo into a character -----------------------------------------------------------------

const photo = { img: null, cut: 2, size: 2, px: null };

function renderPhoto() {
  const has = !!photo.img;
  $('photo-result').classList.toggle('hidden', !has);
  $('photo-hint').classList.toggle('hidden', has);
  if (!has) return;
  photo.px = Pixels.photoToArt(photo.img, photo);
  const c = $('photo-canvas');
  c.replaceChildren(artCanvas(photo.px, 4, false));
  const chips = (box, key, labels) => {
    $(box).replaceChildren(...labels.map((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.classList.toggle('active', photo[key] === i);
      b.addEventListener('click', () => { photo[key] = i; renderPhoto(); });
      return b;
    }));
  };
  chips('photo-cut', 'cut', ['不去背', '輕輕去', '一般', '用力去']);
  chips('photo-size', 'size', ['小', '中', '大']);
  const thumb = $('photo-original');
  thumb.src = photo.img.src;
}

function takePhoto(img) {
  photo.img = img;
  studio.mode = 'photo';
  showTab('studio');
}

$('photo-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) incoming(new Uint8Array(await file.arrayBuffer()), { photo: true });
});
$('photo-edit').addEventListener('click', () => {
  loadPaint(null);
  paint.poses.base = photo.px.slice();
  paint.saved = false;
  studio.mode = 'draw';
  renderStudio();
});
$('photo-done').addEventListener('click', async () => {
  loadPaint(null);
  paint.poses.base = photo.px.slice();
  studio.mode = 'draw';
  await savePaint();
  renderStudio();
});

// ---- Friends' cards -------------------------------------------------------------------------

let sendSkin = null;
let lastCard = null;

const myLooks = () => [
  ...(settings.characters.customs || []).map((m) => ({ skin: `mix:${m.id}`, name: m.name, entry: { name: m.name, recipe: m.recipe, skin: `mix:${m.id}` } })),
  ...(settings.characters.drawings || []).filter((d) => !d.friend).map((d) => ({ skin: `draw:${d.id}`, name: d.name, entry: d })),
];
const friends = () => (settings.characters.drawings || []).filter((d) => d.friend);

function lookTile(skin, name) {
  const b = document.createElement('button');
  b.className = 'mine';
  b.append(canvasOf((Sprites.W * 3) / DPR, (Sprites.H * 3) / DPR, (x) => Sprites.drawCharacterAt(x, 3, 0, 0, skin, 'rest', 0, Sprites.colorsFor(210), 1, { prop: false })));
  const t = document.createElement('span');
  t.textContent = name;
  b.append(t);
  return b;
}

function renderFriends() {
  const looks = myLooks();
  if (!looks.some((l) => l.skin === sendSkin)) sendSkin = looks[0]?.skin || null;
  const list = $('send-list');
  list.replaceChildren();
  if (!looks.length) {
    const p = document.createElement('p');
    p.className = 'desc';
    p.textContent = '先去「創角」做一個角色，才有東西可以送。';
    list.append(p);
  }
  for (const l of looks) {
    const b = lookTile(l.skin, l.name);
    b.classList.toggle('active', l.skin === sendSkin);
    b.addEventListener('click', () => { sendSkin = l.skin; renderFriends(); });
    list.append(b);
  }
  const chosen = looks.find((l) => l.skin === sendSkin);
  $('card-actions').classList.toggle('hidden', !chosen);
  const holder = $('card-preview');
  holder.replaceChildren();
  if (chosen) {
    lastCard = Pixels.cardFor(chosen.entry);
    lastCard.name = chosen.name;
    const c = lastCard.canvas;
    c.style.height = '100%';
    c.style.width = 'auto';
    holder.append(c);
  }
  // Friends who came over on a card.
  const book = $('friend-list');
  book.replaceChildren();
  const fr = friends();
  $('friend-count').textContent = `${fr.length}`;
  if (!fr.length) {
    const p = document.createElement('p');
    p.className = 'desc';
    p.textContent = '還沒有朋友的角色。叫朋友傳張角色卡來，拖進來就有了。';
    book.append(p);
  }
  const living = new Set((settings.characters.residents || []).map((r) => r.skin));
  for (const f of fr) {
    const skin = `draw:${f.id}`;
    const tile = lookTile(skin, f.name);
    tile.classList.add('friend');
    const row = document.createElement('div');
    row.className = 'mini-actions';
    const act = (icon, title, fn) => {
      const a = document.createElement('span');
      a.innerHTML = Icons.svg(icon, 2);
      a.title = title;
      a.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      row.append(a);
    };
    if (!living.has(skin)) act('house', '請他住進房間', async () => {
      const res = await desk.invoke('resident:add', { name: f.name, skin });
      flash(res?.error || `${f.name} 搬進來了！`);
    });
    act('person', '我要穿', () => { desk.invoke('equip', { target: 'user', skin }); flash(`穿上了 ${f.name}`); });
    act('close', '從圖鑑拿掉', () => { if (window.confirm(`確定把「${f.name}」從朋友圖鑑拿掉嗎？`)) desk.invoke('drawing:remove', f.id); });
    tile.append(row);
    book.append(tile);
  }
}

function flash(text) {
  const el = $('friend-status');
  el.textContent = text;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { el.textContent = ''; }, 3500);
}

function openFriends(skin) {
  sendSkin = skin;
  showTab('friends');
}

$('card-copy').addEventListener('click', async () => {
  if (!lastCard) return;
  // Pasted pictures lose their insides, so the copy is the plain picture; the game reads the pixels.
  await desk.invoke('share:copy', lastCard.canvas.toDataURL('image/png'));
  flash('複製好了，去 LINE 或 Discord 貼給朋友');
});
$('card-file').addEventListener('click', async () => {
  if (!lastCard) return;
  const file = await desk.invoke('card:save', { dataUrl: lastCard.dataUrl, name: lastCard.name });
  flash(`存好了：${file.split(/[\\/]/).pop()}`);
});
$('card-pick').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) incoming(new Uint8Array(await file.arrayBuffer()));
});

// A picture arrived (dropped, pasted or picked). A character card makes a new friend; any other
// picture goes to the photo corner to become a character.
async function incoming(bytes, { photo: wantPhoto = false } = {}) {
  const roomCard = await Pixels.readRoomCard(bytes);
  if (roomCard) {
    // Only the room window can show another room.
    if (!inRoom()) { flash('房間卡要在房間模式拖到房子上才能參觀'); return; }
    window.parent.postMessage({ visitRoom: roomCard }, '*');
    flash(`去參觀「${roomCard.name}」的房間`);
    return;
  }
  const card = await Pixels.readCard(bytes);
  if (card) {
    const res = await desk.invoke('drawing:save', { name: card.name, art: card.art, recipe: card.recipe, friend: true });
    showTab('friends');
    flash(res?.error || `${card.name || '新朋友'} 來了！`);
    return;
  }
  const img = await Pixels.imageOf(bytes);
  if (!img) { flash('這個檔案打不開，換一張圖試試'); return; }
  takePhoto(img);
  if (!wantPhoto) setTimeout(() => { $('photo-note').textContent = '這不是角色卡，那就幫你變成像素角色看看'; }, 0);
}

function wireDrops() {
  document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dropping'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('dropping');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) incoming(new Uint8Array(await file.arrayBuffer()), { photo: tab === 'studio' });
  });
  document.addEventListener('paste', async (e) => {
    if (e.target.tagName === 'INPUT') return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) incoming(new Uint8Array(await file.arrayBuffer()), { photo: tab === 'studio' });
  });
}

// ---- Sharing your room -----------------------------------------------------------------------

const inRoom = () => { try { return window.parent !== window && !!window.parent.RoomApp; } catch { return false; } };

let roomShare = null;
$('room-card-make').addEventListener('click', () => {
  if (!inRoom()) { flash('切到房間模式就能把房間做成卡片'); return; }
  $('room-card-make').textContent = '拍照中…';
  window.parent.postMessage({ makeRoomCard: true }, '*');
});
window.addEventListener('message', (e) => {
  const card = e.data?.roomCard;
  if (!card) return;
  $('room-card-make').textContent = '做成房間卡';
  if (card.error) { flash(card.error); return; }
  roomShare = card;
  const img = document.createElement('img');
  img.src = card.dataUrl;
  img.title = '再按一次可以重拍';
  img.addEventListener('click', () => $('room-card-make').click());
  $('room-card').replaceChildren(img, $('room-card-make'));
  $('room-card-make').classList.add('hidden');
  $('room-card-actions').classList.remove('hidden');
});
$('room-card-copy').addEventListener('click', async () => {
  if (!roomShare) return;
  await desk.invoke('share:copy', roomShare.dataUrl);
  flash('房間卡複製好了，貼給朋友吧');
});
$('room-card-file').addEventListener('click', async () => {
  if (!roomShare) return;
  const file = await desk.invoke('card:save', { dataUrl: roomShare.dataUrl, name: `${roomShare.name}的房間` });
  flash(`存好了：${file.split(/[\\/]/).pop()}`);
});

function initDraw() {
  boardSize();
  wireBoard();
  wireDrops();
  animatePaint();
}
