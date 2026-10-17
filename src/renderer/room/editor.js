/* global desk, Iso, Catalog, RoomApp */
// Room editor: build on your plot - furniture, plants, blocks and stairs, floors and walls - and
// take things away again. Building costs coins; taking something away gives half back.
(function () {
  const { state } = RoomApp;
  let DPR = window.devicePixelRatio || 1;
  const TU = Iso.TU;
  const canvas = document.getElementById('room');
  const editorEl = document.getElementById('editor');
  const palette = document.getElementById('palette');
  const hint = document.getElementById('editor-hint');
  const btnEdit = document.getElementById('btn-edit');
  const tabButtons = [...document.querySelectorAll('.tabs button[data-tab]')];
  const modeButtons = [...document.querySelectorAll('.modes button[data-mode]')];
  const buildTabs = document.getElementById('build-tabs');
  const coinsEl = document.getElementById('editor-coins');

  // Two modes: building (furniture, blocks, floors, walls, scenery, blueprints by category) and
  // deleting, where whatever is under the mouse turns see-through red and a click takes it away.
  let mode = 'build';
  let doomed = null; // erase mode: { object: i } | { stair: cell } | { block: hit } under the mouse
  let tab = 'furniture';
  let tool = null; // { type, flip, moving?, orig? }
  let hover = null; // { x, y, f, flip } — a floor tile, or a wall spot for wall items
  let storey = 0; // which floor the floor/wall tabs paint
  // Terrain: the layer being built on, the tool, and the first end of a stair being laid.
  // Building: the block in hand (or the stairs tool) and the face under the mouse.
  const build = { block: 'brick', tool: 'block', hover: null };

  const HINTS = {
    furniture: '點家具放進房間，按 R 或右下的按鈕轉方向。點房間裡的家具可以搬，右鍵刪掉',
    terrain: '半透明的就是會放下去的位置。點頂面往上疊，點側面往旁邊接，點空地鋪地',
    stairs: '樓梯放在高台旁邊的地板上，會自己往高的那邊接上去，落差越大階數越多',
    spiral: '旋轉樓梯放在高處旁邊的地板上，一格就能繞上去，最多五層',
    erase: '指到的東西會變紅，點一下就拆掉。疊高的方塊一次拆一層',
    floor: '選樓層，再點一下換那層的地板',
    wall: '選樓層，再點一下換那層的牆面',
    room: '換地、蓋藍圖，或調時間和天氣',
    plants: '點植物種在草地上，沿外圍種一圈就是背景。點已經種好的可以搬',
  };

  const itemName = (id) => Catalog.ITEMS.find((i) => i.id === id)?.name || id;
  const owned = (type) => (state.progress?.owned || []).filter((id) => id.startsWith(`${type}:`)).map((id) => id.split(':')[1]);
  const owns = (id) => (state.progress?.owned || []).includes(id);
  const price = (id) => Catalog.priceOf(id);
  const coins = () => state.progress?.coins ?? 0;
  const worth = (r) => Iso.roomCost(r, price);
  const room = () => state.room;
  const save = () => RoomApp.setRoom(room(), { save: true, relayout: false });
  const still = { frame: 0, active: false, now: Date.now(), hour: 14, meeting: false };

  // ---- Coins ------------------------------------------------------------------------

  // Every change that builds or takes away goes through here. `change(room)` edits the room and
  // returns an error message or nothing. What was added costs its price; what was taken away gives
  // half back (`bill` can say otherwise); `free` for moving furniture about. Without the coins the
  // room goes back as it was.
  function charged(change, { free = false, relayout = true, ok = '', bill = null } = {}) {
    const r = room();
    const before = worth(r);
    // Cached layout and cells are not enumerable, so they stay out of the copy.
    const snapshot = JSON.stringify(r);
    // A change that fails can still have done something first (a new empty layer), so it is undone too.
    const undo = (why) => {
      for (const k of Object.keys(r)) delete r[k];
      Object.assign(r, JSON.parse(snapshot));
      RoomApp.setRoom(r, { relayout });
      hint.textContent = why;
      return false;
    };
    const err = change(r);
    if (err) return undo(err);
    const after = worth(r);
    const amount = free ? 0 : bill ? bill(before, after) : after > before ? after - before : -Math.floor((before - after) / 2);
    if (amount > coins()) return undo(`金幣不夠：要 ${amount} 🪙，手上只有 ${coins()} 🪙`);
    if (amount) {
      state.progress.coins -= amount;
      desk.invoke('coins:spend', amount);
    }
    RoomApp.setRoom(r, { save: true, relayout });
    refresh();
    const note = amount > 0 ? `（花了 ${amount} 🪙）` : amount < 0 ? `（退回 ${-amount} 🪙）` : '';
    if (ok || note) hint.textContent = `${ok}${note}`;
    return true;
  }
  const locked = (id) => `還沒解鎖「${itemName(id)}」，到招募機抽抽看`;

  // ---- Palette ----------------------------------------------------------------------

  function swatch(c, scale) {
    const out = document.createElement('canvas');
    out.width = c.width * scale;
    out.height = c.height * scale;
    out.style.width = `${(c.width * scale) / DPR}px`;
    out.style.height = `${(c.height * scale) / DPR}px`;
    const x = out.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, out.width, out.height);
    return out;
  }

  // A tile (a picture, a name, a price in the corner) when there is something to show, otherwise
  // a small chip. `preview` may be a canvas or an emoji.
  // A row of the palette with its name at the front.
  function labelledRow(text) {
    const el = document.createElement('div');
    el.className = 'row';
    const b = document.createElement('b');
    b.textContent = text;
    el.append(b);
    palette.append(el);
    return el;
  }

  function button(label, preview, selected, onClick, { price: cost = null, wide = false, tile = false } = {}) {
    const b = document.createElement('button');
    b.className = preview || tile ? 'tile' : 'chip';
    if (wide) b.classList.add('wide');
    if (typeof preview === 'string') {
      const em = document.createElement('span');
      em.className = 'emoji';
      em.textContent = preview;
      b.append(em);
    } else if (preview) b.append(preview);
    const span = document.createElement('span');
    span.className = 'name';
    span.textContent = label;
    b.append(span);
    if (cost !== null) {
      const p = document.createElement('span');
      p.className = 'price';
      p.textContent = `${cost} 🪙`;
      b.append(p);
    }
    if (selected) b.classList.add('selected');
    b.addEventListener('click', onClick);
    return b;
  }

  // A sprite cropped to its drawn pixels and fitted into a tile's picture box.
  function thumb(src, W = 64, H = 50) {
    const px = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    let [x0, y0, x1, y1] = [src.width, src.height, 0, 0];
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        if (px[(y * src.width + x) * 4 + 3] < 8) continue;
        if (x < x0) x0 = x;
        if (x >= x1) x1 = x + 1;
        if (y < y0) y0 = y;
        if (y >= y1) y1 = y + 1;
      }
    }
    if (x1 <= x0) return swatch(src, 1);
    const w = x1 - x0;
    const h = y1 - y0;
    const k = Math.max(1, Math.floor(Math.min((W * DPR) / w, (H * DPR) / h)));
    const out = document.createElement('canvas');
    out.width = w * k;
    out.height = h * k;
    out.style.width = `${(w * k) / DPR}px`;
    out.style.height = `${(h * k) / DPR}px`;
    const x = out.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, x0, y0, w, h, 0, 0, w * k, h * k);
    return out;
  }

  // A small diamond of floor or a slice of wall, for the swatches.
  function tileSwatch(draw) {
    const c = document.createElement('canvas');
    c.width = 34;
    c.height = 26;
    draw(c.getContext('2d'));
    return swatch(c, 2);
  }

  function refresh() {
    if (!state.editing) return;
    if (coinsEl) coinsEl.textContent = `🪙 ${coins()}`;
    modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    buildTabs.classList.toggle('hidden', mode === 'erase');
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    palette.replaceChildren();
    if (mode === 'erase') {
      hint.textContent = HINTS.erase;
      const note = document.createElement('div');
      note.className = 'erase-note';
      note.textContent = '🗑 滑鼠移到想拆的東西上，變紅就點下去。要繼續蓋，按上面的「🔨 建造」。';
      palette.append(note);
      return;
    }
    hint.textContent = tab === 'terrain' && build.tool !== 'block' ? HINTS[build.tool] : HINTS[tab];
    if (tab === 'furniture' || tab === 'plants') {
      for (const type of owned('obj')) {
        if (!Iso.OBJECTS[type] || !!Iso.OBJECTS[type].plant !== (tab === 'plants')) continue;
        const sp = Iso.objectSprite(type, false, still);
        palette.append(button(itemName(`obj:${type}`), thumb(sp.canvas), tool?.type === type && !tool.moving, () => {
          cancelMove();
          tool = { type, flip: false };
          refresh();
        }, { price: price(`obj:${type}`) }));
      }
      if (tool) palette.append(button('換方向（R）', '↻', false, () => { tool.flip = !tool.flip; }));
    } else if (tab === 'terrain') {
      refreshTerrain();
    } else if (tab === 'floor' || tab === 'wall') {
      const key = tab;
      const row = document.createElement('div');
      row.className = 'row';
      if (!room().zones[storey]) storey = 0;
      room().zones.forEach((zn, i) => {
        row.append(button(`${zn.kind === 'room' ? '🏠' : zn.kind === 'water' ? '💧' : '🌿'} ${zn.name || `${i + 1}F`}`, null, storey === i, () => { storey = i; refresh(); }));
      });
      palette.append(row);
      const set = key === 'floor' ? Iso.FLOORS : Iso.WALLS;
      for (const id of owned(key)) {
        const d = set[id];
        if (!d) continue;
        const sw = key === 'floor'
          ? tileSwatch((x) => { x.fillStyle = d.base; x.beginPath(); x.moveTo(17, 4); x.lineTo(33, 12); x.lineTo(17, 20); x.lineTo(1, 12); x.fill(); })
          : tileSwatch((x) => { x.fillStyle = d.base; x.fillRect(4, 2, 26, 22); x.fillStyle = d.trim; x.fillRect(4, 20, 26, 4); });
        palette.append(button(itemName(`${key}:${id}`), sw, room().zones[storey][key] === id, () => {
          room().zones[storey][key] = id;
          save();
          refresh();
        }));
      }
    } else if (tab === 'room') {
      refreshRoomTab();
      // Time of day and weather, the same switches as in the settings.
      const S = RoomApp.state.settings || {};
      const pickSetting = (patch) => desk.invoke('settings:set', patch).then(() => { Object.assign(RoomApp.state.settings, patch); refresh(); });
      const time = labelledRow('時間');
      for (const [id, name] of [['clock', '🕒 跟著時鐘'], ['day', '☀️ 白天'], ['dusk', '🌇 傍晚'], ['night', '🌙 夜晚']]) {
        time.append(button(name, null, (S.timeOfDay || 'clock') === id, () => pickSetting({ timeOfDay: id })));
      }
      const sky = labelledRow('天氣');
      const SKY = { auto: '🔄', clear: '☀️', rain: '🌧️', snow: '❄️', petals: '🌸', leaves: '🍂' };
      for (const [id, name] of Object.entries(Iso.WEATHERS)) {
        sky.append(button(`${SKY[id] || ''} ${name}`, null, (S.weather || 'auto') === id, () => pickSetting({ weather: id })));
      }
    }
  }

  // A plot of n x n as a small lawn diamond, bigger for bigger plots.
  function landThumb(n) {
    const c = document.createElement('canvas');
    const W = 60;
    const H = 40;
    c.width = W * DPR;
    c.height = H * DPR;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    const s = 2.1 * n;
    const cx = W / 2;
    const cy = H / 2 - 2;
    const top = [[cx, cy - s / 2], [cx + s, cy], [cx, cy + s / 2], [cx - s, cy]];
    x.fillStyle = '#5e3922';
    x.beginPath();
    x.moveTo(cx - s, cy); x.lineTo(cx, cy + s / 2); x.lineTo(cx + s, cy); x.lineTo(cx + s, cy + 4); x.lineTo(cx, cy + s / 2 + 4); x.lineTo(cx - s, cy + 4);
    x.fill();
    x.fillStyle = '#5f9a4a';
    x.beginPath();
    top.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.18)';
    x.lineWidth = 0.6;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      x.beginPath(); x.moveTo(cx - s + s * t, cy - (s / 2) * t); x.lineTo(cx + s * t, cy + s / 2 - (s / 2) * t); x.stroke();
      x.beginPath(); x.moveTo(cx + s - s * t, cy - (s / 2) * t); x.lineTo(cx - s * t, cy + s / 2 - (s / 2) * t); x.stroke();
    }
    return c;
  }

  // The plot, the blueprints and (for rooms from before plots) the old painted scenery.
  function refreshRoomTab() {
    const r = room();
    const land = Iso.landOf(r);
    const lands = labelledRow('土地');
    for (const n of Iso.LAND_SIZES) {
      const have = owns(`land:${n}`) || n === land;
      const b = button(`${n}×${n}`, landThumb(n), n === land, () => {
        if (!have) { hint.textContent = locked(`land:${n}`); return; }
        if (n !== land) charged((rr) => Iso.setLand(rr, n), { ok: `換成 ${n}×${n} 的地了` });
      });
      if (!have) b.classList.add('locked');
      lands.append(b);
    }
    // Blueprints: built for you, if every piece is unlocked and you pay for all of it (what is
    // there now is taken down and gives half back).
    const plans = labelledRow('藍圖');
    for (const [id, bp] of Object.entries(Iso.BLUEPRINTS)) {
      const e = Iso.extentOf(Iso.generateRoom(id));
      const need = Math.max(e.w, e.d);
      const fits = need <= land;
      const built = fits ? Iso.blueprintRoom(id, land) : null;
      const bill = built ? RoomApp.replaceBill(r, built) : null;
      const missing = bill?.missing || [];
      const label = fits ? bp.name : `${bp.name}（要 ${need}×${need} 的地）`;
      const b = button(label, blueprintThumb(id), r.blueprint === id, () => {
        if (!fits) { hint.textContent = `「${bp.name}」要 ${need}×${need} 以上的地才蓋得下`; return; }
        if (missing.length) { hint.textContent = `${RoomApp.missingText(missing, 6)}，抽到才能蓋`; return; }
        const now = RoomApp.replaceBill(room(), built);
        if (now.short) { hint.textContent = `金幣不夠：要 ${now.pay} 🪙，手上只有 ${coins()} 🪙`; return; }
        if (!window.confirm(`蓋「${bp.name}」要 ${now.total} 🪙。拆掉現在的房子會退你 ${now.back} 🪙，所以要付 ${now.pay} 🪙。要蓋嗎？`)) return;
        RoomApp.putUpRoom(built, now);
        refresh();
        hint.textContent = `「${bp.name}」蓋好了${now.pay > 0 ? `（花了 ${now.pay} 🪙）` : now.pay < 0 ? `（退回 ${-now.pay} 🪙）` : ''}`;
      }, { price: fits ? bill.total : null, wide: true });
      b.title = `${bp.desc}${missing.length ? `（還缺 ${missing.length} 樣沒解鎖）` : ''}`;
      if (!fits || missing.length) b.classList.add('locked');
      plans.append(b);
    }
  }

  function refreshTerrain() {
    const row = document.createElement('div');
    row.className = 'row';
    // Locked pieces show greyed out, with where to get them.
    const piece = (id, label, preview, selected, pick) => {
      const have = owns(id);
      const b = button(label, preview, selected, () => { if (have) pick(); else hint.textContent = locked(id); }, { price: price(id) });
      if (!have) b.classList.add('locked');
      row.append(b);
    };
    for (const [id, b] of Object.entries(Iso.BLOCKS)) {
      piece(`block:${id}`, b.name, thumb(Iso.blockSprite(id).canvas), build.tool === 'block' && build.block === id, () => {
        Object.assign(build, { block: id, tool: 'block' });
        refresh();
      });
    }
    piece('block:stairs', '樓梯（每階）', '🪜', build.tool === 'stairs', () => {
      build.tool = build.tool === 'stairs' ? 'block' : 'stairs';
      refresh();
    });
    piece('block:spiral', '旋轉樓梯', '🌀', build.tool === 'spiral', () => {
      build.tool = build.tool === 'spiral' ? 'block' : 'spiral';
      refresh();
    });
    palette.append(row);
  }

  // A terrain edit, paid for: the room is re-laid (its size may change) and the result reported.
  const terrain = (edit, ok) => charged(edit, { ok });

  // A small picture of a blueprint, fully built, for its button.
  const thumbs = new Map();
  function blueprintThumb(id) {
    if (!thumbs.has(id)) {
      const r = Object.assign(Iso.generateRoom(id), {});
      const S = Iso.size(r);
      const full = document.createElement('canvas');
      full.width = S.w;
      full.height = S.h;
      const fx = full.getContext('2d');
      fx.imageSmoothingEnabled = false;
      Iso.drawRoom(fx, r, 1, () => ({ frame: 1, active: true, now: Date.now(), hour: 20, meeting: false }), []);
      const out = document.createElement('canvas');
      const k = 110 / S.w;
      out.width = Math.round(S.w * k);
      out.height = Math.round(S.h * k);
      const ox = out.getContext('2d');
      ox.imageSmoothingQuality = 'high';
      ox.drawImage(full, 0, 0, out.width, out.height);
      thumbs.set(id, out);
    }
    const src = thumbs.get(id);
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.width = `${src.width / DPR}px`;
    c.style.height = `${src.height / DPR}px`;
    return c;
  }

  // ---- Canvas interaction -----------------------------------------------------------

  // Where the tool would go under the mouse.
  function target(e) {
    const p = RoomApp.finePoint(e);
    const def = tool && Iso.OBJECTS[tool.type];
    if (def?.wall) {
      const w = Iso.wallAt(room(), p.x, p.y);
      if (!w) return null;
      return { x: w.x, y: w.y, f: w.f, flip: w.flip };
    }
    const t = Iso.tileAt(room(), p.x, p.y, { water: !!def?.onWater });
    return t ? { x: t.x, y: t.y, f: t.f, flip: tool?.flip || false } : null;
  }

  function objectAt(e) {
    const p = RoomApp.finePoint(e);
    const w = Iso.wallAt(room(), p.x, p.y);
    const t = Iso.tileAt(room(), p.x, p.y, { water: true });
    let found = -1;
    room().objects.forEach((o, i) => {
      const def = Iso.OBJECTS[o.type];
      if (!def) return;
      if ((o.f || 0) !== (def.wall ? w?.f : t?.f)) return;
      if (def.wall) {
        if (w && !!o.flip === w.flip && (o.flip ? o.x === w.x : o.y === w.y)) {
          const along = o.flip ? o.y : o.x;
          const at = w.flip ? w.y : w.x;
          if (at >= along && at < along + def.w) found = i;
        }
        return;
      }
      const f = Iso.footprint(o);
      if (t && t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.d && (found < 0 || !def.flat)) found = i;
    });
    return found;
  }

  // Building: the block face under the mouse, or bare ground when there is none.
  function buildHit(e) {
    const p = RoomApp.finePoint(e);
    const hit = Iso.pickBlock(room(), p.x, p.y);
    if (hit) return hit;
    const g = Iso.pick(room(), p.x, p.y, 0);
    return { ground: true, x: g.x, y: g.y, z: 0 };
  }
  // The stairs that would go in for this face: built on a copy, then the new steps picked out.
  function stairGhost(hit, kind) {
    const r = room();
    const copy = JSON.parse(JSON.stringify(r));
    const err = kind === 'spiral' ? Iso.placeSpiral(copy, hit) : Iso.placeStairs(copy, hit);
    if (err) return { err };
    const had = new Set(Iso.cells(r).list.filter((c) => c.kind === 'stair').map((c) => `${c.x},${c.y}`));
    return { room: copy, steps: Iso.cells(copy).list.filter((c) => c.kind === 'stair' && !had.has(`${c.x},${c.y}`)) };
  }
  const targetOf = (hit) => (hit?.ground ? { x: hit.x, y: hit.y, z: 0 } : Iso.blockTarget(hit));

  function terrainDown(e) {
    const hit = buildHit(e);
    if (e.button !== 0) return;
    if (build.tool === 'stairs') terrain((rr) => Iso.placeStairs(rr, hit), '樓梯蓋好了');
    else if (build.tool === 'spiral') terrain((rr) => Iso.placeSpiral(rr, hit), '旋轉樓梯蓋好了');
    else terrain((rr) => Iso.placeBlock(rr, build.block, targetOf(hit)), '');
  }

  // Erase mode: what a click would take away, and taking it.
  function eraseHit(e) {
    const p = RoomApp.finePoint(e);
    return Iso.pickAt(room(), p.x, p.y, () => still);
  }
  let eraseMove = null;
  let eraseKey = '';
  // What deleting it would give back: tried out on a copy of the room.
  function refundOf(d) {
    const copy = JSON.parse(JSON.stringify(room()));
    if (d.object !== undefined) copy.objects.splice(d.object, 1);
    else if (d.stair) Iso.removeFlightAt(copy, d.stair.x, d.stair.y);
    else Iso.removeBlock(copy, d.block);
    return Math.floor(Math.max(0, worth(room()) - worth(copy)) / 2);
  }
  function eraseDown(e) {
    const d = eraseHit(e);
    if (!d) return;
    if (d.object !== undefined) {
      const name = itemName(`obj:${room().objects[d.object]?.type}`);
      charged((rr) => { rr.objects.splice(d.object, 1); }, { relayout: false, ok: `已刪除：${name}` });
    } else if (d.stair) {
      terrain((rr) => { Iso.removeFlightAt(rr, d.stair.x, d.stair.y); }, '已刪除樓梯');
    } else {
      terrain((rr) => Iso.removeBlock(rr, d.block), '已拆掉一格');
    }
    doomed = eraseHit(e);
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!state.editing) return;
    if (mode === 'erase') {
      // Picking reads sprite pixels, so at most once a frame.
      const pending = !eraseMove;
      eraseMove = e;
      if (pending) {
        requestAnimationFrame(() => {
          if (eraseMove && mode === 'erase') {
            doomed = eraseHit(eraseMove);
            const key = JSON.stringify(doomed && { o: doomed.object, s: doomed.stair && [doomed.stair.x, doomed.stair.y], b: doomed.block && [doomed.block.x, doomed.block.y, doomed.block.f] });
            if (key !== eraseKey) {
              eraseKey = key;
              hint.textContent = doomed ? `點一下刪掉，退回 ${refundOf(doomed)} 🪙` : HINTS.erase;
            }
          }
          canvas.style.cursor = doomed ? 'pointer' : '';
          eraseMove = null;
        });
      }
      return;
    }
    if (tab === 'terrain') {
      build.hover = buildHit(e);
      build.stairs = build.tool === 'stairs' || build.tool === 'spiral' ? stairGhost(build.hover, build.tool) : null;
      // Told when the mouse reaches another tile, not every frame, so what a click said
      // ("not enough coins", "built") stays up until you move on.
      const h = build.hover;
      const key = build.stairs ? `${h?.x},${h?.y},${h?.f},${h?.face}` : null;
      if (key && key !== build.hintKey) hint.textContent = build.stairs.steps?.length ? HINTS[build.tool] : build.stairs.err || HINTS[build.tool];
      build.hintKey = key;
      return;
    }
    hover = tool ? target(e) : { pick: objectAt(e) };
  });
  canvas.addEventListener('mouseleave', () => { hover = null; build.hover = null; doomed = null; });

  // Whatever is being carried goes back where it was. Every way of letting go of a tool comes
  // through here, or the piece in hand would simply be gone.
  function cancelMove() {
    if (tool?.moving) {
      room().objects.push({ type: tool.type, ...tool.orig });
      RoomApp.setRoom(room(), { relayout: false });
    }
    tool = null;
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!state.editing) return;
    if (mode === 'erase') { if (e.button === 0 || e.button === 2) eraseDown(e); return; }
    if (tab === 'terrain') { terrainDown(e); return; }
    const r = room();
    if (e.button === 2) {
      if (tool) {
        cancelMove();
        save();
      } else {
        const i = objectAt(e);
        if (i >= 0) charged((rr) => { rr.objects.splice(i, 1); }, { relayout: false, ok: '已刪除' });
      }
      refresh();
      return;
    }
    if (e.button !== 0) return;
    if (tool) {
      const t = target(e);
      if (t && Iso.canPlace(r, tool.type, t.x, t.y, t.flip, t.f)) {
        const moving = tool.moving;
        const placed = charged((rr) => { rr.objects.push({ type: tool.type, x: t.x, y: t.y, flip: t.flip, f: t.f }); }, { free: moving, relayout: false });
        if (placed && moving) tool = null;
        refresh();
      }
      return;
    }
    const i = objectAt(e);
    if (i >= 0) {
      const [o] = r.objects.splice(i, 1);
      tool = { type: o.type, flip: !!o.flip, moving: true, orig: { x: o.x, y: o.y, flip: !!o.flip, f: o.f || 0 } };
      tab = Iso.OBJECTS[o.type]?.plant ? 'plants' : 'furniture';
      // Not saved while it is in hand: quitting halfway leaves it where it stood.
      RoomApp.setRoom(r, { relayout: false });
      refresh();
    }
  });

  canvas.addEventListener('contextmenu', (e) => { if (state.editing) e.preventDefault(); });
  window.addEventListener('keydown', (e) => {
    if (!state.editing || !tool) return;
    if (e.key === 'r' || e.key === 'R') tool.flip = !tool.flip;
    if (e.key === 'Escape') {
      cancelMove();
      save();
      refresh();
    }
  });

  // A see-through block from z0 down to z1 at tile (x, y), in device pixels.
  function ghost(ctx, z, x, y, z0, z1, color) {
    const P = (px, py, pz) => { const q = Iso.project(room(), px * TU, py * TU, pz); return [q.x * z, q.y * z]; };
    const faces = [
      [P(x, y, z0), P(x + 1, y, z0), P(x + 1, y + 1, z0), P(x, y + 1, z0)],
      [P(x, y + 1, z0), P(x + 1, y + 1, z0), P(x + 1, y + 1, z1), P(x, y + 1, z1)],
      [P(x + 1, y, z0), P(x + 1, y + 1, z0), P(x + 1, y + 1, z1), P(x + 1, y, z1)],
    ];
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, z / 2);
    for (const f of faces) {
      ctx.beginPath();
      f.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // A bright outline round the top of tile (x, y) at height h.
  function outline(ctx, z, x, y, h) {
    const P = (px, py) => { const q = Iso.project(room(), px * TU, py * TU, h); return [q.x * z, q.y * z]; };
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.stroke();
  }

  // Diamond outline of a footprint, in device pixels.
  function diamond(ctx, z, f, h, color) {
    const pts = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.d], [f.x, f.y + f.d]].map(([x, y]) => Iso.project(room(), x * TU, y * TU, h));
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x * z, p.y * z) : ctx.moveTo(p.x * z, p.y * z)));
    ctx.closePath();
    ctx.fill();
  }

  // Ghost preview, drawn on top of the room.
  state.onDrawTop = (ctx, z) => {
    if (!state.editing) return;
    if (mode === 'erase') {
      drawDoomed(ctx, z);
      return;
    }
    if (tab === 'terrain') {
      const h = build.hover;
      if (!h) return;
      const r = room();
      if (build.tool === 'stairs' || build.tool === 'spiral') {
        // The steps themselves, see-through, or the tile in red with why they can't go there.
        const g = build.stairs;
        if (g?.steps?.length) {
          ctx.save();
          ctx.globalAlpha = 0.65;
          for (const c of g.steps) Iso.blit(ctx, g.room, Iso.stairSprite(c, g.room), c.x * TU, c.y * TU, c.z, z);
          ctx.restore();
          for (const c of g.steps) outline(ctx, z, c.x, c.y, c.z);
        } else if (g?.err) {
          if (!h.ground && !h.stair) ghost(ctx, z, h.x, h.y, h.z, h.z - 2, 'rgba(235,60,80,0.45)');
        }
        return;
      }
      // The block in hand, see-through, exactly where it would land, with its tile outlined.
      const t = targetOf(h);
      if (!t) return;
      const b = Iso.BLOCKS[build.block];
      const tz = b.kind === 'water' ? 0 : t.z;
      ctx.save();
      ctx.globalAlpha = 0.6;
      Iso.blit(ctx, r, Iso.blockSprite(build.block), t.x * TU, t.y * TU, tz, z);
      ctx.restore();
      outline(ctx, z, t.x, t.y, tz);
      return;
    }
    if (!hover) return;
    const r = room();
    if (tool && hover.x !== undefined) {
      const def = Iso.OBJECTS[tool.type];
      const o = { type: tool.type, x: hover.x, y: hover.y, flip: hover.flip };
      const ok = Iso.canPlace(r, tool.type, o.x, o.y, o.flip, hover.f);
      const h = Iso.floorZ(r, hover.f);
      if (!def.wall) diamond(ctx, z, Iso.footprint(o), h, ok ? 'rgba(124,196,127,0.35)' : 'rgba(224,64,90,0.4)');
      ctx.globalAlpha = ok ? 0.75 : 0.4;
      Iso.blit(ctx, r, Iso.objectSprite(tool.type, o.flip, still), o.x * TU, o.y * TU, h, z);
      ctx.globalAlpha = 1;
    } else if (hover.pick >= 0) {
      const o = r.objects[hover.pick];
      const def = o && Iso.OBJECTS[o.type];
      if (def && !def.wall) diamond(ctx, z, Iso.footprint(o), Iso.floorZ(r, o.f || 0), 'rgba(255,224,102,0.35)');
    }
  };

  // Erase mode: the thing under the mouse, drawn again over itself in see-through red.
  function drawDoomed(ctx, z) {
    const d = doomed;
    if (!d) return;
    const r = room();
    const pulse = 0.75 + 0.2 * Math.sin(Date.now() / 160);
    ctx.save();
    ctx.globalAlpha = pulse;
    if (d.object !== undefined) {
      const o = r.objects[d.object];
      if (o && Iso.OBJECTS[o.type]) Iso.blit(ctx, r, Iso.tinted(Iso.objectSprite(o.type, o.flip, still)), o.x * TU, o.y * TU, Iso.floorZ(r, o.f || 0), z);
    } else if (d.stair) {
      // The whole flight goes, so all of it turns red.
      const fl = r.flights.find((f) => f.cells.some(([x, y]) => x === d.stair.x && y === d.stair.y));
      const mine = new Set((fl?.cells || [[d.stair.x, d.stair.y]]).map(([x, y]) => `${x},${y}`));
      for (const c of Iso.cells(r).list) {
        if (c.kind === 'stair' && mine.has(`${c.x},${c.y}`)) Iso.blit(ctx, r, Iso.tinted(Iso.stairSprite(c, r)), c.x * TU, c.y * TU, c.z, z);
      }
    } else {
      const h = d.block;
      const zn = r.zones[h.f];
      const low = zn.kind === 'water' ? h.z - (zn.depth || 40) : zn.thin ? h.z - Iso.SLAB : Math.max(h.z - Iso.STEP_Z, -Iso.SLAB);
      ghost(ctx, z, h.x, h.y, h.z, low, 'rgba(235,50,70,0.6)');
    }
    ctx.restore();
  }

  // ---- Toggle -------------------------------------------------------------------------

  // The edit button opens the editor in the drawer; the drawer tells us when editing starts or stops.
  btnEdit.addEventListener('click', () => RoomApp.drawer.toggle('edit'));
  function setEditing(on) {
    if (state.editing === on) return;
    state.editing = on;
    if (!on) cancelMove();
    tool = null;
    build.hover = null;
    doomed = null;
    mode = 'build';
    canvas.style.cursor = '';
    btnEdit.classList.toggle('on', on);
    document.getElementById('toolbar').classList.toggle('pinned', on);
    if (!on) save();
    refresh();
  }

  modeButtons.forEach((b) => b.addEventListener('click', () => {
    if (mode === 'build' && tool?.moving) cancelMove();
    mode = b.dataset.mode;
    tool = null;
    build.hover = null;
    doomed = null;
    canvas.style.cursor = '';
    save();
    refresh();
  }));

  tabButtons.forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    cancelMove();
    build.hover = null;
    refresh();
  }));

  Common.onDprChange((dpr) => { DPR = dpr; refresh(); });

  window.RoomEditor = { refresh, setEditing };
})();
