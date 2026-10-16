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
      c: { helmet: '#eceef3', helmetShade: '#bfc3cf', plume: '#3a3c48', plumeDark: '#26272f', body: '#2a2c36', bodyShade: '#1f2029', plate: '#3d404d', trim: '#8a90a0',
        leg: '#33353f', boot: '#1c1d24', hand: '#33353f', cape: '#45464f', capeDark: '#2e2f37' } },
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
      c: { body: '#9a6a45', bodyShade: '#7c5236', belly: '#e8c9a0', bill: '#55606c', billDark: '#3a434d', leg: '#9a6a45', boot: '#55606c', hand: '#e8c9a0' } },
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
  // Chibi proportions: a wide, flat head (30x18) on a small body, bean eyes.

  function buildCharacter(skinId, pose, frame, col, opts = {}) {
    const sk = SKINS[skinId] || SKINS.commander;
    const c = sk.c;
    const prop = opts.prop !== false;
    const groups = [];
    const g = fineGrouper(groups);
    const sleeping = pose === 'sleep';
    // walk is a 4-step cycle and rest an 8-frame breath; every other pose alternates two frames.
    const step = frame;
    frame %= 2;

    let dy = 0;
    if (pose === 'read') dy = frame;
    if (pose === 'dance') dy = frame ? -1 : 1;
    if (sleeping) dy = 2 + frame;
    let bob = 0;
    if (pose === 'rest') bob = BREATH[step % 8];
    if (pose === 'walk') bob = step % 2 ? -1 : 0;
    const sway = pose === 'walk' ? WALK_SWAY[step % 4] : pose === 'rest' ? BREATH[(step + 6) % 8] : 0;
    const F = dy * RES + bob;
    const HY = F;
    const TY = 36 + F;

    // --- Props behind the body.
    if (pose === 'type' && prop) {
      g([[40, 42, 20, 4, PAL.wood], [42, 46, 2, 8, PAL.woodDark], [56, 46, 2, 8, PAL.woodDark]], [[40, 42, 20, 1, HL], [40, 45, 20, 1, SH], [46, 43, 6, 1, 'rgba(60,30,10,0.18)']]);
      const keys = [];
      for (let i = 0; i < 6; i++) keys.push([45 + i * 2, 40, 1, 1, (i + frame) % 4 ? '#8a91a3' : PAL.shine]);
      g([[44, 40, 14, 2, '#c9ced8'], [54, 28, 4, 12, '#3a3f4c']], [...keys, [55, 30, 2, 8, glow(PAL.screen)], [55, 31 + frame * 3, 2, 1, PAL.shine]]);
    }
    if (pose === 'command' && prop) {
      // A retro terminal on a little cart.
      g([[49, 42, 4, 10, '#4a4f5e'], [44, 52, 14, 2, '#4a4f5e']], [[49, 42, 1, 10, HL]]);
      const blink = frame ? glow('#3dffb0') : '#0d2a1a';
      g([[44, 24, 16, 16, '#d6cfb8'], [42, 40, 16, 2, '#bdb59c']], [
        [46, 26, 12, 11, '#0d2a1a'], [47, 28, 6, 1, glow('#3dffb0')], [47, 30, 4, 1, glow('#3dffb0')], [47, 32, 8, 1, glow('#3dffb0')], [47, 34, 2, 1, glow('#3dffb0')], [50, 34, 1, 1, blink],
        [44, 24, 16, 1, HL], [58, 26, 2, 14, SH], [44, 40, 14, 1, SH],
      ]);
    }
    if (pose === 'paint' && prop) {
      g([[48, 24, 2, 30, PAL.wood], [58, 24, 2, 30, PAL.wood]], [[49, 24, 1, 30, SH]]);
      g([[44, 18, 18, 18, PAL.page]], [
        [48, 22, 6, 2, col.main], [50, 26, 8, 2, '#5aa7ff'], [46, 30, 4, 2, '#7cc47f'], [52, 30, 2, 1, '#ffd65a'],
        ...(frame ? [[54, 22, 4, 4, PAL.spark]] : [[46, 24, 2, 4, '#e0405a']]), [44, 34, 18, 2, SH],
      ]);
    }
    if (sk.cape) {
      const flap = pose === 'walk' ? WALK_FLAP[step % 4] : pose === 'dance' ? frame * 2 : sway;
      // A torn, ragged cape: the hem hangs in uneven strips that flutter out of step.
      const x0 = 8 - flap;
      const strips = [[0, 3, 7], [3, 2, 3], [5, 3, 9], [8, 2, 4], [10, 2 + flap, 6]].map(([dx, w, h], i) => [x0 + dx, 44 + F, w, h + ((step + i) % 2), c.cape]);
      g([[10 - flap, 36 + F, 10 + flap, 9, c.cape], ...strips], [[10 - flap, 36 + F, 2, 9, c.capeDark], [x0 + 6, 39 + F, 1, 7, c.capeDark], [x0 + 3, 44 + F, 1, 3, c.capeDark],
        [x0 + 9, 41 + F, 2, 1, c.capeDark], [x0 + 1, 47 + F, 1, 2, c.capeDark], [16, 37 + F, 1, 6, HL]]);
    }
    if (sk.tail === 'flat') g([[4, 42 + F, 15, 5, c.bodyShade], [2, 43 + F, 3, 3, c.bodyShade]], [[6, 42 + F, 11, 1, HL], [7, 44 + F, 1, 1, '#5f3f28'], [11, 45 + F, 1, 1, '#5f3f28'], [14, 44 + F, 1, 1, '#5f3f28']]);
    else if (sk.tail) g([[8, 30 + F, 4, 10, c.body], [10, 38 + F, 8, 4, c.body]], [[8, 33 + F, 4, 1, c.bodyShade], [8, 36 + F, 4, 1, c.bodyShade], [9, 30 + F, 2, 2, c.belly]]);
    if (sk.backpack) g([[11, 34 + F, 7, 12, c.body]], [[11, 36 + F, 2, 9, c.bodyShade], [13, 40 + F, 3, 3, '#8a93a6'], [14, 41 + F, 1, 1, glow('#3dffb0')]]);

    // --- Back arm (and a shoulder plate for the commander).
    const backUp = pose === 'dangle' || pose === 'done' || (pose === 'dance' && frame === 0);
    const backSwing = pose === 'walk' ? -WALK_ARM[step % 4] : 0;
    if (backUp) g([[14, 22, 4, 14, c.bodyShade], [14, 19, 4, 4, c.hand]], [[14, 22, 1, 14, HL]]);
    else g([[14 + backSwing, 38 + F, 4, 7, c.bodyShade], [14 + backSwing, 44 + F, 4, 3, c.hand]], [[14 + backSwing, 38 + F, 1, 6, HL]]);
    if (sk.body === 'armor') g([[12, 35 + F, 8, 5, c.plate]], [[12, 35 + F, 8, 1, HL], [12, 39 + F, 8, 1, c.trim]]);
    if (sk.spikes) g([[12, 35 + F, 8, 5, c.plate], [13, 31 + F, 2, 4, c.plate], [16, 32 + F, 2, 3, c.plate]], [[12, 35 + F, 8, 1, HL], [12, 39 + F, 8, 1, c.face]]);

    // --- Legs.
    const legs = {
      walk: [[[18, 46, 6, 8], [32, 46, 6, 8]], [[22, 46, 6, 6], [29, 46, 6, 8]], [[18, 46, 6, 8], [32, 46, 6, 8]], [[22, 46, 6, 8], [30, 46, 6, 6]]][step % 4],
      dangle: [[22, 46, 4, 8], [30, 46, 4, 8]],
      sleep: [[30, 48, 14, 4]],
    }[pose] || [[20, 46, 6, 8], [30, 46, 6, 8]];
    g(legs.map((r) => [...r, c.leg]), sleeping
      ? [[40, 48, 4, 4, c.boot], [30, 48, 14, 1, HL]]
      : legs.flatMap(([x, y, w, h]) => [[x, y + h - 3, w, 3, c.boot], [x, y + h - 3, w, 1, HL], [x + w - 1, y, 1, h - 3, SH], [x + 1, y + 1, 1, 2, HL]]));

    // --- Torso.
    const torso = [[18, TY, 20, 12, c.body]];
    const light = [[36, TY + 1, 1, 9, HL], [18, TY + 11, 20, 1, SH], [18, TY, 2, 12, c.bodyShade]];
    switch (sk.body) {
      case 'armor':
        g(torso, [...light, [21, TY + 1, 14, 7, c.plate], [21, TY + 1, 14, 1, HL], [27, TY + 2, 2, 5, c.bodyShade], [23, TY + 3, 2, 1, c.trim], [31, TY + 3, 2, 1, c.trim],
          [18, TY + 8, 20, 2, c.boot], [27, TY + 8, 3, 2, c.trim], [27, TY + 8, 1, 1, PAL.shine], [22, TY + 10, 2, 2, c.bodyShade], [31, TY + 10, 2, 2, c.bodyShade]]);
        break;
      case 'mech':
        g(torso, [...light, [20, TY + 1, 16, 7, c.plate], [20, TY + 1, 16, 1, HL], [26, TY + 3, 4, 4, c.face], [27, TY + 4, 2, 2, glow(c.glow)],
          [21, TY + 9, 14, 1, c.face], [23, TY + 11, 2, 1, c.face], [31, TY + 11, 2, 1, c.face], [21, TY + 2, 1, 1, '#7a808e'], [34, TY + 2, 1, 1, '#7a808e']]);
        break;
      case 'shirt':
        g(torso, [...light, [26, TY, 4, 2, col.dark], [27, TY + 2, 2, 6, col.main], [27, TY + 4, 2, 1, SH], [22, TY, 4, 2, '#ffffff'], [30, TY, 4, 2, '#ffffff'],
          [32, TY + 3, 3, 3, SH], [33, TY + 2, 1, 2, '#5aa7ff'], [18, TY + 8, 20, 2, '#3b3b45'], [27, TY + 8, 3, 2, '#c9ced8']]);
        break;
      case 'labcoat':
        g([[18, TY, 20, 14, c.body]], [...light, [25, TY, 6, 5, col.main], [26, TY + 5, 4, 2, col.main], [24, TY, 1, 13, c.bodyShade], [31, TY, 1, 13, c.bodyShade],
          [33, TY + 4, 3, 4, SH], [33, TY + 2, 1, 3, '#e0405a'], [35, TY + 2, 1, 3, '#5aa7ff'], [19, TY + 8, 4, 3, SH], [18, TY + 13, 20, 1, SH]]);
        break;
      case 'fur':
        g(torso, [...light, [24, TY + 2, 12, 8, c.belly], [18, TY, 20, 2, col.main], [27, TY + 2, 3, 3, PAL.gold], [27, TY + 2, 1, 1, PAL.shine], [19, TY + 5, 3, 1, c.bodyShade], [19, TY + 8, 3, 1, c.bodyShade]]);
        break;
      case 'metal':
        g(torso, [...light, [22, TY + 2, 12, 6, '#2c3442'], [24, TY + 4, 2, 2, glow(col.main)], [28, TY + 4, 2, 2, glow('#5ef0ff')], [32, TY + 4, 1, 2, glow(PAL.spark)],
          [21, TY + 1, 1, 1, SH2], [35, TY + 1, 1, 1, SH2], [22, TY + 9, 12, 1, SH], [22, TY + 11, 12, 1, SH]]);
        break;
      case 'gi':
        g(torso, [...light, [24, TY, 2, 6, '#4a5175'], [30, TY, 2, 6, '#4a5175'], [26, TY + 2, 4, 1, '#4a5175'], [18, TY + 6, 20, 2, col.main], [28, TY + 6, 3, 2, col.dark], [29, TY + 8, 1, 3, col.main]]);
        break;
      case 'apron':
        g(torso, [...light, [22, TY + 2, 12, 10, '#ffffff'], [20, TY, 16, 2, col.main], [24, TY, 8, 2, '#e0405a'], [25, TY + 6, 6, 3, SH], [20, TY + 3, 1, 1, SH2], [35, TY + 3, 1, 1, SH2]]);
        break;
      case 'suit':
        g(torso, [...light, [22, TY + 2, 4, 4, col.main], [23, TY + 3, 2, 1, HL2], [28, TY + 2, 6, 4, '#c3c9d6'], [29, TY + 3, 1, 1, glow('#ff5f5f')], [31, TY + 3, 1, 1, glow('#3dffb0')], [18, TY + 8, 20, 2, '#8a93a6']]);
        break;
      default:
        g(torso, light);
    }

    // --- Head: wide and flat.
    const headRects = (color) => [[16, 18 + HY, 26, 18, color], [14, 20 + HY, 30, 14, color], [15, 19 + HY, 28, 16, color]];
    const eyes = (color = PAL.eye) => (sleeping
      ? [[24, 28 + HY, 4, 1, color], [38, 28 + HY, 4, 1, color]]
      : [[25, 27 + HY, 2, 2, color], [39, 27 + HY, 2, 2, color]]);
    const cheeks = [[22, 30 + HY, 3, 2, PAL.blush], [41, 30 + HY, 3, 2, PAL.blush]];
    const faceShade = [[15, 33 + HY, 28, 2, SH], [42, 22 + HY, 1, 8, HL]];
    switch (sk.head) {
      case 'face':
        g(headRects(c.skin), [...faceShade, ...eyes(), ...cheeks, [32, 31 + HY, 2, 1, '#b0705a'], [17, 26 + HY, 3, 4, '#e8b48c']]);
        break;
      case 'cat':
        g([[16, 12 + HY, 7, 9, c.body], [35, 12 + HY, 7, 9, c.body]], [[18, 14 + HY, 3, 5, '#f6b8b8'], [37, 14 + HY, 3, 5, '#f6b8b8']], [], [[17, 10 + HY, 4, 2, c.body], [36, 10 + HY, 4, 2, c.body]]);
        g(headRects(c.body), [...faceShade, ...eyes('#3a3020'), [28, 30 + HY, 10, 4, c.belly], [32, 30 + HY, 2, 1, '#e07a7a'], [31, 32 + HY, 1, 1, '#b07050'], [34, 32 + HY, 1, 1, '#b07050'],
          [26, 18 + HY, 1, 3, c.bodyShade], [29, 18 + HY, 1, 4, c.bodyShade], [32, 18 + HY, 1, 3, c.bodyShade], [22, 30 + HY, 3, 2, PAL.blush],
          [42, 29 + HY, 4, 1, '#8a6a50'], [42, 32 + HY, 4, 1, '#8a6a50']]);
        break;
      case 'robot':
        g([[28, 12 + HY, 2, 6, c.bodyShade]], [], [], [[27, 9 + HY, 4, 4, col.main]]);
        groups[groups.length - 1].details.push([28, 10 + HY, 2, 2, glow(col.main)]);
        g([[14, 18 + HY, 30, 17, c.head]], [[17, 21 + HY, 24, 11, '#1b2b3a'], ...(sleeping
          ? [[27, 27 + HY, 4, 1, glow('#5ef0ff')], [35, 27 + HY, 4, 1, glow('#5ef0ff')]]
          : [[28, 24 + HY, 2, 3, glow('#5ef0ff')], [36, 24 + HY, 2, 3, glow('#5ef0ff')]]),
        [31, 29 + HY, 4, 1, 'rgba(94,240,255,0.5)'], [16, 19 + HY, 8, 1, HL], [42, 20 + HY, 1, 14, SH], [14, 25 + HY, 2, 4, c.bodyShade], [17, 21 + HY, 24, 1, 'rgba(94,240,255,0.12)']]);
        break;
      case 'ninja':
        g(headRects(c.head), [...faceShade, [20, 24 + HY, 24, 9, c.skin], ...eyes(), [22, 30 + HY, 3, 1, PAL.blush], [14, 20 + HY, 30, 3, col.main], [14, 20 + HY, 30, 1, HL]]);
        g([[8, 21 + HY, 8, 2, col.main], [6 + frame, 24 + HY, 6, 2, col.main]], [[8, 22 + HY, 8, 1, col.dark]]);
        break;
      case 'helmet': {
        // The closed knight's helm with a T visor; bean eyes glint in the slit, the plume trails behind.
        const px = -sway;
        g([[27, 9 + HY, 6, 8, c.plume], [20 + px, 6 + HY, 11, 5, c.plume], [13 + px * 2, 7 + HY, 9, 4, c.plume], [8 + px * 2, 9 + HY, 6, 3, c.plume], [5 + px * 3, 11 + HY, 4, 2, c.plume]],
          [[21 + px, 6 + HY, 9, 1, HL], [27, 11 + HY, 1, 6, c.plumeDark], [13 + px * 2, 10 + HY, 9, 1, c.plumeDark], [8 + px * 2, 11 + HY, 6, 1, c.plumeDark], [17 + px, 8 + HY, 1, 2, c.plumeDark]]);
        g([[16, 15 + HY, 26, 21, c.helmet], [14, 18 + HY, 30, 16, c.helmet], [15, 16 + HY, 28, 19, c.helmet]], [
          [14, 20 + HY, 2, 12, c.helmetShade], [15, 33 + HY, 28, 3, c.helmetShade], [19, 17 + HY, 10, 1, HL2], [16, 19 + HY, 1, 4, HL2],
          [20, 24 + HY, 24, 5, PAL.line], [33, 29 + HY, 3, 5, PAL.line],
          ...(sleeping ? [] : [[25, 26 + HY, 2, 2, PAL.shine], [39, 26 + HY, 2, 2, PAL.shine]]),
          [39, 31 + HY, 1, 1, c.helmetShade], [41, 31 + HY, 1, 1, c.helmetShade], [39, 33 + HY, 1, 1, c.helmetShade], [41, 33 + HY, 1, 1, c.helmetShade],
          [18, 27 + HY, 1, 1, c.helmetShade], [18, 31 + HY, 1, 1, c.helmetShade], [28, 16 + HY, 1, 7, c.helmetShade],
        ]);
        break;
      }
      case 'droid': {
        // A scary robot: horn antennae, angry slanted eyes, a grille of teeth.
        const E = glow(c.glow);
        g([[17, 12 + HY, 3, 7, c.plate], [18, 8 + HY, 2, 4, c.plate], [38, 12 + HY, 3, 7, c.plate], [38, 8 + HY, 2, 4, c.plate]], [[18, 8 + HY, 2, 1, E], [38, 8 + HY, 2, 1, E], [17, 12 + HY, 1, 7, HL]]);
        g([[14, 17 + HY, 30, 16, c.head], [16, 15 + HY, 26, 2, c.head], [18, 33 + HY, 22, 4, c.head]], [
          [17, 20 + HY, 26, 10, c.face],
          ...(sleeping ? [[22, 26 + HY, 6, 1, '#5a6070'], [35, 26 + HY, 6, 1, '#5a6070']]
            : [[21, 22 + HY, 3, 2, E], [23, 23 + HY, 3, 2, E], [25, 24 + HY, 3, 2, E], [34, 24 + HY, 3, 2, E], [36, 23 + HY, 3, 2, E], [38, 22 + HY, 3, 2, E]]),
          [16, 16 + HY, 10, 1, HL], [14, 29 + HY, 2, 4, c.headShade], [18, 35 + HY, 22, 2, c.headShade],
          [21, 32 + HY, 16, 4, c.face], [22, 32 + HY, 2, 2, '#c9ced8'], [26, 33 + HY, 2, 2, '#c9ced8'], [30, 32 + HY, 2, 2, '#c9ced8'], [34, 33 + HY, 2, 2, '#c9ced8'],
          [15, 22 + HY, 1, 1, '#7a808e'], [15, 26 + HY, 1, 1, '#7a808e'], [39, 16 + HY, 1, 3, c.headShade], [40, 18 + HY, 1, 2, c.headShade],
        ]);
        break;
      }
      case 'platypus':
        g(headRects(c.body), [...faceShade, ...(sleeping ? [[23, 27 + HY, 4, 1, PAL.eye], [34, 27 + HY, 4, 1, PAL.eye]] : [[24, 25 + HY, 2, 2, PAL.eye], [35, 25 + HY, 2, 2, PAL.eye]]),
          [20, 28 + HY, 3, 2, PAL.blush], [18, 19 + HY, 8, 1, HL], [26, 19 + HY, 1, 3, c.bodyShade], [30, 19 + HY, 1, 3, c.bodyShade]]);
        g([[37, 28 + HY, 15, 5, c.bill], [39, 27 + HY, 11, 1, c.bill]], [[39, 28 + HY, 11, 1, HL], [37, 32 + HY, 15, 1, c.billDark], [46, 29 + HY, 1, 1, c.billDark], [49, 29 + HY, 1, 1, c.billDark]]);
        break;
      case 'astronaut':
        g([[16, 15 + HY, 26, 22, c.head], [13, 18 + HY, 32, 16, c.head], [14, 16 + HY, 30, 20, c.head]], [
          [18, 21 + HY, 24, 12, '#2a3b66'], [20, 22 + HY, 6, 1, '#6a84c0'], [19, 23 + HY, 1, 3, '#6a84c0'], ...eyes('#dfe8ff'), [22, 30 + HY, 3, 1, 'rgba(245,163,163,0.6)'],
          [14, 34 + HY, 30, 2, '#c3c9d6'], [13, 24 + HY, 2, 4, glow('#ff5f5f')], [43, 20 + HY, 1, 12, SH]]);
        break;
    }

    // --- Hats and hair.
    switch (sk.hat) {
      case 'hair':
        g([[15, 14 + HY, 28, 7, c.hair], [13, 18 + HY, 6, 12, c.hair]], [[20, 15 + HY, 8, 1, HL], [24, 20 + HY, 1, 1, SH2], [32, 19 + HY, 1, 2, SH2]], [], [[18, 13 + HY, 22, 1, c.hair], [22, 21 + HY, 8, 2, c.hair], [36, 21 + HY, 5, 1, c.hair]]);
        break;
      case 'messy':
        g([[15, 14 + HY, 28, 6, c.hair], [13, 17 + HY, 6, 11, c.hair]], [[20, 15 + HY, 10, 1, HL2], [26, 18 + HY, 1, 2, SH], [34, 17 + HY, 1, 2, SH]], [],
          [[16, 11 + HY, 4, 3, c.hair], [24, 10 + HY, 5, 4, c.hair], [33, 11 + HY, 4, 3, c.hair], [41, 15 + HY, 4, 4, c.hair], [11, 20 + HY, 3, 4, c.hair], [22, 20 + HY, 6, 2, c.hair]]);
        break;
      case 'chef':
        g([[13, 19 + HY, 5, 9, c.hair]], [[13, 20 + HY, 1, 6, HL]]);
        g([[18, 6 + HY, 22, 13, '#ffffff'], [15, 3 + HY, 28, 7, '#ffffff']], [[24, 8 + HY, 1, 8, '#e3e6ec'], [30, 6 + HY, 1, 10, '#e3e6ec'], [36, 8 + HY, 1, 8, '#e3e6ec'], [18, 16 + HY, 22, 3, '#e8eaf0'], [17, 4 + HY, 10, 1, PAL.shine]], [], [[18, 1 + HY, 22, 2, '#ffffff']]);
        break;
    }
    if (sk.specs) {
      const ring = (x) => [[x - 2, 24 + HY, 6, 1, '#5a4a3a'], [x - 2, 29 + HY, 6, 1, '#5a4a3a'], [x - 2, 24 + HY, 1, 6, '#5a4a3a'], [x + 3, 24 + HY, 1, 6, '#5a4a3a'], [x - 1, 25 + HY, 1, 1, HL2]];
      g([], [...ring(25), ...ring(39), [29, 26 + HY, 8, 1, '#5a4a3a'], [17, 26 + HY, 6, 1, '#5a4a3a']]);
    }

    // --- Front arm and whatever it holds.
    const arm = (rects, hand) => g([...rects.map((r) => [...r, c.body]), [...hand, c.hand]], rects.flatMap(([x, y, w, h]) => [[x + w - 1, y, 1, h, SH], [x, y, 1, h, HL]]));
    const sparks = (pts) => g([], pts.flatMap(([x, y, color]) => twinkle(x, y, color)));
    const note = (x, y, color) => g([], [[x, y, 1, 6, color], [x + 1, y, 2, 1, color], [x + 2, y + 1, 1, 1, color], [x - 3, y + 5, 3, 2, color]]);

    switch (pose) {
      case 'done':
        arm([[38, 22, 4, 14]], [38, 18, 4, 4]);
        sparks(frame
          ? [[34, 4, PAL.shine], [48, 8, PAL.spark], [10, 10, PAL.spark], [50, 2, PAL.spark]]
          : [[36, 8, PAL.spark], [48, 3, PAL.shine], [12, 4, PAL.spark], [8, 12, PAL.shine]]);
        break;
      case 'command':
        arm([[38, 37, 6, 4]], frame ? [43, 38, 4, 4] : [43, 33, 4, 4]);
        if (prop && frame) sparks([[47, 37, PAL.spark], [51, 36, PAL.shine]]);
        break;
      case 'game':
        arm([[38, 38, 4, 4]], [38, 42, 4, 3]);
        g([[34, 41, 16, 6, '#3a3f4c']], [[36, 43, 3, 1, '#c9ced8'], [37, 42, 1, 3, '#c9ced8'], [45, 42, 2, 2, '#e0405a'], [47, 44, 2, 2, '#5aa7ff'], [34, 41, 16, 1, HL], [40, 44 - frame, 3, 2, c.hand]], [], [[34, 45, 4, 4, '#3a3f4c'], [46, 45, 4, 4, '#3a3f4c']]);
        break;
      case 'type':
        arm([[38, 37, 7, 4]], [44, 37 + frame, 4, 4]);
        break;
      case 'paint':
        arm([[38, 32, 6, 4]], [42, 32, 4, 4]);
        g([[46, 28 + frame * 2, 6, 2, PAL.wood]], [[50, 28 + frame * 2, 2, 2, col.main], [48, 28 + frame * 2, 1, 2, PAL.steel]]);
        break;
      case 'read': {
        arm([[38, 37 + F, 4, 6]], [38, 42 + F, 4, 3]);
        const lines = [];
        for (let i = 0; i < 4; i++) {
          lines.push([37, 35 + i * 2 + F, i === 3 ? 3 : 5, 1, PAL.ink]);
          if (i !== (frame ? 1 : 3)) lines.push([45, 35 + i * 2 + F, i === 3 ? 3 : 5, 1, PAL.ink]);
        }
        g([[34, 32 + F, 18, 12, PAL.cover]], [[36, 34 + F, 6, 8, PAL.page], [44, 34 + F, 6, 8, PAL.page], [42, 33 + F, 2, 10, SH2], ...lines, [34, 32 + F, 18, 1, HL], [48, 42 + F, 1, 4, '#e0405a']]);
        break;
      }
      case 'wait':
        arm([[38, 24, 4, 14]], [38 + frame * 2, 19, 5, 5]);
        g([], frame ? [[47, 16, 2, 1, HL2], [48, 20, 2, 1, HL2]] : [[34, 16, 2, 1, HL2], [33, 20, 2, 1, HL2]]);
        break;
      case 'dance':
        if (frame) arm([[38, 22, 4, 14]], [38, 18, 4, 4]);
        else arm([[38, 38 + F, 4, 6]], [38, 43 + F, 4, 3]);
        note(frame ? 50 : 8, frame ? 10 : 6, col.main);
        break;
      case 'dangle':
        arm([[38, 22, 4, 14]], [38, 18, 4, 4]);
        break;
      case 'sleep':
        arm([[38, 40 + F, 4, 5]], [38, 44 + F, 4, 3]);
        break;
      default: { // rest / walk: holding the signature item
        switch (sk.item) {
          case 'mug':
            g([[44, 36 + F, 8, 8, '#ffffff'], [52, 38 + F, 2, 4, '#ffffff']], [[44, 36 + F, 8, 2, '#8a5a30'], [44, 41 + F, 8, 1, col.main], [50, 38 + F, 1, 6, SH]]);
            if (frame) g([], [[46, 31 + F, 1, 2, '#e6e9f0'], [47, 29 + F, 1, 2, '#e6e9f0'], [49, 30 + F, 1, 2, '#e6e9f0']]);
            break;
          case 'flask':
            g([[45, 28 + F, 4, 5, '#dceff8'], [43, 33 + F, 8, 3, '#dceff8'], [41, 36 + F, 12, 6, '#dceff8']], [[42, 37 + F, 10, 5, '#3dffb0'], [44, 35 + F, 6, 2, '#3dffb0'], [44, 38 + F, 2, 2, HL2], [48, 33 + F - frame, 1, 1, PAL.shine], [45, 28 + F, 4, 1, '#a8b8c4']]);
            break;
          case 'wrench':
            g([[42, 24 + F, 4, 18, PAL.steel], [40, 20 + F, 8, 4, PAL.steel]], [[42, 20 + F, 4, 2, '#5a6270'], [42, 26 + F, 1, 14, HL2]]);
            break;
          case 'kunai':
            g([[42, 28 + F, 2, 12, '#c9d1dc'], [42, 40 + F, 2, 4, PAL.grip]], [[42, 29 + F, 1, 9, HL2]], [], [[41, 44 + F, 4, 2, PAL.steel]]);
            break;
          case 'ladle':
            g([[42, 20 + F, 2, 22, PAL.steel], [40, 16 + F, 6, 4, PAL.steel]], [[41, 16 + F, 2, 1, HL2]]);
            break;
        }
        const swing = sk.item === 'none' && pose === 'walk' ? WALK_ARM[step % 4] : 0;
        arm([[38 + swing, 37 + F, 4, 6]], [40 + swing, 41 + F, 4, 4]);
      }
    }
    if (sk.body === 'armor') g([[36, 37 + F, 7, 4, c.plate]], [[36, 37 + F, 7, 1, HL], [36, 40 + F, 7, 1, c.trim], [41, 38 + F, 1, 1, c.trim]]);
    if (sk.spikes) g([[36, 37 + F, 7, 4, c.plate], [37, 33 + F, 2, 4, c.plate], [40, 34 + F, 2, 3, c.plate]], [[36, 37 + F, 7, 1, HL], [36, 40 + F, 7, 1, c.face]]);

    // --- Accessory on top of everything.
    const A = F;
    switch (opts.accessory) {
      case 'partyhat':
        g([[27, 6 + A, 2, 2, col.main], [25, 8 + A, 6, 4, col.main], [23, 12 + A, 10, 6, col.main]], [[24, 14 + A, 8, 1, '#ffffff'], [26, 10 + A, 4, 1, '#ffffff'], [27, 4 + A, 2, 2, '#ffffff'], [28, 13 + A, 1, 1, '#ffe066']]);
        break;
      case 'flower':
        g([[39, 15 + A, 6, 6, '#ff8fb1']], [[41, 17 + A, 2, 2, '#ffe066'], [40, 16 + A, 1, 1, HL2]], [], [[37, 19 + A, 3, 2, '#5aa85a']]);
        break;
      case 'glasses': {
        const ring = (x) => [[x - 2, 24 + A, 6, 1, PAL.line], [x - 2, 29 + A, 6, 1, PAL.line], [x - 2, 24 + A, 1, 6, PAL.line], [x + 3, 24 + A, 1, 6, PAL.line], [x - 1, 25 + A, 4, 4, 'rgba(191,227,255,0.4)'], [x - 1, 25 + A, 1, 1, PAL.shine]];
        g([], [...ring(25), ...ring(39), [29, 26 + A, 8, 1, PAL.line], [17, 26 + A, 6, 1, PAL.line]]);
        break;
      }
      case 'sunglasses':
        g([], [[22, 25 + A, 7, 4, '#1c1c26'], [36, 25 + A, 7, 4, '#1c1c26'], [29, 26 + A, 7, 1, '#1c1c26'], [17, 26 + A, 5, 1, '#1c1c26'], [23, 26 + A, 2, 1, '#6a6a7a'], [37, 26 + A, 1, 1, '#6a6a7a']]);
        break;
      case 'headphones':
        g([[17, 13 + A, 24, 2, '#3a3a46'], [15, 15 + A, 3, 8, '#3a3a46']], [[19, 13 + A, 18, 1, HL]]);
        g([[12, 23 + A, 7, 10, col.main]], [[12, 23 + A, 2, 10, col.dark], [16, 25 + A, 1, 5, HL2], [17, 27 + A, 1, 2, glow('#3dffb0')]]);
        break;
      case 'halo':
        g([], [[22, 7 + A, 18, 1, glow('#ffe066')], [20, 8 + A, 2, 1, glow('#ffe066')], [40, 8 + A, 2, 1, glow('#ffe066')], [22, 9 + A, 18, 1, glow('#ffe066')]]);
        break;
      case 'bow':
        g([[34, 14 + A, 5, 5, '#ff6fa8'], [41, 14 + A, 5, 5, '#ff6fa8'], [39, 15 + A, 2, 3, '#e0508a']], [[35, 15 + A, 2, 1, HL2]]);
        break;
      case 'vr':
        g([[14, 25 + A, 13, 3, '#3a3d4c']], []);
        g([[26, 22 + A, 19, 9, '#2b2d3a']], [[28, 25 + A, 16, 2, glow('#36f9ff')], [26, 22 + A, 19, 1, HL], [26, 30 + A, 19, 1, SH2], [43, 23 + A, 1, 1, glow('#ff3ea5')]]);
        break;
    }
    return groups;
  }

  // ---- Mini characters (room mode) -------------------------------------------
  // 12x16 people on a 14x18 grid (28x36 fine), same chibi rules: wide flat head, bean eyes.
  const MINI = { W: 14, H: 18, anchor: 6.5, feet: 16 };

  function buildMini(skinId, pose, frame, col, opts = {}) {
    const sk = SKINS[skinId] || SKINS.commander;
    const c = sk.c;
    const groups = [];
    const g = fineGrouper(groups);
    const sleeping = pose === 'sleep';
    const step = frame;
    frame %= 2;
    let dy = 0;
    if (pose === 'read') dy = frame;
    if (pose === 'dance') dy = frame ? -1 : 0;
    if (sleeping) dy = 2;
    let bob = 0;
    if (pose === 'rest') bob = BREATH[step % 8];
    if (pose === 'walk') bob = step % 2 ? -1 : 0;
    const F = dy * RES + bob;
    const HY = F;
    const TY = 18 + F;

    if (sk.cape) {
      const flap = pose === 'walk' ? WALK_FLAP[step % 4] / 2 : 0;
      g([[4 - flap, 19 + F, 5 + flap, 6, c.cape], [3 - flap, 25 + F, 2, 3 + (step % 2), c.cape], [6 - flap, 25 + F, 2, 4 - (step % 2), c.cape], [8 - flap, 25 + F, 1, 2, c.cape]],
        [[4 - flap, 19 + F, 1, 6, c.capeDark], [6 - flap, 21 + F, 1, 3, c.capeDark]]);
    }
    if (sk.tail === 'flat') g([[1, 23 + F, 8, 3, c.bodyShade]], [[2, 23 + F, 6, 1, HL]]);
    else if (sk.tail) g([[3, 18 + F, 2, 7, c.body]], [[3, 20 + F, 2, 1, c.bodyShade]]);
    if (sk.backpack) g([[4, 18 + F, 4, 8, c.body]], [[5, 21 + F, 2, 2, '#8a93a6']]);

    const armsUp = pose === 'dangle' || pose === 'done' || (pose === 'dance' && !frame);
    g(armsUp ? [[6, 9, 2, 9, c.bodyShade], [6, 7, 2, 2, c.hand]] : [[6, 19 + F, 2, 5, c.bodyShade], [6, 24 + F, 2, 2, c.hand]]);
    const legs = pose === 'walk' ? [[[6, 26, 4, 6], [16, 26, 4, 6]], [[9, 26, 4, 4], [14, 26, 4, 6]], [[6, 26, 4, 6], [16, 26, 4, 6]], [[9, 26, 4, 6], [14, 26, 4, 4]]][step % 4]
      : sleeping ? [[12, 28, 10, 4]]
      : [[8, 26, 4, 6], [14, 26, 4, 6]];
    g(legs.map((r) => [...r, c.leg]), sleeping ? [[19, 28, 3, 4, c.boot]] : legs.map(([x, y, w, h]) => [x, y + h - 2, w, 2, c.boot]));

    const torso = sk.body === 'labcoat' ? [[8, TY, 10, 10, c.body]] : [[8, TY, 10, 8, c.body]];
    const torsoDetail = {
      armor: [[10, TY + 1, 6, 4, c.plate], [12, TY + 1, 2, 4, c.bodyShade], [8, TY + 5, 10, 1, c.boot], [12, TY + 5, 2, 1, c.trim]],
      mech: [[10, TY + 1, 6, 5, c.plate], [12, TY + 2, 2, 2, glow(c.glow)], [8, TY + 7, 10, 1, c.face]],
      shirt: [[12, TY, 2, 5, col.main], [10, TY, 2, 1, '#ffffff'], [14, TY, 2, 1, '#ffffff'], [8, TY + 6, 10, 1, '#3b3b45']],
      labcoat: [[11, TY, 4, 4, col.main], [10, TY, 1, 9, c.bodyShade], [15, TY, 1, 9, c.bodyShade], [16, TY + 3, 1, 2, '#e0405a']],
      fur: [[10, TY + 2, 6, 5, c.belly], [8, TY, 10, 1, col.main], [12, TY + 1, 2, 2, PAL.gold]],
      metal: [[10, TY + 2, 6, 3, '#2c3442'], [11, TY + 3, 1, 1, glow(col.main)], [14, TY + 3, 1, 1, glow('#5ef0ff')]],
      gi: [[11, TY, 1, 4, '#4a5175'], [14, TY, 1, 4, '#4a5175'], [8, TY + 4, 10, 1, col.main]],
      apron: [[10, TY + 1, 6, 7, '#ffffff'], [9, TY, 8, 1, col.main], [11, TY, 4, 1, '#e0405a']],
      suit: [[10, TY + 2, 2, 2, col.main], [13, TY + 2, 3, 2, '#c3c9d6'], [8, TY + 6, 10, 1, '#8a93a6']],
    }[sk.body] || [];
    g(torso, [...torsoDetail, [8, TY, 1, 8, c.bodyShade], [17, TY + 1, 1, 6, HL], [8, TY + 7, 10, 1, SH]]);

    const head = (color) => [[6, 6 + HY, 16, 12, color], [4, 8 + HY, 20, 8, color], [5, 7 + HY, 18, 10, color]];
    const eyes = (color = PAL.eye) => (sleeping ? [[10, 12 + HY, 3, 1, color], [18, 12 + HY, 3, 1, color]] : [[11, 11 + HY, 2, 2, color], [19, 11 + HY, 2, 2, color]]);
    const cheeks = [[8, 14 + HY, 2, 1, PAL.blush], [21, 14 + HY, 2, 1, PAL.blush]];
    switch (sk.head) {
      case 'face':
        g(head(c.skin), [...eyes(), ...cheeks, [5, 16 + HY, 18, 1, SH]]);
        break;
      case 'cat':
        g([[6, 2 + HY, 4, 6, c.body], [17, 2 + HY, 4, 6, c.body]], [[7, 4 + HY, 2, 3, '#f6b8b8'], [18, 4 + HY, 2, 3, '#f6b8b8']]);
        g(head(c.body), [...eyes('#3a3020'), [13, 14 + HY, 6, 3, c.belly], [15, 14 + HY, 2, 1, '#e07a7a'], [8, 14 + HY, 2, 1, PAL.blush], [12, 7 + HY, 1, 2, c.bodyShade], [15, 7 + HY, 1, 2, c.bodyShade]]);
        break;
      case 'robot':
        g([[13, 2 + HY, 2, 4, c.bodyShade]], [[13, 1 + HY, 2, 2, glow(col.main)]], [], [[12, 0 + HY, 4, 3, col.main]]);
        g([[4, 6 + HY, 20, 12, c.head]], [[6, 8 + HY, 16, 8, '#1b2b3a'], ...(sleeping ? [[12, 12 + HY, 3, 1, glow('#5ef0ff')], [17, 12 + HY, 3, 1, glow('#5ef0ff')]] : [[13, 10 + HY, 2, 3, glow('#5ef0ff')], [18, 10 + HY, 2, 3, glow('#5ef0ff')]]), [5, 7 + HY, 6, 1, HL]]);
        break;
      case 'ninja':
        g(head(c.head), [[7, 10 + HY, 16, 6, c.skin], ...eyes(), [8, 14 + HY, 2, 1, PAL.blush], [4, 8 + HY, 20, 2, col.main]]);
        g([[0 + frame, 9 + HY, 4, 2, col.main]]);
        break;
      case 'helmet': {
        const px = pose === 'walk' ? -WALK_SWAY[step % 4] : 0;
        g([[12, 2 + HY, 3, 4, c.plume], [7 + px, 1 + HY, 7, 2, c.plume], [3 + px, 2 + HY, 5, 2, c.plume]], [[3 + px, 3 + HY, 5, 1, c.plumeDark]]);
        g(head(c.helmet).concat([[6, 5 + HY, 16, 2, c.helmet]]), [[4, 8 + HY, 2, 7, c.helmetShade], [5, 16 + HY, 18, 2, c.helmetShade], [7, 6 + HY, 5, 1, HL2],
          [7, 10 + HY, 16, 3, PAL.line], [15, 13 + HY, 2, 3, PAL.line], ...(sleeping ? [] : [[11, 11 + HY, 1, 1, PAL.shine], [19, 11 + HY, 1, 1, PAL.shine]]), [20, 14 + HY, 1, 1, c.helmetShade]]);
        break;
      }
      case 'droid': {
        const E = glow(c.glow);
        g([[6, 2 + HY, 2, 4, c.plate], [20, 2 + HY, 2, 4, c.plate]], [[6, 2 + HY, 2, 1, E], [20, 2 + HY, 2, 1, E]]);
        g([[4, 6 + HY, 20, 10, c.head], [5, 5 + HY, 18, 1, c.head], [7, 16 + HY, 14, 2, c.head]], [[6, 8 + HY, 16, 6, c.face],
          ...(sleeping ? [[9, 11 + HY, 4, 1, '#5a6070'], [16, 11 + HY, 4, 1, '#5a6070']] : [[8, 9 + HY, 2, 1, E], [10, 10 + HY, 2, 1, E], [18, 9 + HY, 2, 1, E], [16, 10 + HY, 2, 1, E]]),
          [9, 15 + HY, 10, 2, c.face], [10, 15 + HY, 1, 1, '#c9ced8'], [13, 16 + HY, 1, 1, '#c9ced8'], [16, 15 + HY, 1, 1, '#c9ced8'], [5, 6 + HY, 5, 1, HL], [7, 17 + HY, 14, 1, c.headShade]]);
        break;
      }
      case 'platypus':
        g(head(c.body), [...(sleeping ? [[9, 12 + HY, 3, 1, PAL.eye], [15, 12 + HY, 3, 1, PAL.eye]] : [[10, 10 + HY, 2, 2, PAL.eye], [16, 10 + HY, 2, 2, PAL.eye]]),
          [7, 13 + HY, 2, 1, PAL.blush], [5, 16 + HY, 18, 1, SH]]);
        g([[18, 12 + HY, 8, 3, c.bill]], [[18, 12 + HY, 8, 1, HL], [23, 13 + HY, 1, 1, c.billDark]]);
        break;
      case 'astronaut':
        g([[6, 4 + HY, 16, 15, c.head], [4, 6 + HY, 20, 11, c.head], [5, 5 + HY, 18, 13, c.head]], [[7, 8 + HY, 14, 8, '#2a3b66'], ...eyes('#dfe8ff'), [8, 9 + HY, 3, 1, '#6a84c0']]);
        break;
    }
    switch (sk.hat) {
      case 'hair': g([[5, 4 + HY, 18, 5, c.hair], [4, 7 + HY, 4, 7, c.hair]], [[8, 5 + HY, 6, 1, HL]], [], [[10, 9 + HY, 6, 1, c.hair]]); break;
      case 'messy': g([[5, 4 + HY, 18, 4, c.hair], [4, 7 + HY, 4, 6, c.hair]], [[8, 5 + HY, 6, 1, HL2]], [], [[7, 2 + HY, 3, 2, c.hair], [13, 1 + HY, 4, 3, c.hair], [21, 5 + HY, 3, 3, c.hair]]); break;
      case 'chef': g([[7, 0 + HY, 14, 7, '#ffffff'], [5, 6 + HY, 18, 2, '#ffffff']], [[11, 1 + HY, 1, 5, '#e3e6ec'], [16, 1 + HY, 1, 5, '#e3e6ec']]); break;
    }
    if (sk.specs) g([], [[10, 10 + HY, 4, 1, '#5a4a3a'], [18, 10 + HY, 4, 1, '#5a4a3a'], [14, 11 + HY, 4, 1, '#5a4a3a'], [6, 11 + HY, 4, 1, '#5a4a3a']]);

    const arm = (rects, hand) => g([...rects.map((r) => [...r, c.body]), [...hand, c.hand]]);
    const spark = (pts) => g([], pts.flatMap(([x, y, color]) => twinkle(x, y, color)));
    switch (pose) {
      case 'type': case 'command': case 'paint':
        arm([[18, 19 + F, 4, 2]], [21, 18 + frame * 2, 2, 2]);
        if (pose === 'paint') g([], [[23, 18 + frame * 2, 1, 1, col.main]]);
        break;
      case 'game':
        arm([[18, 20 + F, 2, 3]], [18, 22 + F, 2, 2]);
        g([[15, 22 + F, 9, 3, '#3a3f4c']], [[21, 22 + F, 1, 1, '#e0405a'], [17, 23 + F, 2, 1, '#c9ced8']]);
        break;
      case 'read':
        g([[16, 18 + F, 8, 6, PAL.cover]], [[17, 19 + F, 3, 4, PAL.page], [21, 19 + F, 2, 4, PAL.page], [17, 20 + F, 2, 1, PAL.ink], [21, 20 + F, 2, 1, PAL.ink]]);
        break;
      case 'wait':
        arm([[18, 10, 2, 9]], [18 + frame, 7, 3, 3]);
        break;
      case 'done':
        arm([[18, 9, 2, 9]], [18, 7, 2, 2]);
        spark(frame ? [[24, 3, PAL.spark], [3, 2, PAL.shine]] : [[25, 6, PAL.shine], [2, 5, PAL.spark]]);
        break;
      case 'dangle':
        arm([[18, 9, 2, 9]], [18, 7, 2, 2]);
        break;
      case 'dance':
        if (frame) arm([[18, 9, 2, 9]], [18, 7, 2, 2]); else arm([[18, 19 + F, 2, 5]], [18, 24 + F, 2, 2]);
        g([], frame ? [[25, 3, 1, 4, col.main], [26, 3, 1, 1, col.main], [23, 6, 2, 2, col.main]] : [[3, 1, 1, 4, col.main], [4, 1, 1, 1, col.main], [1, 4, 2, 2, col.main]]);
        break;
      case 'sleep':
        arm([[18, 21 + F, 2, 3]], [18, 24 + F, 2, 1]);
        break;
      default:
        if (sk.item === 'mug') g([[20, 19 + F, 4, 4, '#ffffff']], [[20, 19 + F, 4, 1, '#8a5a30']]);
        if (sk.item === 'flask') g([[21, 16 + F, 2, 3, '#dceff8'], [19, 19 + F, 6, 4, '#dceff8']], [[20, 20 + F, 4, 3, '#3dffb0']]);
        if (sk.item === 'wrench') g([[21, 14 + F, 2, 10, PAL.steel], [20, 12 + F, 4, 2, PAL.steel]]);
        arm([[18, 19 + F, 2, 4]], [18, 23 + F, 3, 2]);
    }
    if (sk.body === 'armor') g([[16, 18 + F, 5, 3, c.plate]], [[16, 20 + F, 5, 1, c.trim]]);
    if (sk.spikes) g([[16, 18 + F, 5, 3, c.plate], [18, 16 + F, 2, 2, c.plate]], [[16, 20 + F, 5, 1, c.face]]);

    const A = F;
    switch (opts.accessory) {
      case 'partyhat': g([[13, 0 + A, 2, 2, col.main], [11, 2 + A, 6, 5, col.main]], [[12, 4 + A, 4, 1, '#ffffff']]); break;
      case 'flower': g([[19, 4 + A, 3, 3, '#ff8fb1']], [[20, 5 + A, 1, 1, '#ffe066']]); break;
      case 'glasses': g([], [[10, 10 + A, 4, 1, PAL.line], [18, 10 + A, 4, 1, PAL.line], [10, 13 + A, 4, 1, PAL.line], [18, 13 + A, 4, 1, PAL.line], [14, 11 + A, 4, 1, PAL.line], [6, 11 + A, 4, 1, PAL.line]]); break;
      case 'sunglasses': g([], [[10, 10 + A, 4, 3, '#1c1c26'], [18, 10 + A, 4, 3, '#1c1c26'], [14, 11 + A, 4, 1, '#1c1c26'], [6, 11 + A, 4, 1, '#1c1c26'], [11, 11 + A, 1, 1, '#6a6a7a']]); break;
      case 'headphones': g([[6, 4 + A, 16, 1, '#3a3a46']]); g([[3, 9 + A, 4, 6, col.main]], [[3, 9 + A, 1, 6, col.dark]]); break;
      case 'halo': g([], [[8, 1 + A, 12, 1, glow('#ffe066')], [7, 2 + A, 1, 1, glow('#ffe066')], [20, 2 + A, 1, 1, glow('#ffe066')]]); break;
      case 'bow': g([[17, 4 + A, 3, 3, '#ff6fa8'], [21, 4 + A, 3, 3, '#ff6fa8']], [[20, 5 + A, 1, 2, '#e0508a']]); break;
      case 'vr': g([[12, 10 + A, 11, 5, '#2b2d3a']], [[13, 12 + A, 9, 1, glow('#36f9ff')]]); break;
    }
    return groups;
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
