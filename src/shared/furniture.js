// Room mode art: 16px floor/wall tiles and furniture, all drawn in code.
// Furniture coordinates are pixels relative to the footprint's top-left; negative y rises above it.
(function (root, factory) {
  root.Furniture = factory(root.Sprites);
})(typeof self !== 'undefined' ? self : this, (Sprites) => {
  const T = 16;
  const { PAL } = Sprites;

  // ---- Floors & walls --------------------------------------------------------

  const FLOORS = {
    wood: (r, x, y) => {
      r(0, 0, 16, 16, '#b07a48');
      for (let i = 0; i < 4; i++) {
        r(0, i * 4 + 3, 16, 1, '#9a6a3c');
        r(((i + y) % 2) * 8 + 3, i * 4, 1, 3, '#9a6a3c');
      }
      if ((x + y) % 3 === 0) r(10, 5, 2, 1, '#c08a58');
    },
    tile: (r, x, y) => {
      const a = '#e9e4da';
      const b = '#d6cfc2';
      r(0, 0, 8, 8, (x + y) % 2 ? a : b); r(8, 0, 8, 8, (x + y) % 2 ? b : a);
      r(0, 8, 8, 8, (x + y) % 2 ? b : a); r(8, 8, 8, 8, (x + y) % 2 ? a : b);
    },
    carpet: (r, x, y) => {
      r(0, 0, 16, 16, '#7a5aa0');
      r(((x + y) % 2) * 8 + 3, 3, 1, 1, '#9478bb'); r(((x + y + 1) % 2) * 8 + 4, 11, 1, 1, '#9478bb');
    },
    stone: (r, x, y) => {
      r(0, 0, 16, 16, '#737983');
      r(1, 1, 14, 6, '#8d939c'); r(1, 9, 6, 6, '#8d939c'); r(9, 9, 6, 6, '#868c95');
      if ((x * 7 + y) % 4 === 0) r(4, 3, 2, 1, '#9aa0a8');
    },
    marble: (r, x, y) => {
      r(0, 0, 16, 16, '#f2f2f4');
      r(0, 15, 16, 1, '#dcdfe5'); r(15, 0, 1, 16, '#dcdfe5');
      r(((x * 3 + y) % 10) + 2, 4, 4, 1, '#d8dbe2'); r(((x + y * 5) % 9) + 3, 10, 3, 1, '#d8dbe2');
    },
    grass: (r, x, y) => {
      r(0, 0, 16, 16, '#6db85a');
      r(((x * 5 + y * 3) % 12) + 1, 3, 1, 2, '#5aa84a'); r(((x * 3 + y * 7) % 12) + 2, 10, 1, 2, '#5aa84a'); r(((x + y) % 12) + 3, 7, 1, 1, '#ffe066');
    },
  };

  const WALLS = {
    cream: { base: '#f3e6cf', draw: (r, x) => { r(x % 2 ? 0 : 8, 0, 1, 32, '#ead9bc'); } },
    brick: { base: '#b5523b', draw: (r, x) => {
      for (let row = 0; row < 8; row++) {
        r(0, row * 4 + 3, 16, 1, '#8f3f2d');
        r(((row + x) % 2) * 8 + 4, row * 4, 1, 3, '#8f3f2d');
      }
    } },
    navy: { base: '#2f3e66', draw: (r, x) => { r(x % 2 ? 2 : 10, 0, 2, 32, '#36477a'); } },
    mint: { base: '#a8e0cf', draw: (r, x) => { r(0, 10, 16, 1, '#93d0bd'); r(x % 2 ? 4 : 12, 11, 1, 1, '#ffffff'); } },
  };

  // ---- Furniture -------------------------------------------------------------

  const side = (type, w, dy = 0) => [{ type, dx: -1, dy, facing: 1 }, { type, dx: w, dy, facing: -1 }];

  const OBJECTS = {
    desk: { w: 2, h: 1, stations: side('code', 2), draw: (g, s) => {
      g([[0, 0, 32, 6, '#b88452'], [0, 6, 32, 5, PAL.woodDark], [1, 11, 2, 5, PAL.woodDark], [29, 11, 2, 5, PAL.woodDark]], [[9, 1, 14, 2, '#c9ced8']]);
      g([[15, -4, 2, 4, '#3a3f4c']]);
      const lines = s.active ? [[12, -12, 5 + (s.frame % 3), 1, '#7cc47f'], [12, -10, 7, 1, PAL.screen], [13, -8, 4 + ((s.frame + 1) % 4), 1, '#ffd65a'], [12, -6, 6, 1, PAL.screen]] : [];
      g([[9, -15, 14, 11, '#2a2f3a']], [[10, -14, 12, 9, s.active ? '#16324a' : '#1b2030'], ...lines]);
    } },
    server: { w: 1, h: 1, stations: side('terminal', 1), draw: (g, s) => {
      const leds = [];
      for (let i = 0; i < 5; i++) {
        const on = s.active ? (s.frame + i) % 3 !== 0 : i % 2 === 0;
        leds.push([3, -14 + i * 5, 8, 3, '#3d4352'], [12, -13 + i * 5, 1, 1, on ? (i % 2 ? '#ffb347' : '#7cff8c') : '#2b2f3a']);
      }
      g([[1, -17, 14, 32, '#2b2f3a']], [[1, -17, 14, 1, '#4a5060'], ...leds]);
    } },
    bookshelf: { w: 2, h: 1, stations: [...side('read', 2), { type: 'read', dx: 0, dy: 1, facing: 1 }, { type: 'read', dx: 1, dy: 1, facing: -1 }], draw: (g) => {
      const books = [];
      const colors = ['#d9534f', '#5aa7ff', '#7cc47f', '#ffd65a', '#c27bff', '#f0a35e'];
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let i = 0; i < 7; i++) {
          const h = 6 + ((i * 7 + shelf * 3) % 3);
          books.push([3 + i * 4, -17 + shelf * 11 + (9 - h), 3, h, colors[(i + shelf * 2) % colors.length]]);
        }
        books.push([2, -8 + shelf * 11, 28, 2, PAL.woodDark]);
      }
      g([[0, -20, 32, 34, PAL.wood]], [[2, -18, 28, 30, '#5e3d22'], ...books]);
    } },
    globe: { w: 1, h: 1, stations: side('web', 1), draw: (g, s) => {
      g([[3, 12, 10, 3, PAL.woodDark], [7, 3, 2, 9, PAL.woodDark]]);
      const spin = s.active ? s.frame % 4 : 0;
      g([[3, -10, 10, 12, '#4a90d9'], [2, -9, 12, 10, '#4a90d9']], [[3 + spin, -7, 3, 3, '#7cc47f'], [8 - spin, -3, 4, 2, '#7cc47f'], [6, -9, 2, 1, '#ffffff']]);
      g([], [[1, -4, 1, 2, PAL.gold], [14, -6, 1, 2, PAL.gold]]);
    } },
    table: { w: 3, h: 2, stations: [
      { type: 'meeting', dx: -1, dy: 0, facing: 1 }, { type: 'meeting', dx: -1, dy: 1, facing: 1 },
      { type: 'meeting', dx: 3, dy: 0, facing: -1 }, { type: 'meeting', dx: 3, dy: 1, facing: -1 },
      { type: 'meeting', dx: 0, dy: 2, facing: 1 }, { type: 'meeting', dx: 2, dy: 2, facing: -1 },
    ], draw: (g) => {
      g([[0, 2, 48, 20, '#b88452'], [0, 22, 48, 5, PAL.woodDark], [2, 27, 3, 5, PAL.woodDark], [43, 27, 3, 5, PAL.woodDark]],
        [[8, 8, 4, 3, '#ffffff'], [9, 7, 2, 1, PAL.grip], [30, 12, 6, 4, PAL.page], [20, 6, 4, 3, '#ffffff']]);
    } },
    bell: { w: 2, h: 1, stations: side('wait', 2), draw: (g, s) => {
      g([[0, -4, 32, 20, '#c98b5a']], [[0, -4, 32, 3, '#e0a878'], [4, 2, 24, 1, '#a86f45'], [4, 8, 24, 1, '#a86f45']]);
      g([[13, -10, 6, 5, PAL.gold]], [[14, -9, 1, 1, PAL.shine]]);
      if (s.active && s.frame % 2) g([], [[10, -13, 1, 2, PAL.spark], [21, -13, 1, 2, PAL.spark], [15, -14, 2, 1, PAL.spark]]);
    } },
    sofa: { w: 2, h: 1, stations: [{ type: 'rest', dx: 0, dy: 1, facing: 1, seat: -10 }, { type: 'rest', dx: 1, dy: 1, facing: -1, seat: -10 }], draw: (g) => {
      g([[1, -10, 30, 12, '#5a7bd6'], [0, -2, 5, 16, '#4a68bd'], [27, -2, 5, 16, '#4a68bd'], [4, 2, 24, 10, '#6a8ae0']], [[5, 3, 22, 1, '#8aa6f0'], [15, -8, 1, 9, '#4a68bd']]);
    } },
    coffee: { w: 1, h: 1, stations: side('coffee', 1), draw: (g, s) => {
      g([[2, -12, 12, 26, '#444a56'], [1, -14, 14, 3, '#2f343e']], [[4, -9, 8, 5, '#2b2f3a'], [11, -11, 1, 1, '#ff5f5f'], [6, 1, 4, 4, '#ffffff'], [6, 1, 4, 1, PAL.grip]]);
      if (s.active) g([], [[7, -3 + (s.frame % 2), 1, 2, '#e6e9f0'], [9, -4 + ((s.frame + 1) % 2), 1, 2, '#e6e9f0']]);
    } },
    plant: { w: 1, h: 1, draw: (g) => {
      g([[2, -10, 12, 12, '#4f9a4f'], [5, -14, 6, 5, '#4f9a4f']], [[4, -8, 2, 2, '#6cc06c'], [9, -12, 2, 2, '#6cc06c'], [10, -4, 2, 2, '#3f7f3f']]);
      g([[4, 2, 8, 12, '#c46a3c']], [[4, 2, 8, 2, '#d98a5a']]);
    } },
    window: { w: 2, h: 2, wall: true, draw: (g, s) => {
      const night = s.hour < 6 || s.hour >= 18;
      g([[3, 4, 26, 22, '#ffffff']], [[5, 6, 22, 18, night ? '#1d2a4d' : '#9fd4ff'], [15, 6, 2, 18, '#ffffff'], [5, 14, 22, 2, '#ffffff'],
        ...(night ? [[8, 8, 1, 1, '#ffffff'], [22, 10, 1, 1, '#ffffff'], [11, 18, 1, 1, '#ffe066'], [21, 8, 3, 3, '#f5f0c8']] : [[7, 9, 6, 2, '#ffffff'], [20, 18, 5, 2, '#ffffff']])]);
    } },
    easel: { w: 1, h: 1, stations: side('art', 1), draw: (g, s) => {
      g([[3, -4, 1, 18, PAL.wood], [12, -4, 1, 18, PAL.wood], [7, -6, 2, 20, PAL.woodDark]]);
      g([[1, -14, 14, 12, PAL.page]], [[3, -12, 4, 2, '#e0405a'], [8, -9, 5, 2, '#5aa7ff'], [4, -6, 3 + (s.active ? s.frame % 3 : 0), 1, '#7cc47f']]);
    } },
    rug: { w: 3, h: 2, flat: true, draw: (g) => {
      g([[1, 2, 46, 28, '#c25b56']], [[4, 5, 40, 22, '#d9776f'], [8, 9, 32, 14, '#c25b56'], [14, 13, 20, 6, '#ffd08a']]);
    } },
    lamp: { w: 1, h: 1, draw: (g, s) => {
      const on = s.hour >= 17 || s.hour < 7;
      g([[7, -10, 2, 22, '#3a3f4c'], [4, 12, 8, 3, '#3a3f4c']]);
      g([[2, -18, 12, 8, on ? '#ffe9a8' : '#e6d8b8']], on ? [[3, -10, 10, 1, '#fff6d0']] : []);
    } },
    clock: { w: 1, h: 1, wall: true, draw: (g, s) => {
      const d = new Date(s.now);
      const dir = (v) => [[0, -4], [3, -3], [4, 0], [3, 3], [0, 4], [-3, 3], [-4, 0], [-3, -3]][Math.round(v * 8) % 8];
      const [mx, my] = dir(d.getMinutes() / 60);
      const [hx, hy] = dir((d.getHours() % 12) / 12);
      g([[3, 6, 10, 12, '#ffffff'], [2, 7, 12, 10, '#ffffff']], [[7, 11, 2, 2, PAL.line], [8 + mx, 12 + my, 1, 1, '#e0405a'], [8 + Math.round(hx / 2), 12 + Math.round(hy / 2), 1, 1, PAL.line], [8, 7, 1, 1, PAL.line]]);
    } },
    poster: { w: 1, h: 1, wall: true, draw: (g) => {
      g([[2, 4, 12, 16, '#ffd65a']], [[4, 6, 8, 6, '#5aa7ff'], [5, 14, 6, 1, PAL.line], [5, 16, 4, 1, PAL.line]]);
    } },
    whiteboard: { w: 2, h: 1, wall: true, draw: (g, s) => {
      const bars = s.meeting ? [[8, 14, 3, 4, '#5aa7ff'], [13, 11, 3, 7, '#7cc47f'], [18, 8, 3, 10, '#e0405a']] : [[7, 9, 10, 1, '#5aa7ff'], [7, 12, 14, 1, PAL.line], [7, 15, 8, 1, '#e0405a']];
      g([[2, 4, 28, 18, '#ffffff']], [[2, 21, 28, 1, '#c9ced8'], ...bars]);
    } },
    vending: { w: 1, h: 1, stations: side('coffee', 1), draw: (g, s) => {
      g([[1, -18, 14, 32, '#d9534f']], [[3, -15, 7, 20, '#2b2f3a'], [4, -13, 2, 2, '#5aa7ff'], [7, -13, 2, 2, '#7cc47f'], [4, -9, 2, 2, '#ffd65a'], [7, -9, 2, 2, '#c27bff'], [11, -12, 2, 4, '#ffd65a'], [3, 8, 8, 3, '#2b2f3a'], [11, -15, 2, 1, s.frame % 2 ? '#7cff8c' : '#2b2f3a']]);
    } },
    catbed: { w: 1, h: 1, draw: (g, s) => {
      g([[1, 4, 14, 10, '#8a6fb5']], [[3, 6, 10, 6, '#b49ad8']]);
      g([[4, 3, 8, 6, '#f0a35e']], [[5, 3, 2, 1, '#c97c3a'], [9, 3, 2, 1, '#c97c3a'], ...(s.frame % 4 === 0 ? [[10, 1, 1, 1, '#dfe6ff']] : [])]);
    } },
    arcade: { w: 1, h: 1, stations: side('game', 1), draw: (g, s) => {
      g([[1, -18, 14, 32, '#3d2f7a']], [[3, -15, 10, 9, s.active ? ['#ff5f87', '#5ef0ff', '#ffe066'][s.frame % 3] : '#1b1530'], [4, -3, 2, 2, '#e0405a'], [9, -3, 2, 2, '#5aa7ff'], [1, -18, 14, 2, '#ffe066']]);
    } },
    piano: { w: 2, h: 1, stations: side('music', 2), draw: (g, s) => {
      const keys = [];
      for (let i = 0; i < 7; i++) keys.push([3 + i * 4, -2, 3, 5, s.active && (s.frame + i) % 4 === 0 ? '#ffe066' : '#ffffff']);
      g([[1, -14, 30, 26, '#2b2b33']], [[2, -12, 28, 8, '#3a3a44'], ...keys, [3, 8, 2, 4, '#1b1b22'], [27, 8, 2, 4, '#1b1b22']]);
    } },
    aquarium: { w: 2, h: 1, draw: (g, s) => {
      const fx = (s.now / 200) % 22;
      g([[1, -14, 30, 18, '#5aa7ff'], [3, 4, 26, 10, '#3a3f4c']], [[2, -13, 28, 2, '#9fd4ff'], [3 + fx, -8, 4, 2, '#ff9a3c'], [24 - fx, -3, 3, 2, '#ffe066'], [6, -2, 1, 4, '#4f9a4f'], [22, -4, 1, 6, '#4f9a4f']]);
    } },
    trophy: { w: 1, h: 1, draw: (g) => {
      g([[1, -18, 14, 32, PAL.wood]], [[3, -16, 10, 26, '#5e3d22'], [6, -14, 4, 4, PAL.gold], [7, -10, 2, 2, PAL.gold], [4, -5, 3, 3, '#c0c6d0'], [9, -5, 3, 3, '#cd7f32'], [3, -2, 10, 1, PAL.woodDark]]);
    } },
    fireplace: { w: 2, h: 1, draw: (g, s) => {
      const f = s.frame % 2;
      g([[0, -20, 32, 34, '#8d939c']], [[0, -20, 32, 3, '#737983'], [6, -8, 20, 18, '#2b2f3a'], [9, 2 - f, 4, 6 + f, '#ff9a3c'], [14, 0 + f, 5, 8 - f, '#ffd65a'], [20, 3 - f, 3, 5 + f, '#ff5f3c']]);
    } },
    neon: { w: 2, h: 1, wall: true, draw: (g, s) => {
      const on = s.frame % 6 !== 0;
      const c = on ? '#ff5fc8' : '#7a3a66';
      g([], [[4, 8, 1, 7, c], [4, 8, 3, 1, c], [4, 14, 3, 1, c], [7, 9, 1, 5, c], [10, 8, 1, 7, c], [10, 8, 4, 1, c], [10, 11, 3, 1, c], [10, 14, 4, 1, c],
        [16, 8, 4, 1, c], [16, 8, 1, 4, c], [16, 11, 4, 1, c], [19, 11, 1, 4, c], [16, 14, 4, 1, c], [22, 8, 1, 7, c], [23, 11, 2, 1, c], [25, 8, 1, 3, c], [25, 12, 1, 3, c]]);
    } },
  };

  // ---- Rooms -----------------------------------------------------------------

  // A long office docked above the taskbar: 3 wall rows + floor rows, as wide as the screen.
  // Furniture is laid out in repeating zones so any width gets a sensible room.
  const ZONES = [
    { w: 9, objs: [['desk', 1, 0], ['desk', 5, 0], ['plant', 8, 0]], wall: [['window', 3]] },
    { w: 7, objs: [['server', 1, 0], ['server', 3, 0], ['server', 5, 0]], wall: [['clock', 3]] },
    { w: 8, objs: [['bookshelf', 1, 0], ['bookshelf', 4, 0], ['globe', 7, 2]], wall: [] },
    { w: 6, objs: [['table', 1, 2]], wall: [['whiteboard', 2]] },
    { w: 8, objs: [['coffee', 0, 0], ['rug', 2, 1], ['sofa', 2, 3], ['sofa', 5, 3], ['lamp', 7, 0]], wall: [['window', 3]] },
    { w: 4, objs: [['bell', 1, 0]], wall: [] },
    { w: 9, objs: [['desk', 1, 0], ['desk', 5, 0], ['plant', 8, 0]], wall: [['window', 3]] },
    { w: 9, objs: [['desk', 1, 0], ['desk', 5, 0], ['plant', 8, 0]], wall: [['window', 3]] },
  ];

  function generateRoom(w, h = 8) {
    const wallRows = 3;
    const room = { w, h, wallRows, wall: 'cream', floor: 'wood', tiles: {}, objects: [] };
    const floorRows = h - wallRows;
    let x = 0;
    let i = 0;
    while (x < w) {
      const zone = ZONES[i % ZONES.length];
      if (x + zone.w > w) break;
      for (const [type, dx, dy] of zone.objs) {
        if (dy + (OBJECTS[type].h) + (OBJECTS[type].stations?.some((s) => s.dy > 0) ? 1 : 0) > floorRows) continue;
        if (canPlace(room, type, x + dx, wallRows + dy)) room.objects.push({ type, x: x + dx, y: wallRows + dy });
      }
      for (const [type, dx] of zone.wall) {
        if (canPlace(room, type, x + dx, 1)) room.objects.push({ type, x: x + dx, y: 1 });
      }
      x += zone.w;
      i += 1;
    }
    return room;
  }

  // Resize a saved room to a new width, keeping whatever still fits.
  function fitRoom(room, w) {
    if (room.w === w) return room;
    const out = { ...room, w, objects: room.objects.filter((o) => o.x + (OBJECTS[o.type]?.w || 1) <= w) };
    out.tiles = Object.fromEntries(Object.entries(room.tiles || {}).filter(([k]) => Number(k.split(',')[0]) < w));
    return out;
  }

  const DEFAULT_ROOM = generateRoom(28, 8);

  function makeRect(ctx, unit, ox, oy) {
    return (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * unit, oy + y * unit, w * unit, h * unit);
    };
  }

  function drawFloorTile(ctx, unit, tx, ty, id, customTiles) {
    const ox = tx * T * unit;
    const oy = ty * T * unit;
    if (id && typeof id === 'object') {
      const tile = customTiles?.[id.file];
      if (tile?.img?.complete) {
        const cols = Math.max(1, Math.floor(tile.img.width / T));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tile.img, (id.i % cols) * T, Math.floor(id.i / cols) * T, T, T, ox, oy, T * unit, T * unit);
        return;
      }
      id = 'wood';
    }
    (FLOORS[id] || FLOORS.wood)(makeRect(ctx, unit, ox, oy), tx, ty);
  }

  function drawWall(ctx, unit, room) {
    const wall = WALLS[room.wall] || WALLS.cream;
    for (let x = 0; x < room.w; x++) {
      const r = makeRect(ctx, unit, x * T * unit, 0);
      r(0, 0, 16, room.wallRows * T, wall.base);
      wall.draw(r, x);
      r(0, 0, 16, 2, '#00000033');
      r(0, room.wallRows * T - 4, 16, 4, PAL.woodDark);
      r(0, room.wallRows * T - 4, 16, 1, '#9a6a3c');
    }
  }

  // Draws one object; returns nothing. `state` carries { frame, active, now, hour, meeting }.
  function drawObject(ctx, unit, obj, state) {
    const def = OBJECTS[obj.type];
    if (!def) return;
    const ox = obj.x * T * unit;
    const oy = obj.y * T * unit;
    const groups = [];
    def.draw((rects, details = []) => groups.push({ rects, details }), state);
    ctx.save();
    ctx.translate(ox, oy);
    Sprites.paint(ctx, unit, groups, 1, def.w * T);
    ctx.restore();
  }

  function footprint(obj) {
    const def = OBJECTS[obj.type];
    return def ? { x: obj.x, y: obj.y, w: def.w, h: def.h } : null;
  }

  // Grid of walkable floor tiles.
  function walkGrid(room) {
    const grid = [];
    for (let y = 0; y < room.h; y++) grid.push(Array.from({ length: room.w }, () => y >= room.wallRows));
    for (const obj of room.objects) {
      const def = OBJECTS[obj.type];
      if (!def || def.wall || def.flat) continue;
      for (let y = obj.y; y < obj.y + def.h; y++) for (let x = obj.x; x < obj.x + def.w; x++) if (grid[y]?.[x] !== undefined) grid[y][x] = false;
    }
    return grid;
  }

  function stationSpots(room) {
    const grid = walkGrid(room);
    const spots = [];
    room.objects.forEach((obj, index) => {
      for (const st of OBJECTS[obj.type]?.stations || []) {
        const x = obj.x + st.dx;
        const y = obj.y + st.dy;
        if (grid[y]?.[x]) spots.push({ type: st.type, x, y, facing: st.facing, seat: st.seat || 0, objIndex: index });
      }
    });
    return spots;
  }

  function canPlace(room, type, x, y, ignoreIndex = -1) {
    const def = OBJECTS[type];
    if (!def) return false;
    if (x < 0 || y < 0 || x + def.w > room.w || y + def.h > room.h) return false;
    if (def.wall ? y + def.h > room.wallRows : y < room.wallRows) return false;
    return room.objects.every((o, i) => {
      if (i === ignoreIndex) return true;
      const od = OBJECTS[o.type];
      if (!od || !!od.wall !== !!def.wall || !!od.flat !== !!def.flat) return true;
      return x + def.w <= o.x || o.x + od.w <= x || y + def.h <= o.y || o.y + od.h <= y;
    });
  }

  function preview(canvas) {
    const unit = 3;
    const room = DEFAULT_ROOM;
    const names = Object.keys(OBJECTS);
    canvas.width = 2300;
    canvas.height = room.h * T * unit + 260;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3b4a5a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWall(ctx, unit, room);
    for (let y = room.wallRows; y < room.h; y++) for (let x = 0; x < room.w; x++) drawFloorTile(ctx, unit, x, y, Object.keys(FLOORS)[(x >> 1) % 6]);
    const state = { frame: 1, active: true, now: Date.now(), hour: 20, meeting: true };
    [...room.objects].sort((a, b) => (a.y + (OBJECTS[a.type].h)) - (b.y + OBJECTS[b.type].h)).forEach((o) => drawObject(ctx, unit, o, state));
    let x = 0;
    names.forEach((n) => {
      const def = OBJECTS[n];
      ctx.save();
      ctx.translate(20 + x * unit, room.h * T * unit + 90 - (def.wall ? 20 : 0));
      drawObject(ctx, unit, { type: n, x: 0, y: 0 }, state);
      ctx.restore();
      x += def.w * T + 6;
    });
  }

  return { T, FLOORS, WALLS, OBJECTS, DEFAULT_ROOM, generateRoom, fitRoom, drawFloorTile, drawWall, drawObject, footprint, walkGrid, stationSpots, canPlace, preview };
});
