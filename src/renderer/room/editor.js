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
  let hover = null; // { x, y, flip } — a floor tile, or a wall spot for wall items

  const HINTS = {
    furniture: '點家具放進房間；R 或右下按鈕換方向；點房間裡的家具可搬動，右鍵刪除',
    floor: '點一下換整間地板',
    wall: '點一下換牆面',
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
    hint.textContent = HINTS[tab];
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
    } else if (tab === 'floor') {
      for (const id of owned('floor')) {
        const f = Iso.FLOORS[id];
        if (!f) continue;
        palette.append(button(itemName(`floor:${id}`), tileSwatch((x) => { x.fillStyle = f.base; x.beginPath(); x.moveTo(17, 4); x.lineTo(33, 12); x.lineTo(17, 20); x.lineTo(1, 12); x.fill(); }), room().floor === id, () => {
          room().floor = id;
          save();
          refresh();
        }));
      }
    } else if (tab === 'wall') {
      for (const id of owned('wall')) {
        const w = Iso.WALLS[id];
        if (!w) continue;
        palette.append(button(itemName(`wall:${id}`), tileSwatch((x) => { x.fillStyle = w.base; x.fillRect(4, 2, 26, 22); x.fillStyle = w.trim; x.fillRect(4, 20, 26, 4); }), room().wall === id, () => {
          room().wall = id;
          save();
          refresh();
        }));
      }
    } else if (tab === 'room') {
      const row = document.createElement('div');
      row.className = 'row';
      for (const [id, t] of Object.entries(Iso.THEMES)) {
        row.append(button(t.name, null, room().theme === id, () => {
          Object.assign(room(), { theme: id, wall: t.wall, floor: t.floor });
          save();
          refresh();
        }));
      }
      row.append(button('重設為預設房間', null, false, () => {
        RoomApp.setRoom(Iso.generateRoom(room().theme), { save: true });
        refresh();
      }));
      palette.append(row);
    }
  }

  // ---- Canvas interaction -----------------------------------------------------------

  // Where the tool would go under the mouse.
  function target(e) {
    const p = RoomApp.finePoint(e);
    const def = tool && Iso.OBJECTS[tool.type];
    if (def?.wall) {
      const w = Iso.wallAt(room(), p.x, p.y);
      if (!w) return null;
      return w.flip ? { x: 0, y: w.along, flip: true } : { x: w.along, y: 0, flip: false };
    }
    const t = Iso.tileAt(room(), p.x, p.y);
    return t ? { x: t.x, y: t.y, flip: tool?.flip || false } : null;
  }

  function objectAt(e) {
    const p = RoomApp.finePoint(e);
    const w = Iso.wallAt(room(), p.x, p.y);
    const t = Iso.tileAt(room(), p.x, p.y);
    let found = -1;
    room().objects.forEach((o, i) => {
      const def = Iso.OBJECTS[o.type];
      if (!def) return;
      if (def.wall) {
        if (w && !!o.flip === w.flip) {
          const along = o.flip ? o.y : o.x;
          if (w.along >= along && w.along < along + def.w) found = i;
        }
        return;
      }
      const f = Iso.footprint(o);
      if (t && t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.d && (found < 0 || !def.flat)) found = i;
    });
    return found;
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!state.editing) return;
    hover = tool ? target(e) : { pick: objectAt(e) };
  });
  canvas.addEventListener('mouseleave', () => { hover = null; });

  function cancelMove() {
    if (tool?.moving) room().objects.push({ type: tool.type, ...tool.orig });
    tool = null;
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!state.editing) return;
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
      if (t && Iso.canPlace(r, tool.type, t.x, t.y, t.flip)) {
        r.objects.push({ type: tool.type, x: t.x, y: t.y, flip: t.flip });
        if (tool.moving) tool = null;
        save();
        refresh();
      }
      return;
    }
    const i = objectAt(e);
    if (i >= 0) {
      const [o] = r.objects.splice(i, 1);
      tool = { type: o.type, flip: !!o.flip, moving: true, orig: { x: o.x, y: o.y, flip: !!o.flip } };
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

  // Diamond outline of a footprint, in device pixels.
  function diamond(ctx, z, f, h, color) {
    const n = room().n;
    const pts = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.d], [f.x, f.y + f.d]].map(([x, y]) => Iso.project(n, x * TU, y * TU, h));
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x * z, p.y * z) : ctx.moveTo(p.x * z, p.y * z)));
    ctx.closePath();
    ctx.fill();
  }

  // Ghost preview, drawn on top of the room.
  state.onDrawTop = (ctx, z) => {
    if (!state.editing || !hover) return;
    const r = room();
    if (tool && hover.x !== undefined) {
      const def = Iso.OBJECTS[tool.type];
      const o = { type: tool.type, x: hover.x, y: hover.y, flip: hover.flip };
      const ok = Iso.canPlace(r, tool.type, o.x, o.y, o.flip);
      const h = def.wall ? 0 : Iso.heightAt(r, o.x, o.y) ?? 0;
      if (!def.wall) diamond(ctx, z, Iso.footprint(o), h, ok ? 'rgba(124,196,127,0.35)' : 'rgba(224,64,90,0.4)');
      ctx.globalAlpha = ok ? 0.75 : 0.4;
      Iso.blit(ctx, r.n, Iso.objectSprite(tool.type, o.flip, still), o.x * TU, o.y * TU, h, z);
      ctx.globalAlpha = 1;
    } else if (hover.pick >= 0) {
      const o = r.objects[hover.pick];
      const def = o && Iso.OBJECTS[o.type];
      if (def && !def.wall) diamond(ctx, z, Iso.footprint(o), Iso.heightAt(r, o.x, o.y) ?? 0, 'rgba(255,224,102,0.35)');
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
    refresh();
  }));

  window.RoomEditor = { refresh };
})();
