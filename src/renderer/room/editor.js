/* global desk, Furniture, Catalog, RoomApp */
// Room editor: place/move/delete furniture, paint floors (built-in or custom PNG tiles), change walls and size.
(function () {
  const { state } = RoomApp;
  const T = Furniture.T;
  const DPR = window.devicePixelRatio || 1;
  const canvas = document.getElementById('room');
  const editorEl = document.getElementById('editor');
  const palette = document.getElementById('palette');
  const hint = document.getElementById('editor-hint');
  const btnEdit = document.getElementById('btn-edit');
  const tabButtons = [...document.querySelectorAll('.tabs button[data-tab]')];

  let tab = 'furniture';
  let tool = null; // { kind: 'object', type, moving?, orig? } | { kind: 'floor', id } | { kind: 'custom', file, i }
  let hover = null;
  let painting = false;

  const HINTS = {
    furniture: '點選家具後放到房間裡；點房間裡的家具可以搬動，右鍵刪除',
    floor: '點選地板後在房間裡點擊或拖曳塗色',
    wall: '點一下就換整面牆',
    custom: '把 16x16 的 PNG 放進素材資料夾的 tiles/，就能在這裡塗',
    room: '調整房間大小、重設或重新載入素材',
  };

  const itemName = (id) => Catalog.ITEMS.find((i) => i.id === id)?.name || id;
  const owned = (type) => (state.progress?.owned || []).filter((id) => id.startsWith(`${type}:`)).map((id) => id.split(':')[1]);

  function room() {
    return state.room;
  }

  function save(relayout = false) {
    RoomApp.setRoom(room(), { save: true, relayout });
  }

  // ---- Palette ----------------------------------------------------------------------

  function previewCanvas(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w * DPR;
    c.height = h * DPR;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    drawFn(x);
    return c;
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

  function refresh() {
    if (!state.editing) return;
    hint.textContent = HINTS[tab];
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    palette.replaceChildren();
    if (tab === 'furniture') {
      for (const type of owned('obj')) {
        const def = Furniture.OBJECTS[type];
        if (!def) continue;
        const s = 1.5;
        const top = def.wall ? 0 : 20;
        const pc = previewCanvas(def.w * T * s, (def.h * T + top) * s, (x) => {
          x.translate(0, top * s * DPR);
          Furniture.drawObject(x, s * DPR, { type, x: 0, y: 0 }, { frame: 0, active: false, now: Date.now(), hour: 12 });
        });
        palette.append(button(itemName(`obj:${type}`), pc, tool?.kind === 'object' && tool.type === type && !tool.moving, () => {
          tool = { kind: 'object', type };
          refresh();
        }));
      }
    } else if (tab === 'floor') {
      for (const id of owned('floor')) {
        const pc = previewCanvas(32, 32, (x) => Furniture.drawFloorTile(x, 2 * DPR, 0, 0, id));
        palette.append(button(itemName(`floor:${id}`), pc, tool?.kind === 'floor' && tool.id === id, () => {
          tool = { kind: 'floor', id };
          refresh();
        }));
      }
      if (tool?.kind === 'floor') {
        palette.append(button(`整間鋪「${itemName(`floor:${tool.id}`)}」`, null, false, () => {
          room().floor = tool.id;
          room().tiles = Object.fromEntries(Object.entries(room().tiles).filter(([, v]) => typeof v === 'object'));
          save();
        }));
      }
    } else if (tab === 'wall') {
      for (const id of owned('wall')) {
        const pc = previewCanvas(32, 32, (x) => {
          const w = Furniture.WALLS[id];
          x.fillStyle = w.base;
          x.fillRect(0, 0, 32 * DPR, 32 * DPR);
          w.draw((rx, ry, rw, rh, color) => { x.fillStyle = color; x.fillRect(rx * 2 * DPR, ry * DPR, rw * 2 * DPR, rh * DPR); }, 0);
        });
        palette.append(button(itemName(`wall:${id}`), pc, room().wall === id, () => {
          room().wall = id;
          save();
          refresh();
        }));
      }
    } else if (tab === 'custom') {
      const tiles = state.assets?.tiles || [];
      if (!tiles.length) {
        const p = document.createElement('div');
        p.className = 'row';
        p.textContent = '還沒有自訂地板。';
        p.append(button('開啟素材資料夾', null, false, () => desk.invoke('assets:open-folder')));
        p.append(button('重新載入素材', null, false, () => desk.invoke('assets:reload')));
        palette.append(p);
      }
      for (const t of tiles) {
        const img = state.customTiles[t.file]?.img;
        if (!img?.complete) {
          img?.addEventListener('load', refresh, { once: true });
          continue;
        }
        const cols = Math.max(1, Math.floor(img.width / T));
        const rows = Math.max(1, Math.floor(img.height / T));
        for (let i = 0; i < cols * rows; i++) {
          const pc = previewCanvas(32, 32, (x) => Furniture.drawFloorTile(x, 2 * DPR, 0, 0, { file: t.file, i }, state.customTiles));
          palette.append(button(`${t.file.replace(/\.png$/i, '')}#${i}`, pc, tool?.kind === 'custom' && tool.file === t.file && tool.i === i, () => {
            tool = { kind: 'custom', file: t.file, i };
            refresh();
          }));
        }
      }
    } else if (tab === 'room') {
      const row = (label, value, onMinus, onPlus) => {
        const r = document.createElement('div');
        r.className = 'row';
        const l = document.createElement('span');
        l.textContent = `${label}：${value}`;
        l.style.minWidth = '80px';
        r.append(l, button('－', null, false, onMinus), button('＋', null, false, onPlus));
        return r;
      };
      palette.append(row('高度', `${room().h} 格`, () => resize(0, -1), () => resize(0, 1)));
      const r = document.createElement('div');
      r.className = 'row';
      r.append(
        button('重設為預設房間', null, false, () => {
          RoomApp.setRoom(Furniture.generateRoom(room().w, room().h), { save: true });
          refresh();
        }),
        button('開啟素材資料夾', null, false, () => desk.invoke('assets:open-folder')),
        button('重新載入素材', null, false, () => desk.invoke('assets:reload')),
      );
      palette.append(r);
    }
  }

  function resize(dw, dh) {
    const r = room();
    const w = Math.max(10, Math.min(40, r.w + dw));
    const h = Math.max(6, Math.min(14, r.h + dh));
    if (w === r.w && h === r.h) return;
    r.w = w;
    r.h = h;
    r.objects = r.objects.filter((o) => {
      const def = Furniture.OBJECTS[o.type];
      return def && o.x + def.w <= w && o.y + def.h <= h;
    });
    r.tiles = Object.fromEntries(Object.entries(r.tiles).filter(([k]) => {
      const [x, y] = k.split(',').map(Number);
      return x < w && y < h;
    }));
    save(true);
    refresh();
  }

  // ---- Canvas interaction -----------------------------------------------------------

  function objectAt(t) {
    const r = room();
    let found = -1;
    let rank = -1;
    r.objects.forEach((o, i) => {
      const def = Furniture.OBJECTS[o.type];
      if (!def) return;
      const inside = t.x >= o.x && t.x < o.x + def.w && t.y >= o.y - (def.wall || def.flat ? 0 : 1) && t.y < o.y + def.h;
      const myRank = def.flat ? 0 : def.wall ? 1 : 2;
      if (inside && myRank >= rank) { found = i; rank = myRank; }
    });
    return found;
  }

  function paint(t) {
    const r = room();
    if (t.y < r.wallRows || t.x < 0 || t.y >= r.h || t.x >= r.w) return;
    const key = `${t.x},${t.y}`;
    if (tool.kind === 'floor') {
      if (tool.id === r.floor) delete r.tiles[key]; else r.tiles[key] = tool.id;
    } else {
      r.tiles[key] = { file: tool.file, i: tool.i };
    }
    save();
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!state.editing) return;
    hover = RoomApp.tileAt(e);
    if (painting && tool && tool.kind !== 'object') paint(hover);
  });

  canvas.addEventListener('mouseleave', () => { hover = null; });

  canvas.addEventListener('mousedown', (e) => {
    if (!state.editing) return;
    const t = RoomApp.tileAt(e);
    const r = room();
    if (e.button === 2) {
      if (tool?.moving) r.objects.push({ type: tool.type, ...tool.orig });
      if (tool) {
        tool = null;
        save();
      } else {
        const i = objectAt(t);
        if (i >= 0) {
          r.objects.splice(i, 1);
          save();
        }
      }
      refresh();
      return;
    }
    if (e.button !== 0) return;
    if (tool?.kind === 'object') {
      const def = Furniture.OBJECTS[tool.type];
      const x = t.x;
      const y = t.y - def.h + 1;
      if (Furniture.canPlace(r, tool.type, x, y)) {
        r.objects.push({ type: tool.type, x, y });
        if (tool.moving) tool = null;
        save();
        refresh();
      }
      return;
    }
    if (tool) {
      painting = true;
      paint(t);
      return;
    }
    const i = objectAt(t);
    if (i >= 0) {
      const [o] = r.objects.splice(i, 1);
      tool = { kind: 'object', type: o.type, moving: true, orig: { x: o.x, y: o.y } };
      tab = 'furniture';
      save();
      refresh();
    }
  });

  window.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('contextmenu', (e) => { if (state.editing) e.preventDefault(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !tool) return;
    if (tool.moving) room().objects.push({ type: tool.type, ...tool.orig });
    tool = null;
    save();
    refresh();
  });

  // Ghost preview and grid, drawn on top of the room.
  state.onDrawTop = (ctx, u) => {
    if (!state.editing) return;
    const r = room();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 1; x < r.w; x++) ctx.fillRect(x * T * u, 0, 1, r.h * T * u);
    for (let y = 1; y < r.h; y++) ctx.fillRect(0, y * T * u, r.w * T * u, 1);
    if (!hover) return;
    if (tool?.kind === 'object') {
      const def = Furniture.OBJECTS[tool.type];
      const x = hover.x;
      const y = hover.y - def.h + 1;
      const ok = Furniture.canPlace(r, tool.type, x, y);
      ctx.globalAlpha = 0.6;
      Furniture.drawObject(ctx, u, { type: tool.type, x, y }, { frame: 0, active: false, now: Date.now(), hour: 12 });
      ctx.globalAlpha = 1;
      ctx.fillStyle = ok ? 'rgba(124,196,127,0.35)' : 'rgba(224,64,90,0.4)';
      ctx.fillRect(x * T * u, y * T * u, def.w * T * u, def.h * T * u);
    } else if (tool) {
      ctx.fillStyle = 'rgba(255,224,102,0.35)';
      ctx.fillRect(hover.x * T * u, hover.y * T * u, T * u, T * u);
    } else {
      const i = objectAt(hover);
      if (i >= 0) {
        const o = r.objects[i];
        const def = Furniture.OBJECTS[o.type];
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 2 * DPR;
        ctx.strokeRect(o.x * T * u, o.y * T * u, def.w * T * u, def.h * T * u);
      }
    }
  };

  // ---- Toggle -------------------------------------------------------------------------

  btnEdit.addEventListener('click', () => {
    state.editing = !state.editing;
    if (!state.editing && tool?.moving) room().objects.push({ type: tool.type, ...tool.orig });
    tool = null;
    editorEl.classList.toggle('hidden', !state.editing);
    btnEdit.classList.toggle('on', state.editing);
    btnEdit.textContent = state.editing ? '✅ 完成' : '✏️ 編輯';
    if (!state.editing) save(true); else RoomApp.layout();
    refresh();
  });

  tabButtons.forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    tool = null;
    refresh();
  }));

  window.RoomEditor = { refresh };
})();
