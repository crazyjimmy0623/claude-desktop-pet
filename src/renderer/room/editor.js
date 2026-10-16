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
    terrain: '左鍵：點方塊頂面往上疊、點側面往旁邊接、點空地鋪地面；右鍵：拆掉一顆',
    stairs: '樓梯：點高台的側面，會一路往下接到前面比較低的地板；右鍵點樓梯拆掉',
    floor: '選樓層，再點一下換那層的地板',
    wall: '選樓層，再點一下換那層的牆面',
    room: '換整體風格，或重設成預設房間',
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
    hint.textContent = tab === 'terrain' && build.tool === 'stairs' ? HINTS.stairs : HINTS[tab];
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
      if (!Iso.isOpen(room(), storey)) storey = 0;
      room().zones.forEach((zn, i) => {
        if (Iso.isOpen(room(), i)) row.append(button(zn.name || `${i + 1}F`, null, storey === i, () => { storey = i; refresh(); }));
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
      // Themes reskin whatever is built, by what each layer is.
      const row = document.createElement('div');
      row.className = 'row';
      for (const [id, t] of Object.entries(Iso.THEMES)) {
        row.append(button(`風格：${t.name}`, null, room().theme === id, () => {
          Iso.applyTheme(room(), id);
          save();
          refresh();
        }));
      }
      palette.append(row);
      // Upgrades: spend coins to open the next layer of the room.
      const up = document.createElement('div');
      up.className = 'row';
      const level = state.progress?.roomLevel || 0;
      const next = Catalog.ROOM_UPGRADES.find((u) => u.level === level + 1);
      if (next) {
        const opens = room().zones.filter((zn) => zn.level === next.level).map((zn) => zn.name).join('、') || next.name;
        const b = button(`擴建：${opens}（${next.cost} 🪙）`, null, false, async () => {
          const res = await desk.invoke('room:upgrade');
          hint.textContent = res?.error || `擴建完成：${opens}！`;
        });
        b.title = next.desc;
        if ((state.progress?.coins || 0) < next.cost) b.classList.add('locked');
        up.append(b);
      } else {
        up.append(button('房間已全部升級 ✨', null, false, () => {}));
      }
      palette.append(up);
    }
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
      Object.defineProperty(r, 'level', { value: 3, enumerable: false });
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
  const targetOf = (hit) => (hit?.ground ? { x: hit.x, y: hit.y, z: 0 } : Iso.blockTarget(hit));

  function terrainDown(e) {
    const r = room();
    const hit = buildHit(e);
    if (e.button === 2) {
      if (!hit.ground) terrain(Iso.removeBlock(r, hit));
      return;
    }
    if (build.tool === 'stairs') terrain(hit.ground ? '點高台的側面來放樓梯' : Iso.stairsFrom(r, hit), '樓梯蓋好了');
    else terrain(Iso.placeBlock(r, build.block, targetOf(hit)));
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!state.editing) return;
    if (tab === 'terrain') {
      build.hover = buildHit(e);
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
      if (build.tool === 'stairs') {
        if (!h.ground && !h.stair) ghost(ctx, z, h.x, h.y, h.z, h.z - Iso.STEP_Z, 'rgba(255,214,90,0.35)');
        return;
      }
      const t = targetOf(h);
      const b = Iso.BLOCKS[build.block];
      if (t) ghost(ctx, z, t.x, t.y, b.kind === 'water' ? 0 : t.z, b.thin ? t.z - Iso.SLAB : Math.min(t.z - Iso.STEP_Z, -Iso.SLAB), 'rgba(124,196,255,0.35)');
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

  btnEdit.addEventListener('click', () => {
    state.editing = !state.editing;
    if (!state.editing) cancelMove();
    tool = null;
    editorEl.classList.toggle('hidden', !state.editing);
    btnEdit.classList.toggle('on', state.editing);
    document.getElementById('toolbar').classList.toggle('pinned', state.editing);
    if (!state.editing) save();
    RoomApp.layout();
    refresh();
  });

  tabButtons.forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    tool = null;
    build.hover = null;
    refresh();
  }));

  window.RoomEditor = { refresh };
})();
