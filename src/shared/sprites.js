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
    // Jimmy: the closed white helm on a plain white body, and a red cape.
    commander: { head: 'helmet', body: 'plain', item: 'none', cape: true,
      c: { helmet: '#f4f4f7', helmetShade: '#c9cbd8', body: '#f4f4f7', bodyShade: '#d3d5df', trim: '#c3c6ce',
        leg: '#eef0f4', boot: '#c9cbd8', hand: '#f4f4f7', cape: '#b8323a', capeDark: '#86202c', capeLite: '#d9535b' } },
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
    // Bru: a fluffy white plush with a round head as tall as it is wide, a broad flat bill, happy
    // closed eyes, and a checked blanket hugged to its tummy.
    platypus: { head: 'plush', body: 'blanket', item: 'none', tail: 'flat', mitts: true, torsoAt: [5, 21],
      c: { body: '#f6f4f0', bodyShade: '#d8d3cc', belly: '#ffffff', bill: '#f8f6f2', leg: '#f6f4f0', boot: '#ebe7e1', hand: '#ffffff' } },
    // Okai: a short, round white cat with bean eyes, a bead of sweat and a little crescent moon.
    whitecat: { head: 'okai', body: 'chubby', item: 'none', tail: true, drop: 4, torsoAt: [4, 23],
      c: { body: '#f6f4f0', bodyShade: '#d6d1ca', belly: '#ffffff', leg: '#f6f4f0', boot: '#d6d1ca', hand: '#ffffff' } },
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
  // Bru's head: round, as tall as it is wide (24x23 at box (2, -1)).
  const PLUSH_HEAD = [
    '.......kkkkkkkkkk.......',
    '....kkkkkkkkkkkkkkkk....',
    '...kkkkkkkkkkkkkkkkkk...',
    '..kkkkkkkkkkkkkkkkkkkk..',
    '.kkkkkkkkkkkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkkkkkkkkkkk.',
    ...Array(11).fill('kkkkkkkkkkkkkkkkkkkkkkkk'),
    '.kkkkkkkkkkkkkkkkkkkkkk.',
    '.Kkkkkkkkkkkkkkkkkkkkkk.',
    '..KKkkkkkkkkkkkkkkkkkK..',
    '...KKKkkkkkkkkkkkkkKK...',
    '....KKKKkkkkkkkkkKKK....',
    '.......KKKKKKKKKK.......',
  ];
  // A broad, flat duck bill.
  const PLUSH_BILL = [
    '..bbbbbbbbb.',
    '.bbbbbbbbbbb',
    'bbbbbbbbbbbb',
    'bBbbbbbbbbbB',
    '.BBBBBBBBBB.',
  ];
  // Okai's head: wide and round, all white, shaded at the sides (26x19 at box (1, 1)).
  const OKAI_HEAD = [
    '.......kkkkkkkkkkkk.......',
    '....kkkkkkkkkkkkkkkkkk....',
    '..hhkkkkkkkkkkkkkkkkkkhh..',
    '.hhhhkkkkkkkkkkkkkkkkkhhh.',
    '.hhhhkkkkkkkkkkkkkkkkkkhh.',
    'hhhhhkkkkkkkkkkkkkkkkkkhhh',
    'hhhhkkkkkkkkkkkkkkkkkkkhhh',
    ...Array(6).fill('hhhhkkkkkkkkkkkkkkkkkkkkhh'),
    'hhhhhkkkkkkkkkkkkkkkkkkhhh',
    'Hhhhhkkkkkkkkkkkkkkkkkkhhh',
    '.Hhhhhkkkkkkkkkkkkkkkkhhh.',
    '.HHhhh.KKkkkkkkkkkkKK.hhh.',
    '..HHhh..KKKKKKKKKKKK..hh..',
    '...HH..................h..',
  ];
  const EAR_L = ['.a...', '.aa..', '.apa.', 'aappa'];
  const EAR_R = ['...a.', '..aa.', '.apa.', 'appaa'];

  // --- Torsos (18x13) at box (5, 19): a pear like a small child - narrow shoulders widening to
  // big round hips that sit right on short legs.
  const TORSO_SHAPE = [
    '....xxxxxxxxxx....',
    '...xxxxxxxxxxxx...',
    '...xxxxxxxxxxxx...',
    '..xxxxxxxxxxxxxx..',
    '..xxxxxxxxxxxxxx..',
    '.xxxxxxxxxxxxxxxx.',
    '.xxxxxxxxxxxxxxxx.',
    ...Array(5).fill('xxxxxxxxxxxxxxxxxx'),
    '.xxxxxxxxxxxxxxxx.',
  ];
  // Outfit details as [x, y, w, h, letter] on a 16x12 grid over a body of 'a' (moved into the wider
  // torso, with anything that reaches the hem stretched to the new bottom row); the back three
  // pixels of each row fall into shadow.
  const OUTFIT = {
    plain: [[3, 0, 10, 1, 'r'], [12, 1, 1, 1, 'g']],
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
  // Outfits drawn whole on the 18x13 torso, shape included.
  const OUTFIT_FULL = {
    // Bru's round little body with a red-and-yellow checked blanket hugged in front (18x11).
    blanket: [
      '...aaaaaaaaaaaa...',
      '..aaaaaaaaaaaaaa..',
      '.AAaaaaaaaaaaaaaa.',
      '.AAaaccqqccqqccaa.',
      'AAAaaccqqccqqccaaa',
      'AAAqqccqqccqqccqqa',
      'AAAccqqccqqccqqcca',
      'AAAccqqccqqccqqcca',
      'AAAqqccqqccqqccqqa',
      '.AAaqqccqqccqqccq.',
      '..AAAaaaaaaaaaaa..',
    ],
    // Okai's short, chubby body: a collar with a bell, a round white tummy (20x10).
    chubby: [
      '....aaaaaaaaaaaa....',
      '..AAAcccccccccccaa..',
      '.AAAaaaaaaagaaaaaaa.',
      'AAAaaaaabbbbbbbaaaaa',
      'AAAaaaabbbbbbbbbaaaa',
      'AAAaaaabbbbbbbbbaaaa',
      'AAAaaaaabbbbbbbaaaaa',
      '.AAAaaaaaaaaaaaaaaa.',
      '..AAAaaaaaaaaaaaaa..',
    ],
    // Steel plate over black cloth: a mail collar under the helm, broad pauldrons, a ridged
    // breastplate, a buckled belt and a ragged skirt.
    armor: [
      '....dddddddddd....',
      '...dddddddddddd...',
      '...ddd+bbbbbdddd..',
      '++++db+bbbbbBd++++',
      'bbbbtb+bbbbbbtbbbb',
      'BBBBtb+bbbbbbtBBBB',
      '.tttabbbbbbbbBattt',
      'dddddddttddddddddd',
      'aaaaaaaaaaaaaaaaaa',
      'aaaaAaaaaaaaaAaaaa',
      'aaaaAaaaaaaaaAaaaa',
      'aAaaaaaAaaaaaaAaaa',
      '.aaaa.aaaaaa.aaaa.',
    ],
  };
  const torsoCache = new Map();
  function torsoRows(body) {
    if (torsoCache.has(body)) return torsoCache.get(body);
    const g = (OUTFIT_FULL[body] || TORSO_SHAPE).map((r) => [...r].map((ch) => (OUTFIT_FULL[body] ? ch : ch === 'x' ? 'a' : '.')));
    for (const [x0, y, w0, h0, ch] of OUTFIT_FULL[body] ? [] : OUTFIT[body] || OUTFIT.shirt) {
      // Full-width bands (belts, trousers) stay full width; the rest shifts to the centre.
      const [x, w] = x0 === 0 && w0 === 16 ? [0, 18] : [x0 + 1, w0];
      const h = y + h0 >= 12 ? h0 + 1 : h0;
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j]?.[i] && g[j][i] !== '.') g[j][i] = ch;
    }
    for (const row of g) {
      const first = row.findIndex((ch) => ch !== '.');
      for (let i = first; i < first + 3; i++) if (/[a-z]/.test(row[i])) row[i] = row[i].toUpperCase();
    }
    const rows = g.map((r) => r.join(''));
    torsoCache.set(body, rows);
    return rows;
  }

  // Props and effects. No arms: a head on a body with two legs, props float in front of it.
  function poseProps(g, pose, frame, col, B) {
  const sparks = (pts) => g([], pts.flatMap(([x, y, color]) => twinkle(x, y, color)));
  const note = (x, y, color) => g([], [[x, y, 1, 6, color], [x + 1, y, 2, 1, color], [x + 2, y + 1, 1, 1, color], [x - 3, y + 5, 3, 2, color]]);
  switch (pose) {
    case 'done':
      sparks(frame ? [[16, -10, PAL.shine], [26, -6, PAL.spark], [-2, -2, PAL.spark], [28, -12, PAL.spark]]
        : [[18, -6, PAL.spark], [27, -11, PAL.shine], [0, -9, PAL.spark], [-3, 0, PAL.shine]]);
      break;
    case 'wait':
      g([], frame ? [[30, 7, 2, 1, HL2], [30, 11, 2, 1, HL2]] : [[22, 7, 2, 1, HL2], [22, 11, 2, 1, HL2]]);
      break;
    case 'game':
      g([[13, 24 + B, 13, 5, '#3a3f4c'], [13, 28 + B, 3, 3, '#3a3f4c'], [23, 28 + B, 3, 3, '#3a3f4c']], [[15, 26 + B, 3, 1, '#c9ced8'], [16, 25 + B, 1, 3, '#c9ced8'], [21, 25 + B, 2, 2, '#5aa7ff'], [23, 27 + B, 2, 2, '#ffd65a'], [13, 24 + B, 13, 1, HL], [18, 26 + B - frame, 3, 2, '#e0405a']]);
      break;
    case 'read': {
      const lines = [];
      for (let i = 0; i < 4; i++) {
        lines.push([15, 23 + i * 2 + B, i === 3 ? 2 : 4, 1, PAL.ink]);
        if (i !== (frame ? 1 : 3)) lines.push([21, 23 + i * 2 + B, i === 3 ? 2 : 4, 1, PAL.ink]);
      }
      g([[13, 21 + B, 14, 10, PAL.cover]], [[14, 22 + B, 5, 8, PAL.page], [21, 22 + B, 5, 8, PAL.page], [19, 22 + B, 2, 8, SH2], ...lines, [13, 21 + B, 14, 1, HL]]);
      break;
    }
    case 'dance':
      note(frame ? 27 : -2, frame ? -8 : -10, col.main);
      break;
    default:
      break;
  }
  }

  function buildBody(skinId, pose, step, col, opts, ox, oy) {
    if (DRAWN[skinId]) return drawnBody(DRAWN[skinId], pose, step, col, ox, oy);
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

    // --- Behind the body: cape, tail, backpack.
    if (sk.cape) {
      // A full cape from the shoulders to the ankles: it swings out behind on the walk and its hem
      // ripples a frame behind the body.
      const flap = pose === 'walk' ? WALK_FLAP[step % 4] : pose === 'dance' ? frame * 2 : sway;
      const x0 = 3 - flap;
      const wave = (i) => ((step + i) % 3 === 0 ? 1 : 0);
      const hem = [0, 2, 4, 6].map((dx, i) => [x0 + dx - 1, 33 + B, 2, 1 + wave(i), c.cape]);
      if (!sleeping) {
        g([[6, 19 + B, 6, 3, c.cape], [x0 + 1, 21 + B, 9 + flap, 6, c.cape], [x0, 26 + B, 9 + flap, 7, c.cape], ...hem],
          [[x0, 27 + B, 1, 6, c.capeDark], [x0 + 3, 24 + B, 1, 9, c.capeDark], [x0 + 6, 25 + B, 1, 8, c.capeDark],
            [x0 + 4, 23 + B, 1, 9, c.capeLite], [7, 19 + B, 4, 1, c.capeLite]]);
      }
    }
    if (sk.tail === 'flat') g([[-1, 29, 9, 4, c.bodyShade]], [[0, 29, 7, 1, lite(c.bodyShade)], [2, 31, 1, 1, dark(c.bodyShade)], [5, 30, 1, 1, dark(c.bodyShade)]]);
    else if (sk.tail) {
      const tip = pose === 'walk' ? WALK_SWAY[step % 4] : frame;
      const td = sk.drop || 0;
      g([[1 + tip, 13 + B + td, 2, 4, c.body], [1, 16 + B + td, 2, 9 - td, c.body], [2, 24 + B, 6, 2, c.body]], [[1 + tip, 13 + B + td, 2, 2, c.bodyShade], [1, 19 + B + td, 2, 1, c.bodyShade]]);
    }
    if (sk.backpack) g([[2, 20 + B, 6, 9, c.body]], [[2, 21 + B, 1, 7, c.bodyShade], [4, 23 + B, 2, 3, '#8a93a6'], [4, 24 + B, 1, 1, glow('#3dffb0')]]);


    // --- Legs: back leg in shadow, walk is a 4-step cycle with the lifted foot on passing steps.
    const legPal = (back) => (back ? { l: dark(c.leg), L: dark(dark(c.leg)), s: dark(c.boot), S: dark(dark(c.boot)) } : { l: c.leg, L: dark(c.leg), s: c.boot, S: dark(c.boot) });
    const leg = (x, lift, back) => L([...Array(2 - lift).fill('llllL'), 'ssssss', 'SSSSSS'], legPal(back), x, 32);
    if (sleeping) {
      L(['llllllllL', 'llllllllLsss', 'LLLLLLLLLsss', '.........SSS'], legPal(false), 9, 32);
    } else if (pose === 'walk') {
      const [bx, bl, fx, fl] = [[5, 0, 17, 0], [8, 1, 14, 0], [16, 0, 6, 0], [13, 0, 9, 1]][step % 4];
      leg(bx, bl, true);
      leg(fx, fl, false);
    } else if (pose === 'dangle') {
      L(['llllL', 'llllL', 'sssss', 'SSSSS'], legPal(true), 7, 32);
      L(['llllL', 'llllL', 'sssss', 'SSSSS'], legPal(false), 16, 32);
    } else {
      leg(6, 0, true);
      leg(16, 0, false);
    }

    // --- Torso.
    const tp = {
      a: c.body, A: c.bodyShade, b: c.plate || c.belly || c.bodyShade, c: col.main, C: col.dark, t: c.trim || '#8a93a6', d: '#2a2b33',
      l: c.leg, L: dark(c.leg), g: PAL.gold, s: c.face || '#2c3442', e: glow(c.glow || PAL.screen), E: glow('#ffffff'),
      x: glow(sk.body === 'suit' ? '#3dffb0' : col.main), y: glow('#5ef0ff'), z: glow(PAL.spark), f: c.face || '#16171c', p: '#5aa7ff',
    };
    tp.r = c.cape || col.main;
    tp.R = dark(tp.r);
    tp.B = dark(tp.b);
    tp.T = dark(tp.t);
    tp.D = dark(tp.d);
    tp['+'] = lite(tp.b);
    tp.q = '#f2c64a';
    tp.Q = dark(tp.q);
    // Bru's blanket is always red and yellow, whatever the session's colour.
    if (sk.body === 'blanket') {
      tp.c = '#d8402e';
      tp.C = dark(tp.c);
    }
    const [tx, ty] = sk.torsoAt || [5, 19];
    L(torsoRows(sk.body), tp, tx, ty + B);
    // Bru's white mitts, hugging the blanket when its hands are free.
    if (sk.mitts && !['type', 'read', 'game', 'paint', 'command'].includes(pose)) {
      const mitt = ['.mmmm.', 'mmmmmm', 'mmmmmm', 'mmmmmm', '.mmmm.'];
      L(mitt, { m: c.hand }, 8, 22 + B);
      L(mitt, { m: c.hand }, 15, 22 + B);
      g([], [[10, 23 + B, 1, 2, c.bodyShade], [12, 23 + B, 1, 2, c.bodyShade], [17, 23 + B, 1, 2, c.bodyShade], [19, 23 + B, 1, 2, c.bodyShade]]);
    }

    // --- Head.
    const H = B + (sk.drop || 0);
    const eyeDots = (color = PAL.eye, at = [[8, 12], [22, 12]]) => at.map(([x, y]) => (sleeping ? [x - 1, y + 1 + H, 4, 1, color] : [x, y + H, 2, 2, color]));
    const blush = [[5, 14 + H, 3, 2, PAL.blush], [23, 14 + H, 2, 2, PAL.blush]];
    const face = (skin) => {
      L(FACE, { k: skin, K: dark(skin) }, 2, 1 + H);
      g([], [...eyeDots(), ...blush, [15, 15 + H, 2, 1, dark(dark(skin))]]);
    };
    switch (sk.head) {
      case 'helmet': {
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
          ...eyeDots('#3a3020'), [12, 13 + H, 7, 3, c.belly], [14, 13 + H, 2, 1, '#e07a7a'], [13, 15 + H, 1, 1, '#b07050'], [16, 15 + H, 1, 1, '#b07050'],
          [5, 14 + H, 3, 2, PAL.blush], [25, 11 + H, 3, 1, '#a08a78'], [25, 13 + H, 3, 1, '#a08a78'],
        ]);
        break;
      }
      case 'plush': {
        L(PLUSH_HEAD, { k: c.body, K: c.bodyShade }, 2, -1 + H);
        // Happy closed eyes (soft arches), striped pink cheeks, a fluffy shine up top.
        const arch = ([x, y]) => (sleeping
          ? [[x, y + 1 + H, 4, 1, PAL.eye]]
          : [[x, y + 1 + H, 1, 2, PAL.eye], [x + 1, y + H, 2, 1, PAL.eye], [x + 3, y + 1 + H, 1, 2, PAL.eye]]);
        g([], [...arch([5, 10]), ...arch([15, 10]),
          [4, 13 + H, 4, 2, PAL.blush], [14, 13 + H, 3, 2, PAL.blush], [5, 13 + H, 1, 2, '#e88a8a'], [15, 13 + H, 1, 2, '#e88a8a'],
          [6, 1 + H, 6, 1, PAL.shine], [5, 2 + H, 2, 1, PAL.shine]]);
        L(PLUSH_BILL, { b: c.bill, B: c.bodyShade }, 17, 12 + H);
        g([], [[19, 14 + H, 9, 1, '#d2ccc4'], [25, 13 + H, 1, 1, '#c2bbb2'], [27, 13 + H, 1, 1, '#c2bbb2'], [20, 12 + H, 6, 1, PAL.shine]]);
        break;
      }
      case 'okai': {
        const ear = { a: c.body, p: '#f4c4c4' };
        L(['.a....', '.aa...', '.aaa..', '.apaa.', 'aappaa'], ear, 3, -4 + H);
        L(['....a.', '...aa.', '..aaa.', '.aapa.', 'aappaa'], ear, 18, -4 + H);
        L(OKAI_HEAD, { k: c.body, K: c.bodyShade, h: c.body, H: c.bodyShade }, 1, 1 + H);
        // Bean eyes like everyone else's, a bead of sweat, a small open mouth, a crescent moon.
        const lid = '#3a2a36';
        g([], [...eyeDots(PAL.eye, [[7, 11], [22, 11]]),
          [14, 13 + H, 3, 1, lid], [14, 14 + H, 1, 1, lid], [16, 14 + H, 1, 1, lid], [15, 14 + H, 1, 1, '#f08a6a'], [15, 15 + H, 1, 1, lid],
          [6, 3 + H, 1, 1, '#7cc0ee'], [6, 4 + H, 2, 1, '#8fcdf5'], [5, 5 + H, 4, 2, '#8fcdf5'], [6, 7 + H, 2, 1, '#6fb2e0'], [6, 5 + H, 1, 1, PAL.shine],
          [6, 13 + H, 2, 1, 'rgba(245,163,163,0.7)'], [22, 13 + H, 2, 1, 'rgba(245,163,163,0.7)']]);
        g([], [[23, 15 + H, 2, 1, '#ffd84a'], [22, 16 + H, 2, 2, '#ffd84a'], [23, 18 + H, 2, 1, '#ffd84a'], [22, 16 + H, 1, 1, '#fff2a8'], [24, 18 + H, 1, 1, '#d9a62a']]);
        break;
      }
      case 'robot':
        g([[14, -4 + H, 2, 4, c.bodyShade]], []);
        g([[13, -7 + H, 4, 3, col.main]], [[14, -6 + H, 2, 1, glow(col.main)]]);
        L(ROBOT_HEAD, { a: c.head, A: c.bodyShade, s: '#1b2b3a', '+': lite(c.head) }, 2, H);
        g([[0, 7 + H, 2, 4, c.bodyShade]], [...eyeDots(glow('#5ef0ff'), [[9, 10], [21, 10]]), [14, 13 + H, 3, 1, 'rgba(94,240,255,0.55)']]);
        break;
      case 'droid': {
        const E = glow(c.glow);
        L(HORN, { a: c.plate }, 4, -5 + H);
        L(HORN.map((r) => [...r].reverse().join('')), { a: c.plate }, 21, -5 + H);
        L(DROID_HEAD, { a: c.head, A: c.headShade, f: c.face, t: '#c9ced8', '+': lite(c.head) }, 2, -1 + H);
        g([], sleeping
          ? [[5, 9 + H, 5, 1, '#5a6070'], [19, 9 + H, 5, 1, '#5a6070']]
          : [[4, 6 + H, 3, 1, E], [6, 7 + H, 3, 1, E], [8, 8 + H, 2, 1, E], [19, 8 + H, 2, 1, E], [20, 7 + H, 3, 1, E], [21, 6 + H, 3, 1, E], [4, -5 + H, 1, 1, E], [23, -5 + H, 1, 1, E]]);
        break;
      }
      case 'ninja': {
        const tail = frame ? [[-3, 6 + H, 6, 2], [-5, 9 + H, 5, 2]] : [[-3, 5 + H, 6, 2], [-4, 8 + H, 5, 2]];
        g(tail.map((r) => [...r, col.main]), []);
        L(FACE, { k: c.head, K: c.bodyShade }, 2, 1 + H);
        g([[4, 9 + H, 22, 6, c.skin]], [...eyeDots(), [22, 14 + H, 2, 1, PAL.blush], [2, 4 + H, 24, 2, col.main], [2, 4 + H, 24, 1, lite(col.main)]]);
        break;
      }
      case 'astronaut':
        L(ASTRO_HELMET, { w: c.head, W: c.bodyShade, v: '#2a3b66', '+': PAL.shine }, 1, -1 + H);
        g([], [...eyeDots('#dfe8ff', [[8, 11], [21, 11]]), [6, 4 + H, 4, 1, '#6a84c0'], [5, 5 + H, 1, 3, '#6a84c0'], [0, 7 + H, 1, 3, glow('#3dffb0')], [6, 13 + H, 3, 1, 'rgba(245,163,163,0.6)']]);
        break;
    }
    // Hair and hats over the face.
    const hairPal = (color) => ({ h: color, H: dark(color), '+': lite(color) });
    if (sk.hat === 'hair' || sk.hat === 'chef') L(HAIR.hair, hairPal(c.hair), 1, -1 + H);
    if (sk.hat === 'messy') L(HAIR.messy, hairPal(c.hair), 1, -1 + H);
    if (sk.hat === 'chef') L(CHEF_HAT, { w: '#ffffff', W: '#d9dde6' }, 3, -10 + H);
    if (sk.specs) g([], glassesAt(H, '#6a5040'));

    poseProps(g, pose, frame, col, B);

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
        g([], [[5, 11 + A, 7, 4, '#1c1c26'], [19, 11 + A, 7, 4, '#1c1c26'], [12, 12 + A, 7, 1, '#1c1c26'], [2, 12 + A, 3, 1, '#1c1c26'], [6, 12 + A, 2, 1, '#6a6a7a'], [20, 12 + A, 1, 1, '#6a6a7a']]);
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
        g([[1, 11 + A, 6, 3, '#3a3d4c']]);
        g([[4, 9 + A, 23, 7, '#2b2d3a']], [[5, 11 + A, 21, 3, glow('#36f9ff')], [4, 9 + A, 23, 1, HL], [25, 10 + A, 1, 1, glow('#ff3ea5')]]);
        break;
    }
    return groups;
  }

  // Round frames around the bean eyes at (8, 12) and (22, 12).
  function glassesAt(A, color, tint) {
    const ring = (x) => [[x - 2, 10 + A, 6, 1, color], [x - 2, 15 + A, 6, 1, color], [x - 2, 10 + A, 1, 6, color], [x + 3, 10 + A, 1, 6, color],
      ...(tint ? [[x - 1, 11 + A, 4, 4, 'rgba(191,227,255,0.35)'], [x - 1, 11 + A, 1, 1, PAL.shine]] : [[x - 1, 11 + A, 1, 1, HL2]])];
    return [...ring(8), ...ring(22), [12, 12 + A, 8, 1, color], [2, 12 + A, 4, 1, color]];
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

  // ---- Drawn characters ------------------------------------------------------
  // A drawing is a small picture, ART.W x ART.H fine pixels, feet on the bottom row. It is stored as
  // a palette and run-length text: { pal: ['#rrggbb', ...], px: '40.3a2b...' } where '.' is
  // see-through, a letter picks a palette colour and a number repeats the next pixel.
  // One picture is enough: the game finds the legs and makes it walk, breathe, nod, sit and jump.
  // Anyone who wants to can also draw a step, a working pose, a sleeping pose and a happy one.
  const ART = { W: 32, H: 44 };
  const ART_POSES = ['base', 'walk', 'work', 'sleep', 'happy'];
  const ART_KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const DRAWN = {};

  function encodeArt(px) {
    const pal = [];
    const key = (c) => {
      if (!c) return '.';
      let i = pal.indexOf(c);
      if (i < 0) {
        if (pal.length >= ART_KEYS.length) i = 0; // never happens: drawings use far fewer colours
        else { pal.push(c); i = pal.length - 1; }
      }
      return ART_KEYS[i];
    };
    let out = '';
    for (let i = 0; i < px.length;) {
      const k = key(px[i]);
      let n = 1;
      while (i + n < px.length && key(px[i + n]) === k) n++;
      out += (n > 1 ? n : '') + k;
      i += n;
    }
    return { pal, px: out };
  }

  function decodeArt(a) {
    const px = new Array(ART.W * ART.H).fill(null);
    if (!a || typeof a.px !== 'string') return px;
    let i = 0;
    for (const [, n, k] of a.px.matchAll(/(\d*)([.a-zA-Z])/g)) {
      const c = k === '.' ? null : a.pal?.[ART_KEYS.indexOf(k)] || null;
      for (let j = 0; j < (Number(n) || 1) && i < px.length; j++) px[i++] = c;
    }
    return px;
  }

  // Where the legs are: from the bottom up, the rows where the picture splits in two.
  function findLegs(px) {
    const W = ART.W;
    const runs = (y) => {
      const out = [];
      let from = -1;
      for (let x = 0; x <= W; x++) {
        const on = x < W && px[y * W + x];
        if (on && from < 0) from = x;
        if (!on && from >= 0) { out.push([from, x - 1]); from = -1; }
      }
      return out;
    };
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < ART.H; y++) if (runs(y).length) { if (top < 0) top = y; bottom = y; }
    if (bottom < 0) return null;
    let y = bottom;
    let skipped = 0;
    while (y > top && runs(y).length < 2 && skipped < 2) { y--; skipped++; }
    let legTop = -1;
    while (y > top && runs(y).length >= 2) { legTop = y; y--; }
    if (legTop < 0 || bottom - legTop < 1) return { top, bottom, legTop: null };
    legTop = Math.max(legTop, bottom - Math.floor((bottom - top) * 0.45));
    // Split the legs at the gap nearest the middle of the picture.
    const r = runs(legTop);
    const mid = (r[0][0] + r[r.length - 1][1]) / 2;
    let split = mid;
    let best = Infinity;
    for (let i = 1; i < r.length; i++) {
      const gap = (r[i - 1][1] + r[i][0]) / 2;
      if (Math.abs(gap - mid) < best) { best = Math.abs(gap - mid); split = gap; }
    }
    return { top, bottom, legTop, split };
  }

  // { base, walk?, work?, sleep?, happy? } of encoded (or already decoded) pictures.
  function makeDrawn(art) {
    const d = { cache: new Map() };
    for (const k of ART_POSES) if (art?.[k]) d[k] = Array.isArray(art[k]) ? art[k] : decodeArt(art[k]);
    d.base ||= new Array(ART.W * ART.H).fill(null);
    d.legs = findLegs(d.base);
    return d;
  }

  // The picture for a pose and step, as pixel moves: which picture, then where each part goes.
  function drawnFrame(d, pose, step) {
    const f = step % 2;
    const work = ['type', 'command', 'game', 'read', 'paint'].includes(pose);
    const legs = d.legs?.legTop != null ? d.legs : null;
    let pic = d.base;
    let all = [0, 0];
    let body = [0, 0];
    let legL = [0, 0];
    let legR = [0, 0];
    let mirror = false;
    let feetOnly = false;
    if (pose === 'walk' && d.walk) { pic = step % 2 ? d.base : d.walk; body = [0, step % 2]; }
    else if (pose === 'walk' && legs) {
      const s4 = step % 4;
      legL = [[-1, 0, 1, 0][s4], [-1, 0, 0, 0][s4]];
      legR = [[1, 0, -1, 0][s4], [0, 0, -1, 0][s4]];
      body = [0, s4 % 2];
    } else if (pose === 'walk') all = [0, step % 2 ? -1 : 0];
    else if (pose === 'rest') body = [0, BREATH[step % 8]];
    else if (work && d.work) pic = f ? d.work : d.base;
    else if (work) body = [0, f];
    else if (pose === 'sleep' && d.sleep) pic = d.sleep;
    else if (pose === 'sleep' && legs) { feetOnly = true; body = [0, legs.bottom - legs.legTop - 1 + f]; }
    else if (pose === 'sleep') body = [0, f];
    else if (pose === 'done') { pic = d.happy || d.base; all = [0, f ? 0 : -3]; }
    else if (pose === 'dance') { pic = d.happy || d.base; all = [f ? 1 : -1, f ? -1 : 0]; mirror = !!f; }
    else if (pose === 'dangle' && legs) { legL = [f ? 1 : -1, 0]; legR = [f ? -1 : 1, 0]; }
    if (pic !== d.base) return { pic, parts: [{ all: true, at: [all[0] + body[0], all[1] + body[1]] }], mirror };
    return { pic, legs, all, body, legL, legR, mirror, feetOnly };
  }

  function drawnBody(d, pose, step, col, ox, oy) {
    const key = `${pose}:${pose === 'walk' ? step % 4 : pose === 'rest' ? step % 8 : step % 2}:${ox}:${oy}`;
    let groups = d.cache.get(key);
    if (!groups) {
      const fr = drawnFrame(d, pose, step);
      const W = ART.W;
      const x0 = ox + 14 - W / 2;
      const y0 = oy + BOX.H - ART.H;
      // Legs behind, body over them; each part keeps its own offset.
      const layers = [];
      if (fr.parts) layers.push({ test: () => true, at: fr.parts[0].at });
      else if (fr.legs) {
        const { legTop, split, bottom } = fr.legs;
        const leg = (left, mv) => ({ test: (x, y) => y >= legTop && (left ? x < split : x >= split) && (!fr.feetOnly || y >= bottom - 1), at: [fr.all[0] + mv[0], fr.all[1] + mv[1]] });
        layers.push(leg(true, fr.legL), leg(false, fr.legR), { test: (x, y) => y < legTop, at: [fr.all[0] + fr.body[0], fr.all[1] + fr.body[1]] });
      } else layers.push({ test: () => true, at: [fr.all[0] + fr.body[0], fr.all[1] + fr.body[1]] });
      const details = [];
      for (const { test, at } of layers) {
        for (let y = 0; y < ART.H; y++) {
          let run = null;
          for (let x = 0; x <= W; x++) {
            const sx = fr.mirror ? W - 1 - x : x;
            const c = x < W && test(sx, y) ? fr.pic[y * W + sx] : null;
            if (run && run.c === c) { run.w++; continue; }
            if (run?.c) details.push([x0 + at[0] + run.x, y0 + at[1] + y, run.w, 1, run.c]);
            run = { x, w: 1, c };
          }
        }
      }
      groups = [{ rects: [], details }];
      d.cache.set(key, groups);
    }
    const out = [...groups];
    const t = ([x, y, w, h, c]) => [ox + x, oy + y, w, h, c];
    poseProps((rects, details = []) => out.push({ rects: rects.map(t), details: details.map(t) }), pose, step % 2, col, 0);
    return out;
  }

  // Registers drawn characters (and friends' dress-up characters) as skins 'draw:<id>'.
  function useDrawings(list = []) {
    for (const k of Object.keys(DRAWN)) if (!k.startsWith('draw:__')) delete DRAWN[k];
    for (const k of Object.keys(SKINS)) if (k.startsWith('draw:') && !k.startsWith('draw:__')) delete SKINS[k];
    for (const m of list) {
      if (m.art) DRAWN[`draw:${m.id}`] = makeDrawn(m.art);
      else if (m.recipe) SKINS[`draw:${m.id}`] = skinFor(m.recipe);
    }
  }
  // A drawing being painted right now (no saving): skin 'draw:__<name>'.
  function setDrawing(name, art) {
    if (art) DRAWN[`draw:__${name}`] = makeDrawn(art);
    else delete DRAWN[`draw:__${name}`];
  }

  // ---- The character studio --------------------------------------------------
  // A home-made character is a recipe: a head, hair, a body, a tail, a cape or a backpack, and a
  // few colours. It becomes a skin like any other ('mix:<id>'). Parts that come from a recruited
  // character unlock with that character.
  const PARTS = {
    head: { face: '人臉', cat: '貓貓', robot: '機器人', droid: '暴走機器人', ninja: '忍者頭巾', astronaut: '太空頭盔', helmet: '白盔', plush: '絨毛玩偶', okai: '大圓貓頭' },
    hat: { none: '光頭', hair: '短髮', messy: '亂髮', chef: '廚師帽' },
    body: { shirt: '襯衫', labcoat: '實驗袍', fur: '毛茸茸', metal: '金屬', mech: '機甲', gi: '忍者服', apron: '圍裙', suit: '太空衣', plain: '素面', blanket: '抱毯子', chubby: '圓肚肚' },
    extra: { none: '無', tail: '貓尾巴', flat: '扁尾巴', cape: '披風', backpack: '背包', specs: '眼鏡' },
  };
  const PART_FROM = {
    'head:ninja': 'ninja', 'body:gi': 'ninja', 'hat:chef': 'chef', 'body:apron': 'chef', 'head:astronaut': 'astronaut',
    'body:suit': 'astronaut', 'extra:backpack': 'astronaut', 'head:helmet': 'commander', 'body:plain': 'commander',
    'extra:cape': 'commander', 'head:plush': 'platypus', 'body:blanket': 'platypus', 'extra:flat': 'platypus',
    'head:okai': 'whitecat', 'body:chubby': 'whitecat',
  };
  // Colour swatches to pick from: skin or fur, clothes, trousers, shoes, hair.
  const SWATCHES = {
    skin: ['#f6cfa6', '#e8b48a', '#c98e64', '#8d5a3c', '#f6f4f0', '#f0a35e', '#9a9aa6', '#b8c0cc'],
    body: ['#f4f4f6', '#e2564a', '#f0b54d', '#7cc47f', '#5aa7ff', '#8a6ad8', '#ff8fb1', '#34373f'],
    leg: ['#3b4256', '#6b4a32', '#5a7a4a', '#2c3a5a', '#7a2a3a', '#d8d4cc', '#34373f', '#4a5a8a'],
    boot: ['#262a38', '#5a3a24', '#c9473d', '#f4f4f6', '#3a5a8a', '#e8b13a'],
    hair: ['#3a2a20', '#6b4423', '#d9a24a', '#e8e0d0', '#c9473d', '#5aa7ff', '#ff8fb1', '#2b2233'],
  };
  const FURRY = new Set(['cat', 'plush', 'okai']);
  function composeSkin(r = {}) {
    const C = r.colors || {};
    const head = PARTS.head[r.head] ? r.head : 'face';
    const body = PARTS.body[r.body] ? r.body : 'shirt';
    const extra = PARTS.extra[r.extra] ? r.extra : 'none';
    // Fur heads and metal heads take their colour from the "skin" swatch; clothes from "body".
    const skin = C.skin || PAL.skin;
    const cloth = C.body || '#f4f4f6';
    const coat = FURRY.has(head) || ['robot', 'droid', 'astronaut', 'helmet'].includes(head) ? skin : cloth;
    return {
      head,
      hat: head === 'face' && PARTS.hat[r.hat] && r.hat !== 'none' ? r.hat : undefined,
      specs: extra === 'specs' && head === 'face',
      body,
      item: 'none',
      tail: extra === 'tail' ? true : extra === 'flat' ? 'flat' : undefined,
      cape: extra === 'cape',
      backpack: extra === 'backpack',
      spikes: head === 'droid',
      mitts: body === 'blanket',
      drop: head === 'okai' ? 4 : 0,
      torsoAt: body === 'chubby' ? [4, 23] : body === 'blanket' ? [5, 21] : undefined,
      c: {
        skin, hair: C.hair || '#3a2a20', body: cloth, bodyShade: dark(cloth), belly: lite(cloth), trim: dark(cloth),
        leg: C.leg || '#3b4256', boot: C.boot || '#262a38', hand: head === 'face' || head === 'ninja' ? skin : coat,
        head: head === 'ninja' ? cloth : coat, headShade: dark(coat), helmet: coat, helmetShade: dark(coat),
        plate: lite(coat), face: '#16171c', glow: '#d8f1ff', bill: lite(coat),
        cape: C.cape || '#b8323a', capeDark: dark(C.cape || '#b8323a'), capeLite: lite(C.cape || '#b8323a'),
      },
    };
  }
  // A furry head on a furry body is one creature, all in the fur colour.
  function skinFor(recipe) {
    const sk = composeSkin(recipe);
    if (FURRY.has(sk.head) && ['fur', 'blanket', 'chubby'].includes(sk.body)) {
      Object.assign(sk.c, { body: sk.c.head, bodyShade: dark(sk.c.head), belly: lite(sk.c.head), leg: sk.c.head, boot: dark(sk.c.head) });
    }
    return sk;
  }
  function useCustoms(list = []) {
    for (const k of Object.keys(SKINS)) if (k.startsWith('mix:')) delete SKINS[k];
    for (const m of list) SKINS[`mix:${m.id}`] = skinFor(m.recipe);
  }
  // A surprise character from the unlocked parts.
  function randomRecipe(unlocked = () => true) {
    const pick = (kind, keys) => {
      const ok = keys.filter((k) => unlocked(kind, k));
      return ok[Math.floor(Math.random() * ok.length)];
    };
    const one = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return {
      head: pick('head', Object.keys(PARTS.head)), hat: pick('hat', Object.keys(PARTS.hat)), body: pick('body', Object.keys(PARTS.body)),
      extra: Math.random() < 0.5 ? 'none' : pick('extra', Object.keys(PARTS.extra)),
      colors: { skin: one(SWATCHES.skin), body: one(SWATCHES.body), leg: one(SWATCHES.leg), boot: one(SWATCHES.boot), hair: one(SWATCHES.hair) },
    };
  }

  return {
    W, H, RES, PAL, SKINS, FX, MINI, grouper, shade,
    buildCharacter, buildMini, drawMiniAt, drawCharacter, drawCharacterAt, drawFx, drawFxAt, paint,
    parseSheet, drawCustomAt, colorsFor,
    PARTS, PART_FROM, SWATCHES, skinFor, useCustoms, randomRecipe,
    ART, ART_POSES, encodeArt, decodeArt, useDrawings, setDrawing, findLegs, drawnFrame,
  };
});
