// Procedural pixel art. Characters live on a 32x28 logical grid (64x56 fine pixels), facing right.
// A drawing is a list of groups; each group's silhouette gets an edge in a darker shade of its own
// colours (no black outlines), then its details are drawn on top.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sprites = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  const W = 32;
  const H = 28;

  const PAL = {
    line: '#2b2233', // darkest ink for eyes and small marks; never pure black
    eye: '#2b2233',
    shine: '#ffffff',
    gold: '#e8b13a',
    belt: '#4a3424',
    wood: '#9c6b3c',
    woodDark: '#7a522c',
    grip: '#6b4423',
    steel: '#9aa3b2',
    steelDark: '#6d7685',
    page: '#fbf6e6',
    ink: '#cdbf9f',
    cover: '#8a4b2a',
    spark: '#ffd65a',
    blush: '#f5a3a3',
    screen: '#7ad1ff',
    skin: '#f6cfa6',
  };

  // Each skin: head shape, hat, torso, held item, colours.
  const SKINS = {
    commander: { head: 'helmet', body: 'armor', item: 'none', cape: true,
      c: { helmet: '#f1f1f4', helmetShade: '#c4c6d4', plume: '#3a3c48', plumeDark: '#26272f', body: '#2f313c', bodyShade: '#23242d', plate: '#444755', trim: '#9097a8',
        leg: '#34363f', boot: '#22232a', hand: '#3a3c47', cape: '#45464f', capeDark: '#2e2f37' } },
    office: { head: 'face', hat: 'hair', body: 'shirt', item: 'mug',
      c: { skin: PAL.skin, hair: '#3a2a20', body: '#f4f4f6', bodyShade: '#c9ccd6', leg: '#3b4256', boot: '#262a38', hand: PAL.skin } },
    scientist: { head: 'face', hat: 'messy', specs: true, body: 'labcoat', item: 'flask',
      c: { skin: PAL.skin, hair: '#d9d4cb', body: '#f5f7fb', bodyShade: '#c6ccd8', leg: '#4a4f63', boot: '#2e3140', hand: PAL.skin } },
    cat: { head: 'cat', body: 'fur', item: 'none', tail: true,
      c: { body: '#f0a35e', bodyShade: '#d0803e', belly: '#fbe3c4', leg: '#f0a35e', boot: '#d0803e', hand: '#fbe3c4' } },
    robot: { head: 'robot', body: 'metal', item: 'wrench',
      c: { head: '#b8c0cc', body: '#b8c0cc', bodyShade: '#8a93a3', leg: '#8a93a3', boot: '#5a6270', hand: '#8a93a3' } },
    ninja: { head: 'ninja', body: 'gi', item: 'kunai',
      c: { skin: PAL.skin, head: '#343a56', body: '#343a56', bodyShade: '#262a40', leg: '#343a56', boot: '#1c1f2e', hand: '#262a40' } },
    chef: { head: 'face', hat: 'chef', body: 'apron', item: 'ladle',
      c: { skin: PAL.skin, hair: '#6b4423', body: '#f7f7f7', bodyShade: '#cfd3dc', leg: '#3b4256', boot: '#262a38', hand: PAL.skin } },
    droid: { head: 'droid', body: 'mech', item: 'none', spikes: true,
      c: { head: '#34373f', headShade: '#25272e', body: '#34373f', bodyShade: '#25272e', plate: '#4a4e59', face: '#16171c', glow: '#d8f1ff',
        leg: '#2c2e36', boot: '#1b1c22', hand: '#4a4e59' } },
    platypus: { head: 'platypus', body: 'fur', item: 'none', tail: 'flat',
      c: { body: '#f4f2ee', bodyShade: '#d6d2cc', belly: '#ffffff', bill: '#9aa0aa', billDark: '#767c88', leg: '#f4f2ee', boot: '#9aa0aa', hand: '#ffffff' } },
    whitecat: { head: 'cat', body: 'fur', item: 'none', tail: true,
      c: { body: '#f3f1ec', bodyShade: '#d3cfc7', belly: '#ffffff', leg: '#f3f1ec', boot: '#d3cfc7', hand: '#ffffff' } },
    astronaut: { head: 'astronaut', body: 'suit', item: 'none', backpack: true,
      c: { head: '#f4f6fa', body: '#f4f6fa', bodyShade: '#c3c9d6', leg: '#e6e9f0', boot: '#8a93a6', hand: '#c3c9d6' } },
  };

  // ---- Detail grid -----------------------------------------------------------
  // Everything below is in fine pixels (RES per logical pixel): a character is 64x56.
  const RES = 2;
  const SH = 'rgba(40,20,60,0.2)';
  const SH2 = 'rgba(40,20,60,0.36)';
  const HL = 'rgba(255,255,255,0.3)';
  const HL2 = 'rgba(255,255,255,0.6)';
  const glow = (color) => `*${color}`;

  // Characters: g(rects, details, extraDetails, extraRects), everything in fine pixels.
  const fineGrouper = (groups) => (rects, details = [], extra = [], extraRects = []) => groups.push({ rects: [...rects, ...extraRects], details: [...details, ...extra] });
  // Furniture: rects/details in logical pixels (doubled), fine/fineRects already in fine pixels.
  const d2 = ([x, y, w, h, c]) => [x * RES, y * RES, w * RES, h * RES, c];
  const grouper = (groups) => (rects, details = [], fine = [], fineRects = []) => groups.push({
    rects: [...rects.map(d2), ...fineRects],
    details: [...details.map(d2), ...fine],
  });
  // A small four-point twinkle centred on fine (x, y).
  const twinkle = (x, y, color) => [[x, y - 1, 1, 3, color], [x - 1, y, 3, 1, color]];

  // Motion curves (fine pixels), after the hand-made walk and idle cycles we use in-house:
  // idle sinks one pixel on the out-breath; walking rises on the passing step, arms swing against
  // the legs, and loose bits (crest, cape) trail a frame behind.
  const BREATH = [0, 0, 1, 1, 1, 0, 0, 0];
  const WALK_ARM = [2, 0, -2, 0];
  const WALK_SWAY = [0, 1, 0, -1];
  const WALK_FLAP = [2, 3, 2, 1];

  // ---- Character -------------------------------------------------------------
  // Hand-placed pixel maps at the size of our in-house game sprites: a 28x36 box (fine pixels) with
  // a 24-wide head, about two heads tall. Every layer's outer pixels are re-coloured a deeper shade
  // of their own colour, so parts separate without black lines. The same art serves the taskbar
  // strip (with props) and the room (without).

  const BOX = { W: 28, H: 36 };

  // Lowercase letters are base colours; uppercase is the same colour in shadow (see `pal`).
  function layer(groups, rows, pal, ox, oy, edge = true) {
    const at = (x, y) => (y < 0 || y >= rows.length ? '.' : rows[y][x] || '.');
    const solid = (ch) => ch !== '.' && ch !== ' ' && pal[ch] !== undefined;
    const details = [];
    rows.forEach((row, y) => {
      let run = null;
      for (let x = 0; x <= row.length; x++) {
        const ch = at(x, y);
        let color = solid(ch) ? pal[ch] : null;
        if (color && edge && color[0] !== '*' && ![at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].every(solid)) color = shade(color);
        if (run && run.color === color) { run.w++; continue; }
        if (run && run.color) details.push([ox + run.x, oy + y, run.w, 1, run.color]);
        run = { x, w: 1, color };
      }
    });
    groups.push({ rects: [], details });
  }
  // {a: '#..'} -> {a: base, A: shadow}, plus any extra entries passed through.
  const pal = (base, extra = {}) => {
    const out = { ...extra };
    for (const [k, v] of Object.entries(base)) {
      out[k] = v;
      if (out[k.toUpperCase()] === undefined) out[k.toUpperCase()] = dark(v);
    }
    return out;
  };

  // --- Heads (24 wide), drawn at box (2, 0) unless noted.
  const FACE = [
    '....kkkkkkkkkkkkkkkk....',
    '..kkkkkkkkkkkkkkkkkkkk..',
    '.kkkkkkkkkkkkkkkkkkkkkk.',
    ...Array(12).fill('kkkkkkkkkkkkkkkkkkkkkkkk'),
    '.Kkkkkkkkkkkkkkkkkkkkkk.',
    '..KKkkkkkkkkkkkkkkkkkk..',
    '....KKKKKKKKKKKKKKKK....',
  ];
  // The knight's closed helm from the original: square top, notched chin, T visor, shine top-left, no eyes.
  const HELM = [
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWHHHHWWWWWWWWWWWWWWWW',
    'WWWWHHHHWWWWWWWWWWWWWWWW',
    'WWHHWWWWWWWWWWWWWWWWWWWW',
    'WWHHWWWWWWWWWWWWWWWWWWWW',
    'WWHHWWVVVVVVVVVVVVVVVVWW',
    'WWHHWWVVVVVVVVVVVVVVVVWW',
    'WWWWWWVVVVVVVVVVVVVVVVWW',
    'WWWWWWVVVVVVVVVVVVVVVVWW',
    ...Array(4).fill('WWWWWWWWWWWWVVVVWWWWWWWW'),
    ...Array(4).fill('SSWWWWWWWWWWVVVVWWWWWWWW'),
    '..SSSSSSSSSSVVVVSSSSSS..',
    '..SSSSSSSSSSVVVVSSSSSS..',
  ];
  const PLUME = [
    '......pppppppp',
    '......pppppppp',
    '..pppppppppppp',
    '..pppppppppppp',
    'PPPPPPPPPP....',
    'PPPPPPPPPP....',
    'PPPPPPPPPP....',
    'PPPPPPPPPP....',
  ];
  // Hair maps sit at box (1, -1): face columns are 1..24, the face's top row is row 2.
  const HAIR = {
    hair: [
      '........hhhhhhhhhh........',
      '.....hhhhhhhhhhhhhhhh.....',
      '...hhhhhh++++hhhhhhhhhh...',
      '..hhhhh++++hhhhhhhhhhhhh..',
      '.hhhhhhhhhhhhhhhhhhhhhhhh.',
      '.hhhhhhhhhhhhhhhhhhhhhhhhh',
      'hhhhhhhhhHhhhhhhhhhHhhhhhh',
      'hhhhhHHh.hhh....hhh..hhhh.',
      'hhhhH.....h..........hh...',
      'hhhH......................',
      '.hH.......................',
    ],
    messy: [
      '....h...hh.....h..........',
      '...hhh.hhhh...hhh...h.....',
      '..hhhhhhhhhhhhhhhhhhhh....',
      '.hhhh++++hhhhhhhhhhhhhh...',
      'hhhhhhhhhhhhhhhhhhhhhhhhh.',
      'hhhhhhhhhhhhhhhhhhhhhhhhhh',
      'hhhhhhHhhhhHhhhhhhHhhhhhhh',
      'hhhhhH..hhh......hh...hhhh',
      'hhhhH.................hhh.',
      'hhhH..................h...',
      'hhH.......................',
      '.h........................',
    ],
  };
  const CHEF_HAT = [
    '.....wwwww..wwwww.....',
    '...wwwwwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwwwwwwww.',
    '.wwwwwwwwwwwwwwwwwwwww',
    '.wwwWwwwwwWwwwwwWwwwww',
    '.wwwWwwwwwWwwwwwWwwww.',
    '..wwWwwwwwWwwwwwWwww..',
    '..wwwwwwwwwwwwwwwwww..',
    '..WWWWWWWWWWWWWWWWWW..',
    '..wwwwwwwwwwwwwwwwww..',
    '..wwwwwwwwwwwwwwwwww..',
    '..WWWWWWWWWWWWWWWWWW..',
  ];
  const ROBOT_HEAD = [
    '..aaaaaaaaaaaaaaaaaaaa..',
    '.a++aaaaaaaaaaaaaaaaaaa.',
    'aa+aaaaaaaaaaaaaaaaaaaaa',
    ...Array(11).fill('aaasssssssssssssssssssaa'),
    'aaaaaaaaaaaaaaaaaaaaaaaa',
    'AaaaaaaaaaaaaaaaaaaaaaaA',
    '.AAAAAAAAAAAAAAAAAAAAAA.',
  ];
  const DROID_HEAD = [
    '..aaaaaaaaaaaaaaaaaaaa..',
    '.aaaaaaaaaaaaaaaaaaaaaa.',
    'aa+++aaaaaaaaaaaaaaaaaaa',
    ...Array(9).fill('aaffffffffffffffffffffaa'),
    'AaaaaaaaaaaaaaaaaaaaaaaA',
    '.AAaffffffffffffffffaAA.',
    '..AaftfftfftfftfftfaAA..',
    '...AAaaaaaaaaaaaaaaAA...',
  ];
  const HORN = ['a..', 'aa.', 'aa.', 'aaa', 'aaa'];
  const ASTRO_HELMET = [
    '.....wwwwwwwwwwwwwwww.....',
    '...wwwwwwwwwwwwwwwwwwww...',
    '..ww+++wwwwwwwwwwwwwwwww..',
    '.ww+wwwwwwwwwwwwwwwwwwwww.',
    '.wwwwvvvvvvvvvvvvvvvvvwww.',
    ...Array(9).fill('wwwwvvvvvvvvvvvvvvvvvvvwww'),
    '.wwwwvvvvvvvvvvvvvvvvvwww.',
    '.Wwwwwwwwwwwwwwwwwwwwwwww.',
    '..WWwwwwwwwwwwwwwwwwwwWW..',
    '...WWWWWWWWWWWWWWWWWWWW...',
  ];
  const BILL = [
    '.bbbbbbb.',
    'bbbbbbbbb',
    'bbbbbbbbB',
    '.BBBBBBB.',
  ];
  const EAR_L = ['.a...', '.aa..', '.apa.', 'aappa'];
  const EAR_R = ['...a.', '..aa.', '.apa.', 'appaa'];

  // --- Torsos (16x12) at box (6, 19): narrow shoulders, round tummy and hips, like a small child.
  const TORSO_SHAPE = [
    '...xxxxxxxxxx...',
    '..xxxxxxxxxxxx..',
    '.xxxxxxxxxxxxxx.',
    ...Array(8).fill('xxxxxxxxxxxxxxxx'),
    '.xxxxxxxxxxxxxx.',
  ];
  // Outfit details as [x, y, w, h, letter] over a body of 'a'; the back three columns fall into shadow.
  const OUTFIT = {
    armor: [[4, 1, 9, 6, 'b'], [5, 2, 2, 1, '+'], [11, 2, 1, 5, 'B'], [4, 6, 9, 1, 'B'], [8, 2, 1, 4, 'B'], [0, 7, 16, 2, 'd'], [8, 7, 2, 2, 't'], [6, 9, 1, 3, 'A'], [11, 9, 1, 3, 'A']],
    shirt: [[8, 1, 2, 6, 'c'], [8, 6, 2, 1, 'C'], [5, 1, 2, 1, 'A'], [11, 1, 2, 1, 'A'], [0, 8, 16, 1, 'd'], [11, 8, 2, 1, 't'], [0, 9, 16, 3, 'l'], [8, 10, 1, 2, 'L']],
    labcoat: [[6, 1, 4, 8, 'c'], [6, 8, 4, 1, 'C'], [5, 2, 1, 10, 'A'], [10, 2, 1, 10, 'A'], [12, 4, 1, 3, 'p'], [6, 9, 4, 3, 'l']],
    fur: [[2, 1, 12, 1, 'c'], [7, 2, 2, 1, 'g'], [5, 3, 7, 7, 'b'], [4, 4, 9, 5, 'b']],
    metal: [[3, 2, 10, 4, 's'], [4, 3, 1, 1, 'x'], [6, 3, 1, 1, 'y'], [8, 3, 1, 1, 'z'], [3, 7, 10, 1, 'A'], [3, 9, 10, 1, 'A']],
    mech: [[3, 1, 10, 7, 'b'], [5, 2, 6, 5, 'f'], [6, 3, 4, 3, 'e'], [7, 4, 2, 1, 'E'], [2, 9, 12, 1, 'f'], [4, 10, 1, 1, 'f'], [8, 10, 1, 1, 'f'], [12, 10, 1, 1, 'f']],
    gi: [[5, 1, 1, 2, 'b'], [6, 2, 1, 2, 'b'], [7, 3, 2, 2, 'b'], [10, 1, 1, 2, 'b'], [9, 2, 1, 2, 'b'], [0, 7, 16, 2, 'c'], [10, 7, 2, 2, 'C'], [10, 9, 1, 3, 'C']],
    apron: [[4, 1, 1, 3, 'c'], [11, 1, 1, 3, 'c'], [3, 4, 10, 8, 'c'], [6, 6, 4, 2, 'C'], [3, 4, 10, 1, 'C']],
    suit: [[3, 3, 2, 2, 'c'], [7, 3, 5, 3, 's'], [8, 4, 1, 1, 'x'], [10, 4, 1, 1, 'y'], [0, 7, 16, 1, 't'], [6, 9, 1, 3, 'A']],
  };
  const torsoCache = new Map();
  function torsoRows(body) {
    if (torsoCache.has(body)) return torsoCache.get(body);
    const g = TORSO_SHAPE.map((r) => [...r].map((ch) => (ch === 'x' ? 'a' : '.')));
    for (const [x, y, w, h, ch] of OUTFIT[body] || OUTFIT.shirt) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j]?.[i] && g[j][i] !== '.') g[j][i] = ch;
    }
    for (const row of g) for (let i = 0; i < 3; i++) if (/[a-z]/.test(row[i])) row[i] = row[i].toUpperCase();
    const rows = g.map((r) => r.join(''));
    torsoCache.set(body, rows);
    return rows;
  }

  function buildBody(skinId, pose, step, col, opts, ox, oy) {
    const sk = SKINS[skinId] || SKINS.commander;
    const c = sk.c;
    const groups = [];
    const L = (rows, p, x, y, edge) => layer(groups, rows, p, ox + x, oy + y, edge);
    const t = ([x, y, w, h, color]) => [ox + x, oy + y, w, h, color];
    const g = (rects, details = []) => groups.push({ rects: rects.map(t), details: details.map(t) });
    const frame = step % 2;
    const sleeping = pose === 'sleep';

    let bob = 0;
    if (pose === 'rest') bob = BREATH[step % 8];
    if (pose === 'walk') bob = step % 2 ? -1 : 0;
    if (pose === 'read') bob = frame;
    if (pose === 'dance') bob = frame ? -1 : 1;
    if (sleeping) bob = 3;
    const sway = pose === 'walk' ? WALK_SWAY[step % 4] : pose === 'rest' ? BREATH[(step + 6) % 8] : 0;
    const B = bob;
    const armsUp = pose === 'done' || pose === 'dangle' || (pose === 'dance' && !frame);

    // --- Behind the body: cape, tail, backpack.
    if (sk.cape) {
      // Torn and ragged: the hem hangs in uneven strips that flutter out of step.
      const flap = pose === 'walk' ? WALK_FLAP[step % 4] : pose === 'dance' ? frame * 2 : sway;
      const x0 = 2 - flap;
      const strips = [[0, 2, 5], [2, 2, 2], [4, 2, 6], [6, 2, 3], [8, 1 + flap, 4]].map(([dx, w, h], i) => [x0 + dx, 29 + B, w, h + ((step + i) % 2), c.cape]);
      g([[4 - flap, 19 + B, 7 + flap, 10, c.cape], ...strips], [[4 - flap, 20 + B, 1, 9, c.capeDark], [x0 + 4, 24 + B, 1, 6, c.capeDark], [x0 + 2, 29 + B, 1, 2, c.capeDark], [x0 + 7, 27 + B, 1, 2, c.capeDark]]);
    }
    if (sk.tail === 'flat') g([[-1, 29, 9, 4, c.bodyShade]], [[0, 29, 7, 1, lite(c.bodyShade)], [2, 31, 1, 1, dark(c.bodyShade)], [5, 30, 1, 1, dark(c.bodyShade)]]);
    else if (sk.tail) {
      const tip = pose === 'walk' ? WALK_SWAY[step % 4] : frame;
      g([[1 + tip, 13 + B, 2, 4, c.body], [1, 16 + B, 2, 9, c.body], [2, 24 + B, 6, 2, c.body]], [[1 + tip, 13 + B, 2, 2, c.bodyShade], [1, 19 + B, 2, 1, c.bodyShade]]);
    }
    if (sk.backpack) g([[2, 20 + B, 6, 9, c.body]], [[2, 21 + B, 1, 7, c.bodyShade], [4, 23 + B, 2, 3, '#8a93a6'], [4, 24 + B, 1, 1, glow('#3dffb0')]]);

    // --- Back arm.
    const backSwing = pose === 'walk' ? -WALK_ARM[step % 4] : 0;
    if (armsUp) g([[0, 9, 3, 11, c.bodyShade], [-1, 5, 4, 4, dark(c.hand)]]);
    else g([[3 + backSwing, 20 + B, 3, 6, c.bodyShade], [2 + backSwing, 25 + B, 4, 4, dark(c.hand)]]);

    // --- Legs: back leg in shadow, walk is a 4-step cycle with the lifted foot on passing steps.
    const legPal = (back) => (back ? { l: dark(c.leg), L: dark(dark(c.leg)), s: dark(c.boot), S: dark(dark(c.boot)) } : { l: c.leg, L: dark(c.leg), s: c.boot, S: dark(c.boot) });
    const leg = (x, lift, back) => L([...Array(3 - lift).fill('llllL'), 'ssssss', 'SSSSSS'], legPal(back), x, 31);
    if (sleeping) {
      L(['llllllllllL', 'llllllllllLsss', 'LLLLLLLLLLLsss', '...........SSS'], legPal(false), 8, 32);
    } else if (pose === 'walk') {
      const [bx, bl, fx, fl] = [[6, 0, 16, 0], [9, 1, 13, 0], [15, 0, 7, 0], [12, 0, 10, 1]][step % 4];
      leg(bx, bl, true);
      leg(fx, fl, false);
    } else if (pose === 'dangle') {
      L(['llllL', 'llllL', 'llllL', 'sssss', 'SSSSS'], legPal(true), 8, 31);
      L(['llllL', 'llllL', 'llllL', 'sssss', 'SSSSS'], legPal(false), 15, 31);
    } else {
      leg(7, 0, true);
      leg(15, 0, false);
    }

    // --- Torso.
    const tp = {
      a: c.body, A: c.bodyShade, b: c.plate || c.belly || c.bodyShade, c: col.main, C: col.dark, t: c.trim || '#8a93a6', d: '#2a2b33',
      l: c.leg, L: dark(c.leg), g: PAL.gold, s: c.face || '#2c3442', e: glow(c.glow || PAL.screen), E: glow('#ffffff'),
      x: glow(sk.body === 'suit' ? '#3dffb0' : col.main), y: glow('#5ef0ff'), z: glow(PAL.spark), f: c.face || '#16171c', p: '#5aa7ff',
    };
    tp.B = dark(tp.b);
    tp['+'] = lite(tp.b);
    L(torsoRows(sk.body), tp, 6, 19 + B);

    // --- Head.
    const H = B;
    const eyeDots = (color = PAL.eye, at = [[11, 10], [20, 10]]) => at.map(([x, y]) => (sleeping ? [x - 1, y + 1 + H, 4, 1, color] : [x, y + H, 2, 2, color]));
    const blush = [[7, 12 + H, 3, 2, PAL.blush], [22, 12 + H, 3, 2, PAL.blush]];
    const face = (skin) => {
      L(FACE, { k: skin, K: dark(skin) }, 2, 1 + H);
      g([], [...eyeDots(), ...blush, [16, 13 + H, 2, 1, dark(dark(skin))]]);
    };
    switch (sk.head) {
      case 'helmet': {
        L(PLUME, { p: c.plume, P: c.plumeDark }, 6 - sway, -8 + H);
        L(HELM, { W: c.helmet, S: c.helmetShade, H: PAL.shine, V: PAL.line }, 2, H);
        break;
      }
      case 'face':
        face(c.skin);
        break;
      case 'cat': {
        const ear = { a: c.body, p: '#f6b8b8' };
        L(EAR_L, ear, 4, -3 + H);
        L(EAR_R, ear, 17, -3 + H);
        L(FACE, { k: c.body, K: c.bodyShade }, 2, 1 + H);
        g([], [
          [12, 2 + H, 1, 3, c.bodyShade], [14, 2 + H, 1, 4, c.bodyShade], [16, 2 + H, 1, 3, c.bodyShade],
          ...eyeDots('#3a3020'), [13, 12 + H, 7, 3, c.belly], [15, 12 + H, 2, 1, '#e07a7a'], [14, 14 + H, 1, 1, '#b07050'], [17, 14 + H, 1, 1, '#b07050'],
          [7, 12 + H, 3, 2, PAL.blush], [25, 11 + H, 3, 1, '#a08a78'], [25, 13 + H, 3, 1, '#a08a78'],
        ]);
        break;
      }
      case 'platypus':
        L(FACE, { k: c.body, K: c.bodyShade }, 2, 1 + H);
        // Happy closed eyes, little arches.
        g([], [...[[10, 9], [18, 9]].flatMap(([x, y]) => [[x - 1, y + 1 + H, 1, 1, PAL.eye], [x, y + H, 2, 1, PAL.eye], [x + 2, y + 1 + H, 1, 1, PAL.eye]]),
          [6, 11 + H, 3, 2, PAL.blush], [5, 3 + H, 6, 1, lite(c.body)]]);
        L(BILL, { b: c.bill, B: c.billDark }, 19, 10 + H);
        g([], [[21, 10 + H, 5, 1, lite(c.bill)], [24, 11 + H, 1, 1, c.billDark], [26, 11 + H, 1, 1, c.billDark]]);
        break;
      case 'robot':
        g([[14, -4 + H, 2, 4, c.bodyShade]], []);
        g([[13, -7 + H, 4, 3, col.main]], [[14, -6 + H, 2, 1, glow(col.main)]]);
        L(ROBOT_HEAD, { a: c.head, A: c.bodyShade, s: '#1b2b3a', '+': lite(c.head) }, 2, H);
        g([[0, 7 + H, 2, 4, c.bodyShade]], [...eyeDots(glow('#5ef0ff'), [[11, 8], [20, 8]]), [15, 12 + H, 3, 1, 'rgba(94,240,255,0.55)']]);
        break;
      case 'droid': {
        const E = glow(c.glow);
        L(HORN, { a: c.plate }, 4, -5 + H);
        L(HORN.map((r) => [...r].reverse().join('')), { a: c.plate }, 21, -5 + H);
        L(DROID_HEAD, { a: c.head, A: c.headShade, f: c.face, t: '#c9ced8', '+': lite(c.head) }, 2, -1 + H);
        g([], sleeping
          ? [[7, 7 + H, 5, 1, '#5a6070'], [17, 7 + H, 5, 1, '#5a6070']]
          : [[6, 4 + H, 3, 1, E], [8, 5 + H, 3, 1, E], [10, 6 + H, 2, 1, E], [17, 6 + H, 2, 1, E], [18, 5 + H, 3, 1, E], [20, 4 + H, 3, 1, E], [4, -5 + H, 1, 1, E], [23, -5 + H, 1, 1, E]]);
        break;
      }
      case 'ninja': {
        const tail = frame ? [[-3, 6 + H, 6, 2], [-5, 9 + H, 5, 2]] : [[-3, 5 + H, 6, 2], [-4, 8 + H, 5, 2]];
        g(tail.map((r) => [...r, col.main]), []);
        L(FACE, { k: c.head, K: c.bodyShade }, 2, 1 + H);
        g([[6, 7 + H, 19, 6, c.skin]], [...eyeDots(), [22, 11 + H, 2, 1, PAL.blush], [2, 4 + H, 24, 2, col.main], [2, 4 + H, 24, 1, lite(col.main)]]);
        break;
      }
      case 'astronaut':
        L(ASTRO_HELMET, { w: c.head, W: c.bodyShade, v: '#2a3b66', '+': PAL.shine }, 1, -1 + H);
        g([], [...eyeDots('#dfe8ff'), [6, 4 + H, 4, 1, '#6a84c0'], [5, 5 + H, 1, 3, '#6a84c0'], [0, 7 + H, 1, 3, glow('#3dffb0')], [8, 12 + H, 3, 1, 'rgba(245,163,163,0.6)']]);
        break;
    }
    // Hair and hats over the face.
    const hairPal = (color) => ({ h: color, H: dark(color), '+': lite(color) });
    if (sk.hat === 'hair' || sk.hat === 'chef') L(HAIR.hair, hairPal(c.hair), 1, -1 + H);
    if (sk.hat === 'messy') L(HAIR.messy, hairPal(c.hair), 1, -1 + H);
    if (sk.hat === 'chef') L(CHEF_HAT, { w: '#ffffff', W: '#d9dde6' }, 3, -10 + H);
    if (sk.specs) g([], glassesAt(H, '#6a5040'));

    // --- Front arm and whatever it holds.
    const arm = (sleeve, hand) => g([[...sleeve, c.body], [...hand, c.hand]], [[sleeve[0], sleeve[1], 1, sleeve[3], lite(c.body)]]);
    const sparks = (pts) => g([], pts.flatMap(([x, y, color]) => twinkle(x, y, color)));
    const note = (x, y, color) => g([], [[x, y, 1, 6, color], [x + 1, y, 2, 1, color], [x + 2, y + 1, 1, 1, color], [x - 3, y + 5, 3, 2, color]]);
    switch (pose) {
      case 'done':
        arm([24, 9, 3, 11], [24, 5, 4, 4]);
        sparks(frame ? [[16, -10, PAL.shine], [26, -6, PAL.spark], [-2, -2, PAL.spark], [28, -12, PAL.spark]]
          : [[18, -6, PAL.spark], [27, -11, PAL.shine], [0, -9, PAL.spark], [-3, 0, PAL.shine]]);
        break;
      case 'dangle':
        arm([24, 9, 3, 11], [24, 5, 4, 4]);
        break;
      case 'wait':
        arm([24, 11, 3, 9], [24 + frame, 7, 4, 4]);
        g([], frame ? [[30, 7, 2, 1, HL2], [30, 11, 2, 1, HL2]] : [[22, 7, 2, 1, HL2], [22, 11, 2, 1, HL2]]);
        break;
      case 'type': case 'command': case 'paint':
        arm([20, 21 + B, 6, 3], [25, 20 + B + (pose === 'type' ? frame : pose === 'command' ? -frame * 2 : 0), 4, 4]);
        break;
      case 'game':
        arm([20, 22 + B, 3, 3], [19, 25 + B, 4, 3]);
        g([[13, 24 + B, 13, 5, '#3a3f4c'], [13, 28 + B, 3, 3, '#3a3f4c'], [23, 28 + B, 3, 3, '#3a3f4c']], [[15, 26 + B, 3, 1, '#c9ced8'], [16, 25 + B, 1, 3, '#c9ced8'], [21, 25 + B, 2, 2, '#5aa7ff'], [23, 27 + B, 2, 2, '#ffd65a'], [13, 24 + B, 13, 1, HL], [18, 26 + B - frame, 3, 2, c.hand]]);
        break;
      case 'read': {
        arm([20, 22 + B, 3, 4], [19, 26 + B, 4, 3]);
        const lines = [];
        for (let i = 0; i < 4; i++) {
          lines.push([15, 23 + i * 2 + B, i === 3 ? 2 : 4, 1, PAL.ink]);
          if (i !== (frame ? 1 : 3)) lines.push([21, 23 + i * 2 + B, i === 3 ? 2 : 4, 1, PAL.ink]);
        }
        g([[13, 21 + B, 14, 10, PAL.cover]], [[14, 22 + B, 5, 8, PAL.page], [21, 22 + B, 5, 8, PAL.page], [19, 22 + B, 2, 8, SH2], ...lines, [13, 21 + B, 14, 1, HL]]);
        break;
      }
      case 'dance':
        if (frame) arm([24, 9, 3, 11], [24, 5, 4, 4]); else arm([21, 20 + B, 3, 6], [21, 25 + B, 4, 4]);
        note(frame ? 27 : -2, frame ? -8 : -10, col.main);
        break;
      case 'sleep':
        arm([21, 21 + B, 3, 4], [21, 25 + B, 4, 3]);
        break;
      default: { // rest / walk, holding the signature item
        const sw = pose === 'walk' ? WALK_ARM[step % 4] : 0;
        const hx = 21 + (sk.item === 'none' ? sw : 0);
        const y = B;
        switch (sk.item) {
          case 'mug':
            g([[23, 23 + y, 5, 5, '#ffffff'], [28, 24 + y, 1, 3, '#ffffff']], [[23, 23 + y, 5, 1, '#8a5a30'], [23, 26 + y, 5, 1, col.main], [27, 24 + y, 1, 4, '#d9dde6']]);
            if (frame) g([], [[24, 19 + y, 1, 2, '#e6e9f0'], [26, 18 + y, 1, 2, '#e6e9f0']]);
            break;
          case 'flask':
            g([[24, 18 + y, 2, 3, '#dceff8'], [23, 21 + y, 4, 2, '#dceff8'], [22, 23 + y, 6, 4, '#dceff8']], [[23, 23 + y, 4, 4, '#3dffb0'], [23, 23 + y, 1, 1, HL2], [25, 16 + y - frame, 1, 1, PAL.shine]]);
            break;
          case 'wrench':
            g([[24, 15 + y, 2, 11, PAL.steel], [23, 13 + y, 4, 3, PAL.steel]], [[24, 13 + y, 2, 1, '#5a6270'], [24, 16 + y, 1, 9, HL2]]);
            break;
          case 'kunai':
            g([[24, 18 + y, 1, 7, '#c9d1dc'], [24, 25 + y, 1, 3, PAL.grip]], [[24, 19 + y, 1, 4, HL2]]);
            break;
          case 'ladle':
            g([[24, 13 + y, 1, 13, PAL.steel], [23, 11 + y, 3, 3, PAL.steel]], [[23, 11 + y, 1, 1, HL2]]);
            break;
        }
        arm([hx, 20 + B, 3, 6], [hx, 25 + B, 4, 4]);
      }
    }
    if (sk.body === 'armor') g([[19, 19 + B, 6, 3, c.plate]], [[19, 19 + B, 6, 1, lite(c.plate)], [19, 21 + B, 6, 1, c.trim]]);
    if (sk.spikes) g([[19, 19 + B, 6, 3, c.plate], [21, 16 + B, 2, 3, c.plate]], [[19, 21 + B, 6, 1, c.face]]);

    // --- Accessory on top of everything.
    const A = H;
    switch (opts.accessory) {
      case 'partyhat':
        g([[13, -9 + A, 2, 2, col.main], [12, -7 + A, 4, 3, col.main], [11, -4 + A, 6, 3, col.main], [10, -1 + A, 8, 2, col.main]], [[11, -3 + A, 6, 1, '#ffffff'], [12, -6 + A, 4, 1, '#ffffff'], [13, -11 + A, 2, 2, '#ffe066']]);
        break;
      case 'flower':
        g([[21, 0 + A, 5, 5, '#ff8fb1']], [[22, 1 + A, 3, 3, '#ffe066'], [21, 0 + A, 1, 1, HL2]], []);
        g([[19, 3 + A, 3, 2, '#5aa85a']]);
        break;
      case 'glasses':
        g([], glassesAt(A, PAL.line, true));
        break;
      case 'sunglasses':
        g([], [[9, 9 + A, 6, 4, '#1c1c26'], [18, 9 + A, 6, 4, '#1c1c26'], [15, 10 + A, 3, 1, '#1c1c26'], [3, 10 + A, 6, 1, '#1c1c26'], [10, 10 + A, 2, 1, '#6a6a7a'], [19, 10 + A, 1, 1, '#6a6a7a']]);
        break;
      case 'headphones':
        g([[4, -2 + A, 18, 2, '#3a3a46']], [[6, -2 + A, 14, 1, HL]]);
        g([[1, 6 + A, 5, 8, col.main]], [[1, 6 + A, 1, 8, col.dark], [4, 8 + A, 1, 4, HL2]]);
        break;
      case 'halo':
        g([], [[8, -6 + A, 12, 1, glow('#ffe066')], [6, -5 + A, 2, 1, glow('#ffe066')], [20, -5 + A, 2, 1, glow('#ffe066')], [8, -4 + A, 12, 1, glow('#ffe066')]]);
        break;
      case 'bow':
        g([[17, -2 + A, 4, 4, '#ff6fa8'], [23, -2 + A, 4, 4, '#ff6fa8'], [21, -1 + A, 2, 2, '#e0508a']], [[18, -1 + A, 1, 1, HL2]]);
        break;
      case 'vr':
        g([[2, 9 + A, 8, 3, '#3a3d4c']]);
        g([[9, 7 + A, 17, 6, '#2b2d3a']], [[10, 9 + A, 15, 2, glow('#36f9ff')], [9, 7 + A, 17, 1, HL], [24, 8 + A, 1, 1, glow('#ff3ea5')]]);
        break;
    }
    return groups;
  }

  // Round frames around the bean eyes at (11, 10) and (20, 10).
  function glassesAt(A, color, tint) {
    const ring = (x) => [[x - 2, 8 + A, 6, 1, color], [x - 2, 13 + A, 6, 1, color], [x - 2, 8 + A, 1, 6, color], [x + 3, 8 + A, 1, 6, color],
      ...(tint ? [[x - 1, 9 + A, 4, 4, 'rgba(191,227,255,0.35)'], [x - 1, 9 + A, 1, 1, PAL.shine]] : [[x - 1, 9 + A, 1, 1, HL2]])];
    return [...ring(11), ...ring(20), [15, 10 + A, 3, 1, color], [3, 10 + A, 6, 1, color]];
  }

  // Full-size character: the body box sits at the bottom-left of a 64x56 canvas with room for props.
  const OX = 15;
  const OY = 18;
  function buildCharacter(skinId, pose, frame, col, opts = {}) {
    const prop = opts.prop !== false;
    const groups = [];
    const g = fineGrouper(groups);
    const f = frame % 2;
    // Props behind the body, in canvas fine pixels.
    if (pose === 'type' && prop) {
      g([[37, 42, 20, 4, PAL.wood], [39, 46, 2, 8, PAL.woodDark], [53, 46, 2, 8, PAL.woodDark]], [[37, 42, 20, 1, HL], [37, 45, 20, 1, SH], [43, 43, 6, 1, 'rgba(60,30,10,0.18)']]);
      const keys = [];
      for (let i = 0; i < 6; i++) keys.push([42 + i * 2, 40, 1, 1, (i + f) % 4 ? '#8a91a3' : PAL.shine]);
      g([[41, 40, 14, 2, '#c9ced8'], [51, 28, 4, 12, '#3a3f4c']], [...keys, [52, 30, 2, 8, glow(PAL.screen)], [52, 31 + f * 3, 2, 1, PAL.shine]]);
    }
    if (pose === 'command' && prop) {
      // A retro terminal on a little cart.
      g([[47, 42, 4, 12, '#4a4f5e'], [42, 52, 14, 2, '#4a4f5e']], [[47, 42, 1, 12, HL]]);
      const blink = f ? glow('#3dffb0') : '#0d2a1a';
      g([[42, 26, 16, 14, '#d6cfb8'], [40, 40, 16, 2, '#bdb59c']], [
        [44, 28, 12, 9, '#0d2a1a'], [45, 29, 6, 1, glow('#3dffb0')], [45, 31, 4, 1, glow('#3dffb0')], [45, 33, 8, 1, glow('#3dffb0')], [45, 35, 2, 1, glow('#3dffb0')], [48, 35, 1, 1, blink],
        [42, 26, 16, 1, HL], [56, 28, 2, 12, SH], [42, 40, 14, 1, SH],
      ]);
    }
    if (pose === 'paint' && prop) {
      g([[46, 24, 2, 30, PAL.wood], [56, 24, 2, 30, PAL.wood]], [[47, 24, 1, 30, SH]]);
      g([[42, 18, 18, 18, PAL.page]], [
        [46, 22, 6, 2, col.main], [48, 26, 8, 2, '#5aa7ff'], [44, 30, 4, 2, '#7cc47f'], [50, 30, 2, 1, '#ffd65a'],
        ...(f ? [[52, 22, 4, 4, PAL.spark]] : [[44, 24, 2, 4, '#e0405a']]), [42, 34, 18, 2, SH],
      ]);
    }
    groups.push(...buildBody(skinId, pose, frame, col, opts, OX, OY));
    if (pose === 'paint') g([[43, 37, 6, 2, PAL.wood]], [[47, 37 - f * 2, 2, 2, col.main]]);
    if (pose === 'command' && prop && f) g([], [...twinkle(44, 38, PAL.spark), ...twinkle(48, 36, PAL.shine)]);
    return groups;
  }

  // ---- Mini characters (room mode) -------------------------------------------
  // The same art without props; the grid has headroom for plumes and hats.
  const MINI = { W: 14, H: 23, anchor: 7, feet: 23 };
  const MINI_OY = MINI.H * RES - BOX.H;

  function buildMini(skinId, pose, frame, col, opts = {}) {
    return buildBody(skinId, pose, frame, col, opts, 0, MINI_OY);
  }

  function drawMiniAt(ctx, unit, x, y, skin, pose, frame, col, facing, opts) {
    ctx.save();
    ctx.translate(x, y);
    paint(ctx, unit, buildMini(skin, pose, frame, col, opts), facing, MINI.W);
    ctx.restore();
  }

  // ---- Effects ---------------------------------------------------------------

  const FX = {
    // A literal bug, scurrying in when a tool fails.
    bug: { w: 16, h: 16, build: (frame) => {
      const legs = [];
      for (let i = 0; i < 3; i++) {
        const y = 16 + i * 4 + (frame + i) % 2;
        legs.push([3, y, 4, 1, '#3a2a40'], [25, y + ((i + 1) % 2) - (frame % 2), 4, 1, '#3a2a40']);
      }
      return [
        { rects: [], details: [...legs, [11, 3 - frame, 1, 4, '#3a2a40'], [20, 3 - frame, 1, 4, '#3a2a40']] },
        { rects: [[10, 1 - frame, 3, 2, '#e0405a'], [19, 1 - frame, 3, 2, '#e0405a']], details: [] },
        { rects: [[8, 12, 16, 16, '#e0405a'], [6, 14, 20, 12, '#e0405a'], [7, 13, 18, 14, '#e0405a']], details: [[15, 13, 2, 14, '#a8283e'], [10, 17, 3, 3, '#3a2a40'], [20, 19, 3, 3, '#3a2a40'], [11, 22, 2, 2, '#3a2a40'], [19, 24, 2, 2, '#3a2a40'], [9, 14, 4, 1, HL2]] },
        { rects: [[10, 6, 12, 7, '#3a2a40'], [9, 7, 14, 5, '#3a2a40']], details: [[12, 8, 2, 3, '#ffffff'], [18, 8, 2, 3, '#ffffff'], [11, 7, 4, 1, HL]] },
      ];
    } },
    // A delivery box that drops after a long turn; frame 1 is open.
    chest: { w: 16, h: 12, build: (open) => [
      { rects: [[4, 8, 24, 15, '#c8925a']], details: [[4, 8, 24, 2, '#a87444'], [14, 8, 4, 15, '#e8d9a0'], [6, 13, 6, 5, '#ffffff'], [7, 14, 4, 1, '#9aa3b5'], [7, 16, 3, 1, '#9aa3b5'], [26, 10, 2, 13, SH], [4, 22, 24, 1, SH2]] },
      open
        ? { rects: [[0, 2, 10, 6, '#d9a670'], [22, 2, 10, 6, '#d9a670']], details: [[6, 7, 20, 2, '#7a5230'], [10, 4, 4, 3, glow('#ffd23f')], [17, 3, 3, 3, glow('#ffd23f')], [22, 6, 2, 2, PAL.shine], [12, 1, 1, 1, PAL.shine], [0, 2, 10, 1, HL], [22, 2, 10, 1, HL]] }
        : { rects: [[3, 4, 26, 5, '#d9a670']], details: [[3, 4, 26, 1, HL], [14, 4, 4, 5, '#f0e4b8'], [3, 8, 26, 1, SH]] },
    ] },
    // A little UFO crossing the sky when the context gets compacted.
    ufo: { w: 32, h: 16, build: (frame) => {
      const lights = [];
      for (let i = 0; i < 6; i++) lights.push([12 + i * 8, 19, 3, 2, glow((i + frame) % 2 ? '#ffe066' : '#ff3ea5')]);
      return [
        ...(frame ? [{ rects: [], details: [[24, 23, 16, 3, 'rgba(160,255,220,0.35)'], [22, 26, 20, 3, 'rgba(160,255,220,0.25)'], [20, 29, 24, 3, 'rgba(160,255,220,0.15)']] }] : []),
        { rects: [[22, 4, 20, 10, '#bff2ff'], [20, 7, 24, 7, '#bff2ff']], details: [[28, 8, 8, 6, '#7cc47f'], [29, 10, 2, 2, PAL.eye], [33, 10, 2, 2, PAL.eye], [23, 5, 6, 1, PAL.shine], [22, 6, 1, 3, PAL.shine]] },
        { rects: [[12, 13, 40, 4, '#b8c0cc'], [6, 16, 52, 6, '#b8c0cc'], [16, 22, 32, 2, '#8a93a6']], details: [[12, 13, 40, 1, HL2], [6, 21, 52, 1, SH2], ...lights] },
      ];
    } },
    butterfly: { w: 8, h: 6, build: (frame) => [
      { rects: frame ? [[0, 2, 6, 6, '#ff8fb1'], [10, 2, 6, 6, '#ff8fb1']] : [[2, 0, 4, 4, '#ff8fb1'], [10, 0, 4, 4, '#ff8fb1']], details: frame ? [[1, 3, 2, 2, HL2], [11, 3, 2, 2, HL2]] : [[3, 1, 1, 1, HL2], [11, 1, 1, 1, HL2]] },
      { rects: [[6, 2, 4, 8, '#5a4a3a']], details: [[6, 0, 1, 2, '#5a4a3a'], [9, 0, 1, 2, '#5a4a3a']] },
    ] },
    heart: { w: 8, h: 7, build: () => [
      { rects: [[2, 2, 4, 4, '#ff5f87'], [10, 2, 4, 4, '#ff5f87'], [2, 4, 12, 4, '#ff5f87'], [4, 8, 8, 2, '#ff5f87'], [6, 10, 4, 2, '#ff5f87'], [3, 1, 4, 1, '#ff5f87'], [11, 1, 4, 1, '#ff5f87']],
        details: [[4, 3, 2, 2, PAL.shine], [10, 8, 2, 2, '#e04570']] },
    ] },
  };

  // ---- Edge shading ------------------------------------------------------------
  // Each silhouette is edged with a darker, slightly cooler and more saturated version of its own
  // colour, the way the 2D sprites in hand-made pixel art are: no black lines anywhere.
  const shadeCache = new Map();
  function parseColor(c) {
    let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (m) {
      const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /^hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i.exec(c);
    if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return [40, 30, 50];
  }
  function hslToRgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  function shade(color) {
    const key = color;
    if (shadeCache.has(key)) return shadeCache.get(key);
    const [r, g, b] = parseColor(color[0] === '*' ? color.slice(1) : color).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    // Drift the hue toward violet-blue, darken, and keep some colour in the dark.
    const toward = 255;
    const diff = ((toward - h + 540) % 360) - 180;
    const nh = (h + Math.sign(diff) * Math.min(Math.abs(diff), 10) + 360) % 360;
    const ns = Math.min(1, s * 0.7 + 0.06);
    const nl = Math.max(0.09, l * 0.48);
    const [R, G, B] = hslToRgb(nh, ns, nl).map((v) => Math.round(v));
    const out = `rgb(${R}, ${G}, ${B})`;
    shadeCache.set(key, out);
    return out;
  }

  // Softer steps for shading inside a part: a cooler mid shadow and a warmer light.
  function tone(color, toward, maxShift, sF, lF) {
    const key = `${color}|${toward}|${sF}|${lF}`;
    if (shadeCache.has(key)) return shadeCache.get(key);
    const [r, g, b] = parseColor(color).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const diff = ((toward - h + 540) % 360) - 180;
    const nh = (h + Math.sign(diff) * Math.min(Math.abs(diff), maxShift) + 360) % 360;
    const [R, G, B] = hslToRgb(nh, Math.min(1, sF(s)), Math.min(1, lF(l))).map((v) => Math.round(v));
    const out = `rgb(${R}, ${G}, ${B})`;
    shadeCache.set(key, out);
    return out;
  }
  const darkS = (s) => s * 0.9 + 0.05;
  const darkL = (l) => l * 0.76;
  const liteS = (s) => s * 0.95;
  const liteL = (l) => l + (1 - l) * 0.3;
  const dark = (color) => tone(color, 255, 8, darkS, darkL);
  const lite = (color) => tone(color, 55, 8, liteS, liteL);

  // ---- Drawing ---------------------------------------------------------------

  // `unit` is device pixels per logical pixel; groups are in fine pixels (RES per logical pixel).
  // Each rect is edged one fine pixel wide in a darker shade of its own colour (all edges first, then
  // fills, so seams inside a group vanish). Colours starting with '*' glow. `remap` lets room themes
  // recolour furniture without redrawing it. `width` is in logical pixels (for mirroring).
  function paint(ctx, unit, groups, facing, width, remap) {
    ctx.save();
    if (facing < 0) ctx.setTransform(-1, 0, 0, 1, width * unit + ctx.getTransform().e, ctx.getTransform().f);
    const f = unit / RES;
    const o = Math.max(1, Math.round(f));
    const px = (v) => Math.round(v * f);
    const fill = (x, y, w, h, color) => {
      let c = remap ? remap(color) : color;
      const lit = c[0] === '*';
      if (lit) {
        c = c.slice(1);
        ctx.shadowColor = c;
        ctx.shadowBlur = unit * 2;
      }
      ctx.fillStyle = c;
      ctx.fillRect(px(x), px(y), px(x + w) - px(x), px(y + h) - px(y));
      if (lit) ctx.shadowBlur = 0;
    };
    for (const { rects, details } of groups) {
      for (const [x, y, w, h, color] of rects) {
        ctx.fillStyle = shade(remap ? remap(color) : color);
        ctx.fillRect(px(x) - o, px(y) - o, px(x + w) - px(x) + 2 * o, px(y + h) - px(y) + 2 * o);
      }
      for (const [x, y, w, h, color] of rects) fill(x, y, w, h, color);
      for (const [x, y, w, h, color] of details) fill(x, y, w, h, color);
    }
    ctx.restore();
  }

  // Draw a character onto a dedicated canvas (clears it first).
  function drawCharacter(ctx, unit, skin, pose, frame, col, facing, opts) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    paint(ctx, unit, buildCharacter(skin, pose, frame, col, opts), facing, W);
  }

  // Draw a character at an offset on a shared canvas (room mode). (x, y) is the sprite's top-left in pixels.
  function drawCharacterAt(ctx, unit, x, y, skin, pose, frame, col, facing, opts) {
    ctx.save();
    ctx.translate(x, y);
    paint(ctx, unit, buildCharacter(skin, pose, frame, col, opts), facing, W);
    ctx.restore();
  }

  function drawFx(ctx, unit, kind, frame, facing = 1) {
    const fx = FX[kind];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    paint(ctx, unit, fx.build(frame), facing, fx.w);
  }

  function drawFxAt(ctx, unit, x, y, kind, frame, facing = 1) {
    ctx.save();
    ctx.translate(x, y);
    paint(ctx, unit, FX[kind].build(frame), facing, FX[kind].w);
    ctx.restore();
  }

  // ---- Custom sprite sheets (Aseprite JSON export) ---------------------------

  const POSE_FALLBACK = {
    rest: ['idle', 'rest'], walk: ['walk', 'idle'], type: ['type', 'work', 'idle'], command: ['command', 'hammer', 'work', 'idle'], game: ['game', 'work', 'idle'],
    read: ['read', 'work', 'idle'], paint: ['paint', 'work', 'idle'], wait: ['wait', 'idle'], done: ['done', 'idle'],
    sleep: ['sleep', 'idle'], dangle: ['dangle', 'idle'], dance: ['dance', 'idle'],
  };

  function parseSheet(json) {
    const frames = Array.isArray(json.frames) ? json.frames : Object.values(json.frames || {});
    const list = frames.map((f) => ({ ...f.frame, duration: f.duration || 120 }));
    const tags = {};
    for (const t of json.meta?.frameTags || []) tags[t.name.toLowerCase()] = [t.from, t.to];
    return { frames: list, tags };
  }

  // Draws the frame for `pose` at time `now`, bottom-centred in a W x H sprite box.
  function drawCustomAt(ctx, unit, x, y, sheet, pose, now, facing) {
    if (!sheet?.img?.complete || !sheet.frames.length) return;
    const tag = (POSE_FALLBACK[pose] || ['idle']).map((n) => sheet.tags[n]).find(Boolean) || [0, 0];
    const [from, to] = tag;
    const span = sheet.frames.slice(from, to + 1);
    const total = span.reduce((s, f) => s + f.duration, 0) || 1;
    let t = now % total;
    let f = span[0];
    for (const fr of span) {
      if (t < fr.duration) { f = fr; break; }
      t -= fr.duration;
    }
    const dw = f.w * unit;
    const dh = f.h * unit;
    const dx = x + (W * unit - dw) / 2;
    const dy = y + H * unit - dh;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facing < 0) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, 0, 0, dw, dh);
    } else {
      ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // FNV-1a with a final avalanche, so ids that differ by one character still get far-apart hues.
  // Accepts a hue number directly, or any id string to hash.
  function colorsFor(id) {
    if (typeof id === 'number') return { main: `hsl(${id}, 65%, 55%)`, dark: `hsl(${id}, 60%, 38%)` };
    let h = 0x811c9dc5;
    for (const ch of String(id)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    const hue = (h >>> 0) % 360;
    return { main: `hsl(${hue}, 65%, 55%)`, dark: `hsl(${hue}, 60%, 38%)` };
  }

  return {
    W, H, RES, PAL, SKINS, FX, MINI, grouper, shade,
    buildCharacter, buildMini, drawMiniAt, drawCharacter, drawCharacterAt, drawFx, drawFxAt, paint,
    parseSheet, drawCustomAt, colorsFor,
  };
});
