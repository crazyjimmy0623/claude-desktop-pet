/* global desk, Iso, Catalog, RoomApp */
// Room editor: place, turn, move and delete furniture; swap the floor, walls and theme.
(function () {
  const { state } = RoomApp;
  const DPR = window.devicePixelRatio || 1;
  const TU = Iso.TU;
  const canvas = document.getElementById('room');
  const editorEl = document.getElementById('editor');
  const palette = document.getElementById('palette');
  const hint = document.getElementById('editor-hint');
  const btnEdit = document.getElementById('btn-edit');
  const tabButtons = [...document.querySelectorAll('.tabs button[data-tab]')];

  let tab = 'furniture';
  let tool = null; // { type, flip, moving?, orig? }
  let hover = null; // { x, y, f, flip } — a floor tile, or a wall spot for wall items
  let storey = 0; // which floor the floor/wall tabs paint
  // Terrain: the layer being built on, the tool, and the first end of a stair being laid.
  // Building: the block in hand (or the stairs tool) and the face under the mouse.
  const build = { block: 'brick', tool: 'block', hover: null };

  const HINTS = {
    furniture: '點家具放進房間；R 或右下按鈕換方向；點房間裡的家具可搬動，右鍵刪除',
    terrain: '半透明的方塊就是會放下去的位置：點頂面往上疊、點側面往旁邊接、點空地鋪地面',
    stairs: '樓梯：放在高台旁邊的地板上，會自動朝高的那邊爬上去；落差大會多幾階',
    spiral: '旋轉樓梯：放在高處旁邊的地板上，一格就能繞上去，最多五層',
    erase: '刪除：指到的方塊會變紅，點一下拆掉一顆（實心的變矮一層），也可以拆樓梯',
    floor: '選樓層，再點一下換那層的地板',
    wall: '選樓層，再點一下換那層的牆面',
    room: '套用設計好的藍圖，或換時間和天氣',
    scenery: '房間後面的風景：先挑一組預設，再自己加減植物、換地面、層數和密度',
  };

  const itemName = (id) => Catalog.ITEMS.find((i) => i.id === id)?.name || id;
  const owned = (type) => (state.progress?.owned || []).filter((id) => id.startsWith(`${type}:`)).map((id) => id.split(':')[1]);
  const room = () => state.room;
  const save = () => RoomApp.setRoom(room(), { save: true, relayout: false });
  const still = { frame: 0, active: false, now: Date.now(), hour: 14, meeting: false };

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

  function button(label, preview, selected, onClick) {
    const b = document.createElement('button');
    if (preview) b.append(preview);
    const span = document.createElement('span');
    span.textContent = label;
    b.append(span);
    if (selected) b.classList.add('selected');
    b.addEventListener('click', onClick);
    return b;
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
    hint.textContent = tab === 'terrain' && build.tool !== 'block' ? HINTS[build.tool] : HINTS[tab];
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    palette.replaceChildren();
    if (tab === 'furniture') {
      for (const type of owned('obj')) {
        if (!Iso.OBJECTS[type]) continue;
        const sp = Iso.objectSprite(type, false, still);
        palette.append(button(itemName(`obj:${type}`), swatch(sp.canvas, 1), tool?.type === type && !tool.moving, () => {
          tool = { type, flip: false };
          refresh();
        }));
      }
      if (tool) palette.append(button('↻ 換方向', null, false, () => { tool.flip = !tool.flip; }));
    } else if (tab === 'terrain') {
      refreshTerrain();
    } else if (tab === 'floor' || tab === 'wall') {
      const key = tab;
      const row = document.createElement('div');
      row.className = 'row';
      if (!room().zones[storey]) storey = 0;
      room().zones.forEach((zn, i) => {
        row.append(button(zn.name || `${i + 1}F`, null, storey === i, () => { storey = i; refresh(); }));
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
    } else if (tab === 'scenery') {
      refreshScenery();
    } else if (tab === 'room') {
      // Blueprints: designed rooms to move into and then make your own.
      const plans = document.createElement('div');
      plans.className = 'row';
      for (const [id, bp] of Object.entries(Iso.BLUEPRINTS)) {
        const b = button(`藍圖：${bp.name}`, blueprintThumb(id), room().blueprint === id, () => {
          if (!window.confirm(`套用「${bp.name}」會取代目前的房間（家具和地形），確定嗎？`)) return;
          RoomApp.setRoom(Iso.generateRoom(id), { save: true });
          refresh();
          hint.textContent = `已套用「${bp.name}」，可以再用地形和家具分頁慢慢改`;
        });
        b.title = bp.desc;
        plans.append(b);
      }
      palette.append(plans);
      // Time of day and weather, the same switches as in the settings.
      const sky = document.createElement('div');
      sky.className = 'row';
      const S = RoomApp.state.settings || {};
      const pickSetting = (patch) => desk.invoke('settings:set', patch).then(() => { Object.assign(RoomApp.state.settings, patch); refresh(); });
      for (const [id, name] of [['clock', '🕒 跟著時鐘'], ['day', '☀️ 白天'], ['dusk', '🌇 傍晚'], ['night', '🌙 夜晚']]) {
        sky.append(button(name, null, (S.timeOfDay || 'clock') === id, () => pickSetting({ timeOfDay: id })));
      }
      for (const [id, name] of Object.entries(Iso.WEATHERS)) {
        sky.append(button(`天氣：${name}`, null, (S.weather || 'auto') === id, () => pickSetting({ weather: id })));
      }
      palette.append(sky);
    }
  }

  // Scenery: a preset, or a mix of plants of your own on a ground of your choosing.
  function refreshScenery() {
    const bd = Iso.backdropOf(room());
    const raw = room().backdrop !== undefined ? room().backdrop : Iso.BLUEPRINTS[room().blueprint]?.backdrop || null;
    const custom = raw && typeof raw === 'object';
    const apply = (b) => {
      room().backdrop = b;
      RoomApp.setRoom(room(), { save: true });
      refresh();
    };
    // Any change turns the scenery into the room's own mix.
    const change = (patch) => apply({ ...(bd || { plants: [], ground: 'grass', rows: 2, density: 1, seed: 0 }), preset: null, ...patch });
    const row = (label) => {
      const r = document.createElement('div');
      r.className = 'row';
      const b = document.createElement('b');
      b.textContent = label;
      r.append(b);
      palette.append(r);
      return r;
    };
    const presets = row('預設');
    presets.append(button('無', null, !bd, () => apply(null)));
    for (const [id, name] of Object.entries(Iso.BACKDROPS)) presets.append(button(name, null, raw === id, () => apply(id)));
    if (custom && bd) presets.append(button('✎ 自訂', null, true, () => {}));
    const plants = row('植物');
    for (const [id, pl] of Object.entries(Iso.BACKDROP_PLANTS)) {
      const on = !!bd && bd.plants.includes(id);
      plants.append(button(pl.name, plantThumb(id), on, () => {
        const list = bd ? bd.plants.filter((k) => k !== id) : [];
        change({ plants: on ? list : [...list, id] });
      }));
    }
    if (!bd) return;
    const ground = row('地面');
    for (const [id, name] of Object.entries(Iso.BACKDROP_GROUNDS)) ground.append(button(name, null, bd.ground === id, () => change({ ground: id })));
    const more = row('層數');
    for (const n of [1, 2, 3]) more.append(button(`${n} 排`, null, bd.rows === n, () => change({ rows: n })));
    const dense = document.createElement('b');
    dense.textContent = '密度';
    more.append(dense);
    for (const [d, name] of [[0.45, '稀疏'], [0.75, '普通'], [1, '茂密']]) more.append(button(name, null, Math.abs(bd.density - d) < 0.13, () => change({ density: d })));
    more.append(button('🎲 重新排列', null, false, () => change({ seed: (bd.seed || 0) + 1 })));
  }

  // One plant, fitted into a small box.
  function plantThumb(kind) {
    const sp = Iso.backdropThumb(kind).canvas;
    const c = document.createElement('canvas');
    const W = 36;
    const H = 44;
    c.width = W * DPR;
    c.height = H * DPR;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    // Cropped to the drawn pixels first: the sprite canvas has room to spare.
    const px = sp.getContext('2d').getImageData(0, 0, sp.width, sp.height).data;
    let [x0, y0, x1, y1] = [sp.width, sp.height, 0, 0];
    for (let y = 0; y < sp.height; y++) {
      for (let i = 0; i < sp.width; i++) {
        if (px[(y * sp.width + i) * 4 + 3] < 8) continue;
        x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
      }
    }
    if (x1 <= x0) return c;
    const w = x1 - x0;
    const h = y1 - y0;
    const k = Math.min((W * DPR) / w, (H * DPR) / h, 2 * DPR);
    x.drawImage(sp, x0, y0, w, h, (W * DPR - w * k) / 2, H * DPR - h * k, w * k, h * k);
    return c;
  }

  function refreshTerrain() {
    const row = document.createElement('div');
    row.className = 'row';
    for (const [id, b] of Object.entries(Iso.BLOCKS)) {
      row.append(button(b.name, swatch(Iso.blockSprite(id).canvas, 2), build.tool === 'block' && build.block === id, () => {
        Object.assign(build, { block: id, tool: 'block' });
        refresh();
      }));
    }
    row.append(button('🪜 樓梯', null, build.tool === 'stairs', () => {
      build.tool = build.tool === 'stairs' ? 'block' : 'stairs';
      refresh();
    }));
    row.append(button('🌀 旋轉樓梯', null, build.tool === 'spiral', () => {
      build.tool = build.tool === 'spiral' ? 'block' : 'spiral';
      refresh();
    }));
    row.append(button('🗑 刪除', null, build.tool === 'erase', () => {
      build.tool = build.tool === 'erase' ? 'block' : 'erase';
      refresh();
    }));
    palette.append(row);
  }

  // Apply a terrain edit: save, re-lay the room (its size may change) and report.
  function terrain(err, ok) {
    RoomApp.setRoom(room(), { save: true });
    refresh();
    if (err || ok) hint.textContent = err || ok;
  }

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
    const t = Iso.tileAt(room(), p.x, p.y);
    return t ? { x: t.x, y: t.y, f: t.f, flip: tool?.flip || false } : null;
  }

  function objectAt(e) {
    const p = RoomApp.finePoint(e);
    const w = Iso.wallAt(room(), p.x, p.y);
    const t = Iso.tileAt(room(), p.x, p.y);
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
    const r = room();
    const hit = buildHit(e);
    if (e.button !== 0) return;
    if (build.tool === 'erase') {
      if (!hit.ground) terrain(Iso.removeBlock(r, hit));
      return;
    }
    if (build.tool === 'stairs') terrain(Iso.placeStairs(r, hit), '樓梯蓋好了');
    else if (build.tool === 'spiral') terrain(Iso.placeSpiral(r, hit), '旋轉樓梯蓋好了');
    else terrain(Iso.placeBlock(r, build.block, targetOf(hit)));
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!state.editing) return;
    if (tab === 'terrain') {
      build.hover = buildHit(e);
      build.stairs = build.tool === 'stairs' || build.tool === 'spiral' ? stairGhost(build.hover, build.tool) : null;
      return;
    }
    hover = tool ? target(e) : { pick: objectAt(e) };
  });
  canvas.addEventListener('mouseleave', () => { hover = null; build.hover = null; });

  function cancelMove() {
    if (tool?.moving) room().objects.push({ type: tool.type, ...tool.orig });
    tool = null;
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!state.editing) return;
    if (tab === 'terrain') { terrainDown(e); return; }
    const r = room();
    if (e.button === 2) {
      if (tool) {
        cancelMove();
        save();
      } else {
        const i = objectAt(e);
        if (i >= 0) {
          r.objects.splice(i, 1);
          save();
        }
      }
      refresh();
      return;
    }
    if (e.button !== 0) return;
    if (tool) {
      const t = target(e);
      if (t && Iso.canPlace(r, tool.type, t.x, t.y, t.flip, t.f)) {
        r.objects.push({ type: tool.type, x: t.x, y: t.y, flip: t.flip, f: t.f });
        if (tool.moving) tool = null;
        save();
        refresh();
      }
      return;
    }
    const i = objectAt(e);
    if (i >= 0) {
      const [o] = r.objects.splice(i, 1);
      tool = { type: o.type, flip: !!o.flip, moving: true, orig: { x: o.x, y: o.y, flip: !!o.flip, f: o.f || 0 } };
      tab = 'furniture';
      save();
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
    if (tab === 'terrain') {
      const h = build.hover;
      if (!h) return;
      const r = room();
      if (build.tool === 'erase') {
        // The block that would go, in red.
        if (h.stair) ghost(ctx, z, h.x, h.y, h.z, h.z - h.stair.rise, 'rgba(235,60,80,0.5)');
        else if (!h.ground) {
          const zn = r.zones[h.f];
          const low = zn.kind === 'water' ? h.z - (zn.depth || 40) : zn.thin ? h.z - Iso.SLAB : Math.max(h.z - Iso.STEP_Z, -Iso.SLAB);
          ghost(ctx, z, h.x, h.y, h.z, low, 'rgba(235,60,80,0.5)');
        }
        return;
      }
      if (build.tool === 'stairs' || build.tool === 'spiral') {
        // The steps themselves, see-through, or the tile in red with why they can't go there.
        const g = build.stairs;
        if (g?.steps?.length) {
          ctx.save();
          ctx.globalAlpha = 0.65;
          for (const c of g.steps) Iso.blit(ctx, g.room, Iso.stairSprite(c, g.room), c.x * TU, c.y * TU, c.z, z);
          ctx.restore();
          for (const c of g.steps) outline(ctx, z, c.x, c.y, c.z);
          hint.textContent = HINTS[build.tool];
        } else if (g?.err) {
          if (!h.ground && !h.stair) ghost(ctx, z, h.x, h.y, h.z, h.z - 2, 'rgba(235,60,80,0.45)');
          hint.textContent = g.err;
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

  // ---- Toggle -------------------------------------------------------------------------

  // The edit button opens the editor in the drawer; the drawer tells us when editing starts or stops.
  btnEdit.addEventListener('click', () => RoomApp.drawer.toggle('edit'));
  function setEditing(on) {
    if (state.editing === on) return;
    state.editing = on;
    if (!on) cancelMove();
    tool = null;
    build.hover = null;
    btnEdit.classList.toggle('on', on);
    document.getElementById('toolbar').classList.toggle('pinned', on);
    if (!on) save();
    refresh();
  }

  tabButtons.forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    tool = null;
    build.hover = null;
    refresh();
  }));

  window.RoomEditor = { refresh, setEditing };
})();
