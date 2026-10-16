// Procedural pixel art. Characters live on a 32x28 logical grid (64x56 fine pixels), facing right.
// A drawing is a list of groups; each group is outlined as one silhouette, filled,
// then its details are drawn on top, so later groups get a clean outline over earlier ones.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sprites = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  const W = 32;
  const H = 28;

  const PAL = {
    line: '#1d1b26',
    shine: '#ffffff',
    gold: '#e8b13a',
    belt: '#4a3424',
    wood: '#9c6b3c',
    woodDark: '#7a522c',
    blade: '#e6edf5',
    bladeShade: '#aab6c6',
    grip: '#6b4423',
    steel: '#9aa3b2',
    steelDark: '#6d7685',
    page: '#fbf6e6',
    ink: '#cdbf9f',
    cover: '#8a4b2a',
    anvil: '#4a4f5e',
    anvilTop: '#6c7385',
    anvilShine: '#8a91a3',
    spark: '#ffd65a',
    blush: '#f3a3a3',
    screen: '#7ad1ff',
  };

  const SKINS = {
    knight: { head: 'helmet', body: 'armor', item: 'sword',
      c: { head: '#f1f1f4', headShade: '#c4c6d4', body: '#a3abc0', bodyShade: '#717a92', leg: '#5b6178', boot: '#363a4a', hand: '#717a92' } },
    office: { head: 'face', hat: 'hair', body: 'shirt', item: 'mug',
      c: { skin: '#f2c9a0', hair: '#3a2a20', body: '#f4f4f6', bodyShade: '#c9ccd6', leg: '#3b4256', boot: '#1f2330', hand: '#f2c9a0' } },
    mage: { head: 'face', hat: 'wizard', beard: true, body: 'robe', item: 'staff',
      c: { skin: '#f2c9a0', hair: '#e8e2d0', hat: '#4b3fa3', body: '#5b4bb7', bodyShade: '#3f3384', leg: '#3f3384', boot: '#2b2240', hand: '#f2c9a0' } },
    cat: { head: 'cat', body: 'fur', item: 'none', tail: true,
      c: { body: '#f0a35e', bodyShade: '#c97c3a', belly: '#fbe3c4', leg: '#f0a35e', boot: '#c97c3a', hand: '#fbe3c4' } },
    robot: { head: 'robot', body: 'metal', item: 'wrench',
      c: { head: '#b8c0cc', body: '#b8c0cc', bodyShade: '#7d8796', leg: '#7d8796', boot: '#4a525e', hand: '#7d8796' } },
    ninja: { head: 'ninja', body: 'gi', item: 'kunai',
      c: { skin: '#f2c9a0', head: '#2b2f45', body: '#2b2f45', bodyShade: '#1c1f30', leg: '#2b2f45', boot: '#14161f', hand: '#1c1f30' } },
    chef: { head: 'face', hat: 'chef', body: 'apron', item: 'ladle',
      c: { skin: '#f2c9a0', hair: '#6b4423', body: '#f7f7f7', bodyShade: '#cfd3dc', leg: '#3b4256', boot: '#1f2330', hand: '#f2c9a0' } },
    astronaut: { head: 'astronaut', body: 'suit', item: 'none', backpack: true,
      c: { head: '#f4f6fa', body: '#f4f6fa', bodyShade: '#c3c9d6', leg: '#e6e9f0', boot: '#8a93a6', hand: '#c3c9d6' } },
  };

  // ---- Detail grid -----------------------------------------------------------
  // Art is authored on a grid twice as fine as the logical one: a 32x28 character is 64x56 fine pixels.
  // Shapes are mostly written in logical pixels and doubled; the `fine` extras add the half-pixel
  // detail (catchlights, rivets, seams, strands, stitching) that the coarse grid can't hold.
  const RES = 2;
  const SH = 'rgba(16,12,40,0.22)';
  const SH2 = 'rgba(16,12,40,0.4)';
  const HL = 'rgba(255,255,255,0.32)';
  const HL2 = 'rgba(255,255,255,0.65)';
  const d2 = ([x, y, w, h, c]) => [x * RES, y * RES, w * RES, h * RES, c];

  // grp(rects, details, fine, fineRects): rects/details in logical px, fine/fineRects in fine px.
  // fineRects join the outlined silhouette (used to round off corners); fine are drawn on top.
  const grouper = (groups) => (rects, details = [], fine = [], fineRects = []) => groups.push({
    rects: [...rects.map(d2), ...fineRects],
    details: [...details.map(d2), ...fine],
  });

  // A four-point twinkle centred on logical (x, y).
  const twinkle = (x, y, color) => [[x * RES, y * RES - 1, 1, 3, color], [x * RES - 1, y * RES, 3, 1, color]];
  const glow = (color) => `*${color}`;

  // ---- Character -------------------------------------------------------------

  function buildCharacter(skinId, pose, frame, col, opts = {}) {
    const sk = SKINS[skinId] || SKINS.knight;
    const c = sk.c;
    const prop = opts.prop !== false;
    const groups = [];
    const grp = grouper(groups);
    const sleeping = pose === 'sleep';

    let dy = 0;
    if (pose === 'rest' || pose === 'read') dy = frame;
    if (pose === 'walk') dy = frame ? -1 : 0;
    if (pose === 'dance') dy = frame ? -1 : 1;
    if (sleeping) dy = 2 + frame;
    const F = dy * RES;

    // --- Behind the body: props, tails, backpacks.
    if (sleeping && (sk.item === 'sword' || sk.item === 'staff')) {
      if (sk.item === 'sword') {
        grp([[1, 25, 8, 1, PAL.blade], [9, 24, 1, 3, PAL.gold], [10, 25, 3, 1, PAL.grip]], [],
          [[3, 50, 15, 1, HL2], [2, 51, 16, 1, PAL.bladeShade], [18, 50, 2, 2, '#e0405a'], [22, 50, 1, 2, SH2], [24, 50, 1, 2, SH2]]);
      } else {
        grp([[0, 25, 13, 1, PAL.wood], [13, 24, 3, 3, col.main]], [],
          [[0, 51, 26, 1, PAL.woodDark], [6, 50, 1, 2, SH], [16, 50, 1, 2, SH], [27, 49, 2, 2, HL2], [28, 50, 3, 3, glow(col.main)]]);
      }
    }
    if (pose === 'hammer' && prop) {
      grp([[22, 21, 8, 2, PAL.anvilTop], [24, 23, 4, 2, PAL.anvil], [23, 25, 6, 2, PAL.anvil]], [[22, 21, 8, 1, PAL.anvilShine]],
        [[44, 43, 16, 1, SH], [48, 46, 8, 1, SH2], [47, 50, 10, 1, HL], [46, 53, 12, 1, SH]], [[40, 42, 4, 3, PAL.anvilTop]]);
    }
    if (pose === 'type' && prop) {
      grp([[20, 21, 10, 2, PAL.wood], [21, 23, 1, 4, PAL.woodDark], [28, 23, 1, 4, PAL.woodDark]], [[20, 22, 10, 1, PAL.woodDark]],
        [[41, 42, 18, 1, HL], [44, 43, 6, 1, 'rgba(0,0,0,0.15)'], [52, 42, 5, 1, 'rgba(0,0,0,0.12)'], [42, 46, 2, 8, SH], [56, 46, 2, 8, SH]]);
      const keys = [];
      for (let i = 0; i < 6; i++) keys.push([45 + i * 2, 40, 1, 1, (i + frame) % 4 ? '#8a91a3' : PAL.shine]);
      grp([[22, 20, 7, 1, '#c9ced8'], [27, 14, 2, 6, '#3a3f4c']], [[27, 15, 1, 4, PAL.screen]],
        [...keys, [54, 29, 1, 10, '#2a2e3a'], [55, 30, 1, 8, glow(PAL.screen)], [55, 31 + frame * 3, 1, 1, PAL.shine], [57, 29, 1, 10, SH]]);
    }
    if (pose === 'paint' && prop) {
      grp([[24, 12, 1, 15, PAL.wood], [29, 12, 1, 15, PAL.wood]], [], [[49, 24, 1, 30, PAL.woodDark], [59, 24, 1, 30, PAL.woodDark]]);
      grp([[22, 9, 9, 9, PAL.page]], [
        [24, 11, 3, 1, col.main], [25, 13, 4, 1, '#5aa7ff'], [23, 15, 2, 1, '#7cc47f'],
        ...(frame ? [[27, 11, 2, 2, PAL.spark]] : [[23, 12, 1, 2, '#e0405a']]),
      ], [[44, 34, 18, 2, SH], [60, 18, 2, 18, SH], [52, 30, 2, 1, '#ffd65a'], [46, 32, 3, 1, '#c27bff'], [57, 25, 1, 2, '#e0405a'], [50, 24, 3, 1, col.dark], [45, 19, 4, 1, HL2]]);
    }
    if (sk.tail) {
      grp([[4, 15 + dy, 2, 5, c.body], [5, 19 + dy, 4, 2, c.body]], [[4, 15 + dy, 2, 1, c.bodyShade]],
        [[8, 34 + F, 4, 1, c.bodyShade], [8, 37 + F, 4, 1, c.bodyShade], [11, 39 + F, 1, 2, c.bodyShade], [14, 39 + F, 1, 2, c.bodyShade], [9, 32 + F, 1, 5, HL]]);
    }
    if (sk.backpack) {
      grp([[6, 17 + dy, 3, 6, c.body]], [[6, 18 + dy, 1, 4, c.bodyShade]],
        [[13, 36 + F, 4, 1, HL], [14, 40 + F, 3, 3, '#8a93a6'], [15, 41 + F, 1, 1, glow('#3dffb0')], [17, 35 + F, 1, 10, SH2]]);
    }

    // --- Hat pieces that sit behind the head.
    if (sk.head === 'helmet') {
      grp([[13, 4 + dy, 4, 1, col.main], [11, 5 + dy, 6, 1, col.main], [10, 6 + dy, 5, 1, col.dark]], [],
        [[28, 8 + F, 4, 1, HL2], [24, 10 + F, 6, 1, HL], [22, 13 + F, 5, 1, SH], [32, 9 + F, 1, 1, col.dark], [19, 12 + F, 2, 1, col.main]], [[32, 7 + F, 2, 2, col.main]]);
    }
    if (sk.head === 'cat') {
      grp([[9, 6 + dy, 3, 3, c.body], [16, 6 + dy, 3, 3, c.body]], [[10, 7 + dy, 1, 2, '#f6b8b8'], [17, 7 + dy, 1, 2, '#f6b8b8']],
        [[20, 12 + F, 1, 1, '#f6b8b8'], [34, 12 + F, 1, 1, '#f6b8b8'], [19, 11 + F, 1, 2, HL]], [[19, 10 + F, 3, 2, c.body], [33, 10 + F, 3, 2, c.body]]);
    }
    if (sk.head === 'robot') {
      grp([[13, 5 + dy, 1, 3, c.bodyShade], [12, 3 + dy, 3, 2, c.head]], [[13, 3 + dy, 1, 1, col.main]],
        [[25, 7 + F, 1, 1, HL2], [26, 7 + F, 2, 2, glow(col.main)], [27, 12 + F, 1, 4, SH]]);
    }

    // --- Back arm.
    const backUp = pose === 'dangle' || (pose === 'dance' && frame === 0);
    if (backUp) grp([[7, 11, 2, 8, c.bodyShade]], [], [[14, 22, 4, 3, c.hand], [14, 25, 4, 1, SH], [17, 26, 1, 12, SH]]);
    else grp([[7, 18 + dy, 2, 4, c.bodyShade]], [], [[14, 41 + F, 4, 3, c.hand], [14, 41 + F, 4, 1, SH], [14, 37 + F, 1, 4, HL]]);

    // --- Legs.
    const legs = {
      walk: frame ? [[9, 23, 3, 3], [16, 23, 3, 4]] : [[10, 23, 3, 4], [15, 23, 3, 4]],
      dangle: [[11, 23, 2, 4], [15, 23, 2, 4]],
      sleep: [[15, 24, 7, 2]],
    }[pose] || [[10, 23, 3, 4], [15, 23, 3, 4]];
    const legFine = sleeping
      ? [[30, 48, 12, 1, HL], [30, 51, 14, 1, SH]]
      : legs.flatMap(([x, y, w, h]) => {
        const [X, Y, Wd, Hd] = [x * RES, y * RES, w * RES, h * RES];
        return [[X + Wd - 1, Y, 1, Hd - 3, SH], [X + 1, Y + 1, 1, 2, HL], [X, Y + Hd - 1, Wd, 1, SH2], [X + 1, Y + Hd - 3, 2, 1, HL], [X, Y + Hd - 4, Wd, 1, SH]];
      });
    grp(
      legs.map((r) => [...r, c.leg]),
      legs.map(([x, y, w, h]) => (sleeping ? [x + w - 1, y, 1, h, c.boot] : [x, y + h - 1, w, 1, c.boot])),
      legFine,
    );

    // --- Torso.
    const ty = 18 + dy;
    const TY = ty * RES;
    const torsoLight = [[36, TY + 1, 1, 9, HL], [18, TY + 11, 20, 1, SH]];
    switch (sk.body) {
      case 'armor':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty, 6, 6, col.main], [11, ty + 5, 6, 1, col.dark], [9, ty + 3, 10, 1, PAL.belt], [13, ty + 3, 2, 1, PAL.gold]], [
          ...torsoLight, [20, TY, 16, 1, SH], [27, TY + 1, 2, 4, HL], [25, TY + 2, 6, 1, HL], [32, TY, 2, 6, SH], [32, TY + 8, 2, 2, SH],
          [20, TY + 1, 1, 1, HL2], [36, TY + 2, 1, 1, PAL.shine], [20, TY + 9, 1, 1, HL2], [27, TY + 7, 2, 1, '#fff3b0'], [22, TY + 11, 12, 1, col.dark],
        ]);
        break;
      case 'robe':
        grp([[9, ty, 10, 6, c.body], [8, ty + 4, 12, 4, c.body]], [[9, ty, 1, 7, c.bodyShade], [13, ty, 2, 8, c.bodyShade], [8, ty + 7, 12, 1, col.main]], [
          ...torsoLight, [18, TY + 6, 20, 2, col.dark], [27, TY + 6, 2, 2, PAL.gold], [22, TY + 9, 1, 5, SH], [33, TY + 9, 1, 5, SH],
          [31, TY + 3, 1, 1, PAL.spark], [35, TY + 10, 1, 1, PAL.spark], [20, TY + 11, 1, 1, PAL.spark],
          [17, TY + 15, 2, 1, HL2], [23, TY + 15, 2, 1, HL2], [29, TY + 15, 2, 1, HL2], [35, TY + 15, 2, 1, HL2],
        ]);
        break;
      case 'shirt':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [13, ty, 2, 1, col.dark], [13, ty + 1, 2, 3, col.main], [9, ty + 4, 10, 1, '#3b3b45']], [
          ...torsoLight, [22, TY, 4, 2, '#ffffff'], [30, TY, 4, 2, '#ffffff'], [22, TY + 2, 3, 1, SH], [31, TY + 2, 3, 1, SH],
          [26, TY + 4, 4, 1, SH], [26, TY + 6, 4, 1, SH], [32, TY + 3, 3, 3, SH], [33, TY + 2, 1, 2, '#5aa7ff'], [27, TY + 8, 3, 2, '#c9ced8'], [28, TY + 8, 1, 1, PAL.shine],
        ]);
        break;
      case 'fur':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [12, ty + 1, 6, 4, c.belly], [9, ty, 10, 1, col.main], [14, ty + 1, 2, 1, PAL.gold]], [
          ...torsoLight, [28, TY + 2, 1, 1, HL2], [29, TY + 3, 2, 1, '#b07a20'], [26, TY + 5, 1, 1, '#ffffff'], [31, TY + 7, 1, 1, '#ffffff'],
          [19, TY + 4, 3, 1, c.bodyShade], [19, TY + 7, 3, 1, c.bodyShade], [24, TY + 9, 12, 1, SH],
        ]);
        break;
      case 'metal':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty + 1, 6, 3, '#2c3442'], [12, ty + 2, 1, 1, col.main], [14, ty + 2, 1, 1, '#5ef0ff'], [16, ty + 2, 1, 1, PAL.spark]], [
          ...torsoLight, [21, TY + 1, 1, 1, SH2], [36, TY + 1, 1, 1, SH2], [21, TY + 10, 1, 1, SH2], [36, TY + 10, 1, 1, SH2],
          [24, TY + 4, 2, 2, glow(col.main)], [28, TY + 4, 2, 2, glow('#5ef0ff')], [32, TY + 4, 2, 2, glow(PAL.spark)],
          [22, TY + 9, 12, 1, SH], [22, TY + 11, 12, 1, SH], [22, TY + 2, 12, 1, HL],
        ]);
        break;
      case 'gi':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [12, ty, 1, 3, '#3d4361'], [15, ty, 1, 3, '#3d4361'], [9, ty + 3, 10, 1, col.main]], [
          ...torsoLight, [26, TY + 1, 2, 1, '#3d4361'], [28, TY + 3, 2, 1, '#3d4361'], [28, TY + 6, 3, 2, col.dark],
          [28, TY + 8, 1, 3, col.main], [31, TY + 8, 1, 2, col.main], [22, TY + 9, 1, 3, SH], [34, TY + 9, 1, 3, SH],
        ]);
        break;
      case 'apron':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty + 1, 6, 5, '#ffffff'], [10, ty, 8, 1, col.main]], [
          ...torsoLight, [24, TY, 8, 2, '#e0405a'], [27, TY + 2, 2, 2, '#e0405a'], [25, TY + 7, 6, 3, 'rgba(0,0,0,0.06)'], [25, TY + 7, 6, 1, SH],
          [20, TY + 3, 1, 1, SH2], [20, TY + 7, 1, 1, SH2], [35, TY + 3, 1, 1, SH2], [35, TY + 7, 1, 1, SH2],
        ]);
        break;
      case 'suit':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty + 1, 2, 2, col.main], [9, ty + 4, 10, 1, '#8a93a6']], [
          ...torsoLight, [23, TY + 3, 2, 1, HL2], [28, TY + 2, 6, 4, '#c3c9d6'], [29, TY + 3, 1, 1, glow('#ff5f5f')],
          [31, TY + 3, 1, 1, glow('#3dffb0')], [29, TY + 5, 4, 1, '#8a93a6'], [27, TY + 8, 4, 2, '#5a6378'], [20, TY, 16, 1, SH],
        ]);
        break;
      default:
        grp([[9, ty, 10, 6, c.body]], [], torsoLight);
    }

    // --- Head.
    const hy = dy;
    const HY = hy * RES;
    // Eyes at logical (x, y): a 2x4 fine eye with a catchlight, or a closed curve while asleep.
    const eyesF = (x1, x2, y, color = PAL.line, h = 4) => [x1, x2].flatMap((x) => (sleeping
      ? [[x * RES - 2, y * RES + 2, 4, 1, color], [x * RES - 3, y * RES + 1, 1, 1, color], [x * RES + 2, y * RES + 1, 1, 1, color]]
      : [[x * RES, y * RES, 2, h, color], [x * RES, y * RES, 1, 1, PAL.shine]]));
    const roundHead = (color, details, fine = []) => grp([[9, 8 + hy, 10, 10, color], [8, 9 + hy, 12, 8, color]], details,
      [[17, 22 + HY, 1, 10, SH], [18, 34 + HY, 20, 1, SH], [38, 19 + HY, 1, 6, HL], ...fine], [[17, 17 + HY, 22, 18, color]]);
    switch (sk.head) {
      case 'helmet':
        roundHead(c.head, [
          [9, 17 + hy, 10, 1, c.headShade], [8, 15 + hy, 1, 2, c.headShade], [10, 9 + hy, 2, 1, PAL.shine], [9, 10 + hy, 1, 2, PAL.shine],
          [11, 11 + hy, 8, 2, PAL.line], [14, 13 + hy, 2, 5, PAL.line],
        ], [
          [24, 17 + HY, 8, 1, HL2], [22, 21 + HY, 16, 1, SH], [23, 23 + HY, 15, 1, '#34304a'], [34, 24 + HY, 2, 1, glow(col.main)],
          [34, 28 + HY, 1, 1, PAL.line], [36, 28 + HY, 1, 1, PAL.line], [34, 30 + HY, 1, 1, PAL.line], [36, 30 + HY, 1, 1, PAL.line],
          [34, 32 + HY, 1, 1, PAL.line], [36, 32 + HY, 1, 1, PAL.line], [19, 26 + HY, 1, 1, '#8b90a3'], [19, 30 + HY, 1, 1, '#8b90a3'],
          [17, 32 + HY, 22, 1, SH], [29, 27 + HY, 1, 8, '#3a3550'],
        ]);
        break;
      case 'face':
        roundHead(c.skin, [[13, 14 + hy, 1, 1, PAL.blush], [18, 14 + hy, 1, 1, PAL.blush], [10, 13 + hy, 1, 2, '#d9a77c']], [
          ...eyesF(14, 17, 12 + hy), [27, 22 + HY, 3, 1, SH2], [33, 22 + HY, 3, 1, SH2], [32, 31 + HY, 3, 1, '#b0705a'],
          [39, 26 + HY, 1, 2, '#e3b58a'], [21, 27 + HY, 1, 2, '#c48f66'], [26, 29 + HY, 1, 1, HL], [36, 29 + HY, 1, 1, HL],
        ]);
        if (sk.hat === 'hair') {
          grp([[8, 7 + hy, 12, 3, c.hair], [8, 9 + hy, 3, 6, c.hair]], [[12, 10 + hy, 7, 1, c.hair]], [
            [21, 15 + HY, 1, 4, 'rgba(0,0,0,0.25)'], [27, 14 + HY, 1, 4, 'rgba(0,0,0,0.25)'], [33, 15 + HY, 1, 3, 'rgba(0,0,0,0.25)'],
            [23, 15 + HY, 6, 1, HL], [17, 22 + HY, 1, 6, 'rgba(0,0,0,0.2)'], [25, 21 + HY, 2, 1, c.hair], [31, 21 + HY, 2, 1, c.hair],
          ], [[18, 13 + HY, 20, 1, c.hair], [16, 29 + HY, 3, 2, c.hair]]);
        }
        if (sk.hat === 'wizard') {
          if (sk.beard) {
            grp([[11, 14 + hy, 8, 4, c.hair], [12, 18 + hy, 6, 1, c.hair]], [], [
              [25, 30 + HY, 1, 6, 'rgba(0,0,0,0.12)'], [29, 31 + HY, 1, 6, 'rgba(0,0,0,0.12)'], [34, 30 + HY, 1, 6, 'rgba(0,0,0,0.12)'],
              [24, 28 + HY, 14, 1, 'rgba(0,0,0,0.12)'], [31, 29 + HY, 3, 1, '#b0705a'], [23, 29 + HY, 1, 4, HL],
            ], [[26, 38 + HY, 8, 1, c.hair]]);
          }
          grp([[7, 7 + hy, 14, 2, c.hat], [10, 5 + hy, 8, 2, c.hat], [11, 3 + hy, 6, 2, c.hat], [13, 1 + hy, 3, 2, c.hat], [15, 0 + hy, 2, 1, c.hat]],
            [[10, 6 + hy, 8, 1, col.main], [13, 3 + hy, 1, 1, PAL.spark]], [
              [26, 12 + HY, 3, 2, PAL.gold], [27, 12 + HY, 1, 1, PAL.shine], [24, 7 + HY, 1, 1, PAL.spark], [31, 9 + HY, 1, 1, PAL.shine],
              [19, 15 + HY, 1, 1, PAL.spark], [36, 15 + HY, 1, 1, PAL.shine], [14, 17 + HY, 28, 1, SH], [22, 8 + HY, 1, 4, SH], [30, 2 + HY, 1, 4, HL],
            ], [[34, 1 + HY, 2, 1, c.hat]]);
        }
        if (sk.hat === 'chef') {
          grp([[8, 9 + hy, 2, 3, c.hair]], [], [[17, 19 + HY, 1, 4, 'rgba(0,0,0,0.25)']]);
          grp([[9, 4 + hy, 10, 5, '#ffffff'], [8, 2 + hy, 12, 3, '#ffffff'], [10, 1 + hy, 8, 1, '#ffffff']], [[9, 7 + hy, 10, 1, '#e3e6ec']], [
            [22, 8 + HY, 1, 6, '#e3e6ec'], [28, 6 + HY, 1, 8, '#e3e6ec'], [34, 8 + HY, 1, 6, '#e3e6ec'], [18, 4 + HY, 10, 1, PAL.shine], [18, 17 + HY, 20, 1, SH],
          ], [[17, 3 + HY, 22, 2, '#ffffff']]);
        }
        break;
      case 'cat':
        roundHead(c.body, [
          [12, 8 + hy, 1, 2, c.bodyShade], [14, 8 + hy, 1, 3, c.bodyShade], [16, 8 + hy, 1, 2, c.bodyShade],
          [14, 14 + hy, 5, 2, c.belly],
        ], [
          ...eyesF(14, 17, 12 + hy, '#2a3a2a'), [32, 28 + HY, 2, 2, '#e07a7a'], [32, 30 + HY, 1, 1, '#b07050'],
          [30, 31 + HY, 2, 1, '#b07050'], [34, 31 + HY, 2, 1, '#b07050'], [36, 28 + HY, 2, 1, '#f6b8b8'],
          [38, 27 + HY, 4, 1, '#5a4a3a'], [38, 30 + HY, 4, 1, '#5a4a3a'], [18, 26 + HY, 2, 1, c.bodyShade], [18, 29 + HY, 2, 1, c.bodyShade],
        ]);
        break;
      case 'robot':
        grp([[8, 8 + hy, 12, 10, c.head]], [
          [10, 11 + hy, 9, 4, '#1b2b3a'],
          [8, 12 + hy, 1, 2, c.bodyShade], [12, 16 + hy, 6, 1, c.bodyShade], [9, 9 + hy, 2, 1, PAL.shine],
        ], [
          ...(sleeping ? [[24, 26 + HY, 4, 1, glow('#5ef0ff')], [32, 26 + HY, 4, 1, glow('#5ef0ff')]]
            : [[24, 24 + HY, 4, 4, glow('#5ef0ff')], [32, 24 + HY, 4, 4, glow('#5ef0ff')], [24, 24 + HY, 1, 1, PAL.shine], [32, 24 + HY, 1, 1, PAL.shine]]),
          [21, 23 + HY, 16, 1, 'rgba(94,240,255,0.15)'], [21, 27 + HY, 16, 1, 'rgba(94,240,255,0.1)'],
          [17, 17 + HY, 1, 1, SH2], [38, 17 + HY, 1, 1, SH2], [17, 34 + HY, 1, 1, SH2], [38, 34 + HY, 1, 1, SH2],
          [25, 33 + HY, 1, 1, '#4a525e'], [28, 33 + HY, 1, 1, '#4a525e'], [31, 33 + HY, 1, 1, '#4a525e'], [34, 33 + HY, 1, 1, '#4a525e'],
          [39, 18 + HY, 1, 16, SH], [20, 17 + HY, 8, 1, HL],
        ]);
        break;
      case 'ninja':
        roundHead(c.head, [[11, 11 + hy, 8, 3, c.skin], [8, 9 + hy, 12, 1, col.main]], [
          ...(sleeping ? eyesF(14, 17, 12 + hy) : [[28, 24 + HY, 2, 2, PAL.line], [34, 24 + HY, 2, 2, PAL.line], [28, 24 + HY, 1, 1, PAL.shine], [34, 24 + HY, 1, 1, PAL.shine]]),
          [27, 22 + HY, 3, 1, SH2], [33, 22 + HY, 3, 1, SH2], [16, 18 + HY, 24, 1, HL], [22, 27 + HY, 16, 1, SH], [24, 32 + HY, 12, 1, SH],
        ]);
        grp([[5, 9 + hy, 3, 1, col.main], [4, 10 + hy, 3, 1, col.main]], [],
          [[16, 18 + HY, 3, 3, col.dark], [frame ? 6 : 7, 22 + HY, 4, 1, col.dark]], [[frame ? 5 : 6, 21 + HY, 3, 2, col.main]]);
        break;
      case 'astronaut':
        grp([[9, 7 + hy, 10, 11, c.head], [8, 8 + hy, 12, 9, c.head]], [
          [10, 10 + hy, 9, 6, '#2a3b66'], [11, 11 + hy, 2, 1, '#9fb8ff'], [11, 12 + hy, 1, 1, '#9fb8ff'], [9, 8 + hy, 2, 1, PAL.shine],
        ], [
          [20, 28 + HY, 18, 4, 'rgba(0,0,0,0.25)'], [23, 21 + HY, 5, 1, '#cfe0ff'], [33, 25 + HY, 1, 1, PAL.shine], [30, 23 + HY, 1, 1, '#9fb8ff'],
          [18, 34 + HY, 20, 1, '#c3c9d6'], [17, 24 + HY, 2, 3, glow('#ff5f5f')], [38, 18 + HY, 1, 14, SH],
        ], [[17, 15 + HY, 22, 20, c.head]]);
        break;
    }

    // --- Front arm and whatever it holds.
    const arm = (rects) => {
      const hand = rects.length > 1 ? rects.length - 1 : -1;
      const shade = rects.flatMap(([x, y, w, h], i) => (i === hand
        ? [[x * RES, (y + h) * RES - 1, w * RES, 1, SH]]
        : [[(x + w) * RES - 1, y * RES, 1, h * RES, SH], [x * RES, y * RES, 1, h * RES, HL]]));
      grp(rects.map((r, i) => [...r, i === hand ? c.hand : c.body]), [], shade);
    };
    const sword = (X, Y) => groups.push({
      rects: [[X, Y + 2, 4, 20, PAL.blade], [X + 1, Y, 2, 2, PAL.blade], [X - 4, Y + 22, 12, 2, PAL.gold], [X, Y + 24, 4, 4, PAL.grip], [X + 1, Y + 28, 2, 2, PAL.gold]],
      details: [[X + 2, Y + 2, 2, 20, PAL.bladeShade], [X + 1, Y + 3, 1, 17, HL2], [X + 1, Y + 22, 2, 2, '#e0405a'], [X - 3, Y + 22, 2, 1, HL2], [X, Y + 25, 4, 1, SH2], [X, Y + 27, 4, 1, SH2]],
    });
    const toolUp = () => {
      if (sk.item === 'sword') {
        groups.push({ rects: [[38, 4, 4, 12, PAL.blade], [39, 2, 2, 2, PAL.blade], [34, 16, 12, 2, PAL.gold], [38, 18, 4, 4, PAL.grip]],
          details: [[40, 4, 2, 12, PAL.bladeShade], [39, 5, 1, 9, HL2], [39, 16, 2, 2, '#e0405a'], [38, 19, 4, 1, SH2], [38, 21, 4, 1, SH2], [35, 16, 2, 1, HL2]] });
      } else if (sk.item === 'staff') {
        grp([[19, 2, 2, 9, PAL.wood]], [], [[40, 6, 2, 16, PAL.woodDark], [38, 12, 4, 2, col.dark]]);
        grp([[18, 0, 4, 3, col.main]], [[18, 0, 1, 1, PAL.shine]], [[38, 1, 4, 4, glow(col.main)], [37, 1, 2, 1, HL2]]);
      } else {
        grp([[19, 3, 2, 7, PAL.wood]], [], [[39, 8, 1, 10, 'rgba(0,0,0,0.2)']]);
        grp([[17, 1, 6, 3, PAL.steelDark]], [[17, 1, 6, 1, PAL.steel]], [[36, 2, 1, 4, SH2], [44, 2, 1, 4, SH2], [35, 2, 2, 1, PAL.shine]]);
      }
      arm([[19, 12, 2, 7], [19, 10, 2, 2]]);
    };
    const sparks = (pts) => grp([], [], pts.flatMap(([x, y, color]) => twinkle(x, y, color)));
    const note = (x, y, color) => [[x, y, 1, 6, color], [x + 1, y, 2, 1, color], [x + 2, y + 1, 1, 1, color], [x - 3, y + 5, 3, 2, color]];

    switch (pose) {
      case 'done':
        if (sk.item === 'sword' || sk.item === 'staff') toolUp();
        else arm([[19, 12, 2, 7], [19, 10, 2, 2]]);
        sparks(frame
          ? [[16, 1, PAL.shine], [23, 3, PAL.spark], [15, 5, PAL.spark], [24, 0, PAL.spark]]
          : [[17, 3, PAL.spark], [23, 1, PAL.shine], [24, 5, PAL.spark], [16, 0, PAL.spark]]);
        break;
      case 'hammer':
        if (frame === 0) {
          toolUp();
        } else {
          arm([[19, 18, 4, 2], [22, 18, 2, 2]]);
          if (sk.item === 'sword') {
            grp([[24, 17, 1, 4, PAL.gold], [25, 18, 5, 2, PAL.blade]], [[25, 19, 5, 1, PAL.bladeShade]], [[51, 36, 8, 1, HL2], [48, 37, 2, 2, '#e0405a']], [[60, 37, 1, 2, PAL.blade]]);
          } else {
            grp([[24, 18, 3, 2, PAL.wood]], [], [[48, 37, 6, 1, 'rgba(0,0,0,0.2)']]);
            grp([[27, 16, 3, 5, PAL.steelDark]], [[27, 16, 1, 5, PAL.steel]], [[54, 35, 6, 1, SH2], [54, 38, 6, 1, SH2], [55, 32, 1, 2, PAL.shine]]);
          }
          if (prop) sparks([[27, 14, PAL.spark], [30, 15, PAL.shine], [24, 14, PAL.spark], [29, 12, PAL.spark]]);
        }
        break;
      case 'type':
        arm([[19, 18, 4, 2], [22, 18 + frame, 2, 2]]);
        break;
      case 'paint':
        arm([[19, 16, 3, 2], [21, 16, 2, 2]]);
        grp([[23, 14 + frame, 3, 1, PAL.wood]], [[25, 14 + frame, 1, 1, col.main]], [[49, 28 + frame * 2, 1, 2, PAL.steel], [51, 28 + frame * 2, 1, 1, HL2]]);
        break;
      case 'read': {
        arm([[19, 18 + dy, 2, 3]]);
        const lines = [];
        for (let i = 0; i < 4; i++) {
          lines.push([37, 35 + i * 2 + F, i === 3 ? 3 : 5, 1, PAL.ink]);
          if (i !== (frame ? 1 : 3)) lines.push([45, 35 + i * 2 + F, i === 3 ? 3 : 5, 1, PAL.ink]);
        }
        groups.push({ rects: [[34, 32 + F, 18, 12, PAL.cover]], details: [
          [36, 34 + F, 6, 8, PAL.page], [44, 34 + F, 6, 8, PAL.page], [42, 33 + F, 2, 10, SH2], [41, 34 + F, 1, 8, SH], ...lines,
          [34, 32 + F, 18, 1, HL], [48, 42 + F, 1, 4, '#e0405a'], [35, 43 + F, 16, 1, SH2],
        ] });
        break;
      }
      case 'wait':
        arm([[19, 11, 2, 8], [19 + frame, 9, 3, 2]]);
        grp([], [], frame ? [[46, 14, 2, 1, HL2], [47, 18, 2, 1, HL2]] : [[36, 14, 2, 1, HL2], [35, 18, 2, 1, HL2]]);
        break;
      case 'dance':
        if (frame) arm([[19, 11, 2, 8], [19, 9, 2, 2]]);
        else arm([[19, 18 + dy, 2, 4]]);
        grp([], [], frame ? note(48, 11, col.main) : note(8, 7, col.main));
        break;
      case 'dangle':
        arm([[19, 11, 2, 8]]);
        break;
      case 'sleep':
        arm([[19, 19 + dy, 2, 3]]);
        break;
      default: { // rest / walk: holding the signature item
        const y = dy;
        switch (sk.item) {
          case 'sword':
            sword(42, 16 + F);
            break;
          case 'staff':
            grp([[21, 5 + y, 2, 18, PAL.wood]], [[22, 5 + y, 1, 18, PAL.woodDark]], [[43, 14 + F, 1, 3, 'rgba(0,0,0,0.2)'], [42, 26 + F, 1, 4, 'rgba(0,0,0,0.2)'], [42, 30 + F, 4, 2, col.dark]]);
            grp([[20, 2 + y, 4, 3, col.main]], [[20, 2 + y, 1, 1, PAL.shine]], [[42, 5 + F, 4, 4, glow(col.main)], [41, 5 + F, 2, 1, HL2]], [[41, 3 + F, 6, 8, col.main]]);
            break;
          case 'mug':
            grp([[22, 18 + y, 4, 4, '#ffffff'], [26, 19 + y, 1, 2, '#ffffff']], [[22, 18 + y, 4, 1, PAL.grip]],
              [[44, 41 + F, 8, 1, col.main], [44, 43 + F, 8, 1, col.main], [50, 38 + F, 1, 6, SH], [45, 38 + F, 2, 1, '#9a6a3c']]);
            if (frame) grp([], [], [[46, 31 + F, 1, 2, '#e6e9f0'], [47, 29 + F, 1, 2, '#e6e9f0'], [46, 27 + F, 1, 2, '#e6e9f0'], [49, 30 + F, 1, 2, '#e6e9f0'], [50, 28 + F, 1, 2, '#e6e9f0']]);
            break;
          case 'wrench':
            grp([[21, 12 + y, 2, 9, PAL.steel], [20, 10 + y, 4, 2, PAL.steel]], [[21, 10 + y, 2, 1, PAL.line]], [[42, 26 + F, 1, 14, HL2], [45, 24 + F, 1, 18, SH2], [42, 30 + F, 4, 1, SH]]);
            break;
          case 'kunai':
            grp([[21, 14 + y, 1, 6, '#c9d1dc'], [21, 20 + y, 1, 2, PAL.grip]], [], [[42, 29 + F, 1, 9, HL2], [42, 41 + F, 2, 1, SH2]], [[41, 44 + F, 4, 2, PAL.steel]]);
            break;
          case 'ladle':
            grp([[21, 10 + y, 1, 11, PAL.steel], [20, 8 + y, 3, 2, PAL.steel]], [], [[41, 16 + F, 2, 1, HL2], [42, 22 + F, 1, 18, HL]]);
            break;
        }
        arm([[19, 18 + y, 2, 3], [20, 20 + y, 2, 2]]);
      }
    }

    // --- Accessory on top of everything.
    const ay = dy;
    const A = ay * RES;
    switch (opts.accessory) {
      case 'crown':
        grp([[11, 5 + ay, 7, 3, PAL.gold], [11, 3 + ay, 1, 2, PAL.gold], [14, 3 + ay, 1, 2, PAL.gold], [17, 3 + ay, 1, 2, PAL.gold]], [[14, 6 + ay, 1, 1, '#e0405a']],
          [[22, 10 + A, 14, 1, HL2], [24, 13 + A, 2, 2, '#5aa7ff'], [32, 13 + A, 2, 2, '#7cc47f'], [22, 15 + A, 14, 1, SH], [28, 12 + A, 1, 1, PAL.shine]]);
        break;
      case 'partyhat':
        grp([[14, 1 + ay, 1, 1, col.main], [13, 2 + ay, 3, 2, col.main], [12, 4 + ay, 5, 2, col.main], [11, 6 + ay, 7, 2, col.main]], [[12, 5 + ay, 5, 1, '#ffffff'], [14, 0 + ay, 1, 1, '#ffffff']],
          [[27, 6 + A, 1, 1, '#ffe066'], [31, 13 + A, 1, 1, '#ffe066'], [25, 14 + A, 1, 1, '#ffe066'], [23, 15 + A, 12, 1, SH]]);
        break;
      case 'flower':
        grp([[17, 5 + ay, 3, 3, '#ff8fb1']], [[18, 6 + ay, 1, 1, '#ffe066']], [[35, 11 + A, 2, 1, '#ffd0e0'], [36, 13 + A, 1, 1, '#c7a020'], [39, 15 + A, 1, 1, SH]], [[33, 14 + A, 2, 2, '#4f9a4f']]);
        break;
      case 'glasses': {
        const ring = (x) => [[x, 22 + A, 6, 1, PAL.line], [x, 27 + A, 6, 1, PAL.line], [x, 22 + A, 1, 6, PAL.line], [x + 5, 22 + A, 1, 6, PAL.line], [x + 1, 23 + A, 4, 4, 'rgba(191,227,255,0.45)'], [x + 1, 23 + A, 1, 1, PAL.shine]];
        grp([], [], [...ring(26), ...ring(34), [32, 24 + A, 2, 1, PAL.line], [20, 24 + A, 6, 1, PAL.line]]);
        break;
      }
      case 'sunglasses':
        grp([], [], [[24, 22 + A, 8, 4, '#111111'], [34, 22 + A, 6, 4, '#111111'], [32, 23 + A, 2, 1, '#111111'], [18, 23 + A, 6, 1, '#111111'], [25, 23 + A, 2, 1, '#777777'], [35, 23 + A, 1, 1, '#777777']]);
        break;
      case 'headphones':
        grp([[9, 6 + ay, 10, 1, '#2b2b33']], [], [[20, 12 + A, 16, 1, '#55555f']]);
        grp([[9, 11 + ay, 3, 5, col.main]], [[9, 11 + ay, 1, 5, col.dark]], [[21, 23 + A, 1, 6, HL2], [22, 26 + A, 1, 2, glow('#3dffb0')]]);
        break;
      case 'halo':
        grp([], [], [[22, 3 + A, 16, 1, glow('#ffe066')], [20, 4 + A, 2, 1, glow('#ffe066')], [38, 4 + A, 2, 1, glow('#ffe066')], [22, 5 + A, 16, 1, glow('#ffe066')]]);
        break;
      case 'bow':
        grp([[16, 6 + ay, 2, 2, '#ff6fa8'], [19, 6 + ay, 2, 2, '#ff6fa8'], [18, 6 + ay, 1, 2, '#ff6fa8']], [], [[36, 12 + A, 2, 4, '#e0508a'], [33, 13 + A, 2, 1, SH], [39, 13 + A, 2, 1, SH], [32, 12 + A, 1, 1, HL2]]);
        break;
    }
    return groups;
  }


  // ---- Mini characters (room mode) -------------------------------------------
  // 12x16 people on a 14x18 grid (1px margin for the outline), the same scale as Pixel Crew's office,
  // drawn on the fine grid (28x36) so faces and outfits get real detail.
  const MINI = { W: 14, H: 18, anchor: 6.5, feet: 16 };

  function buildMini(skinId, pose, frame, col, opts = {}) {
    const sk = SKINS[skinId] || SKINS.knight;
    const c = sk.c;
    const groups = [];
    const grp = grouper(groups);
    const sleeping = pose === 'sleep';
    let dy = 0;
    if (pose === 'rest' || pose === 'read') dy = frame;
    if (pose === 'walk') dy = frame ? -1 : 0;
    if (pose === 'dance') dy = frame ? -1 : 0;
    if (sleeping) dy = 2;
    const F = dy * RES;
    const headColor = sk.head === 'face' || sk.head === 'ninja' ? (sk.head === 'ninja' ? c.head : c.skin) : (c.head || c.body);

    if (sk.tail) grp([[2, 9 + dy, 1, 4, c.body]], [], [[4, 21 + F, 2, 1, c.bodyShade], [4, 24 + F, 2, 1, c.bodyShade], [4, 18 + F, 1, 3, HL]]);
    if (sk.backpack) grp([[2, 9 + dy, 2, 4, c.body]], [], [[4, 20 + F, 2, 2, '#8a93a6'], [5, 20 + F, 1, 1, glow('#3dffb0')], [7, 18 + F, 1, 8, SH]]);
    if (sk.head === 'helmet') grp([[5, 1 + dy, 3, 2, col.main]], [], [[11, 2 + F, 4, 1, HL2], [10, 5 + F, 3, 1, col.dark]], [[14, 1 + F, 2, 2, col.main]]);
    if (sk.head === 'cat') grp([[3, 2 + dy, 2, 2, c.body], [8, 2 + dy, 2, 2, c.body]], [], [[7, 5 + F, 1, 2, '#f6b8b8'], [17, 5 + F, 1, 2, '#f6b8b8']], [[7, 3 + F, 2, 1, c.body], [17, 3 + F, 2, 1, c.body]]);
    if (sk.head === 'robot') grp([[6, 1 + dy, 1, 2, c.bodyShade]], [[6, 1 + dy, 1, 1, col.main]], [[12, 2 + F, 2, 2, glow(col.main)]]);

    // back arm, legs, torso
    const armsUp = pose === 'dangle' || (pose === 'dance' && !frame);
    grp(armsUp ? [[3, 5, 1, 4, c.bodyShade]] : [[3, 9 + dy, 1, 3, c.bodyShade]], [], armsUp ? [[6, 10, 2, 2, c.hand]] : [[6, 22 + F, 2, 2, c.hand]]);
    const legs = pose === 'walk' && frame ? [[3, 13, 2, 3], [8, 13, 2, 2]]
      : sleeping ? [[6, 14, 5, 2]]
      : [[4, 13, 2, 3], [7, 13, 2, 3]];
    grp(legs.map((r) => [...r, c.leg]), legs.map(([x, y, w, h]) => (sleeping ? [x + w - 1, y, 1, h, c.boot] : [x, y + h - 1, w, 1, c.boot])),
      sleeping ? [[12, 28, 10, 1, HL]] : legs.flatMap(([x, y, w, h]) => [[(x + w) * RES - 1, y * RES, 1, h * RES - 2, SH], [x * RES, (y + h) * RES - 1, w * RES, 1, SH2], [x * RES + 1, (y + h) * RES - 2, 1, 1, HL]]));
    const ty = 9 + dy;
    const TY = ty * RES;
    const torso = sk.body === 'robe' ? [[4, ty, 5, 4, c.body], [3, ty + 2, 7, 3, c.body]] : [[4, ty, 5, 4, c.body]];
    const torsoDetail = {
      armor: [[5, ty, 3, 4, col.main], [4, ty + 2, 5, 1, PAL.belt]],
      robe: [[3, ty + 4, 7, 1, col.main]],
      shirt: [[6, ty, 1, 3, col.main]],
      fur: [[5, ty + 1, 3, 2, c.belly], [4, ty, 5, 1, col.main]],
      metal: [[5, ty + 1, 3, 1, '#2c3442'], [6, ty + 1, 1, 1, col.main]],
      gi: [[4, ty + 2, 5, 1, col.main]],
      apron: [[5, ty + 1, 3, 3, '#ffffff'], [4, ty, 5, 1, col.main]],
      suit: [[5, ty + 1, 1, 1, col.main], [4, ty + 3, 5, 1, '#8a93a6']],
    }[sk.body] || [];
    const torsoFine = {
      armor: [[13, TY + 4, 2, 2, PAL.gold], [13, TY + 4, 1, 1, PAL.shine], [12, TY + 1, 1, 3, HL], [15, TY, 1, 4, SH]],
      robe: [[13, TY + 3, 1, 1, PAL.spark], [10, TY + 6, 1, 1, PAL.spark], [8, TY + 4, 12, 1, col.dark], [12, TY + 6, 1, 3, SH]],
      shirt: [[10, TY, 2, 1, '#ffffff'], [14, TY, 2, 1, '#ffffff'], [12, TY, 2, 1, col.dark], [8, TY + 6, 10, 1, '#3b3b45']],
      fur: [[12, TY + 2, 2, 1, PAL.gold], [12, TY + 2, 1, 1, PAL.shine]],
      metal: [[10, TY + 2, 2, 2, glow(col.main)], [14, TY + 2, 1, 1, glow('#5ef0ff')], [9, TY + 6, 8, 1, SH]],
      gi: [[11, TY, 1, 4, '#3d4361'], [14, TY, 1, 4, '#3d4361'], [13, TY + 4, 2, 2, col.dark]],
      apron: [[11, TY, 4, 1, '#e0405a'], [12, TY + 5, 3, 1, SH]],
      suit: [[13, TY + 2, 3, 2, '#c3c9d6'], [14, TY + 2, 1, 1, glow('#3dffb0')]],
    }[sk.body] || [];
    grp(torso, torsoDetail, [...torsoFine, [17, TY + 1, 1, 5, HL], [8, TY + 7, 10, 1, SH]]);

    // head
    const hy = dy;
    const HY = hy * RES;
    const eye = sleeping
      ? [[14, 11 + HY, 4, 1, PAL.line], [13, 10 + HY, 1, 1, PAL.line], [18, 10 + HY, 1, 1, PAL.line]]
      : [[16, 9 + HY, 2, 3, PAL.line], [16, 9 + HY, 1, 1, PAL.shine]];
    const head = sk.head === 'robot' ? [[3, 3 + hy, 8, 5, headColor]]
      : sk.head === 'astronaut' ? [[4, 2 + hy, 6, 6, headColor], [3, 3 + hy, 8, 4, headColor]]
      : [[4, 3 + hy, 6, 5, headColor], [3, 4 + hy, 8, 3, headColor]];
    const headRound = sk.head === 'robot' ? [] : sk.head === 'astronaut' ? [[7, 5 + HY, 14, 10, headColor]] : [[7, 7 + HY, 14, 8, headColor]];
    const headDetail = {
      helmet: [[6, 5 + hy, 4, 1, PAL.line], [8, 6 + hy, 1, 2, PAL.line], [4, 4 + hy, 1, 1, PAL.shine]],
      face: [[9, 6 + hy, 1, 1, PAL.blush]],
      cat: [[9, 6 + hy, 1, 1, '#e07a7a'], [5, 3 + hy, 1, 1, c.bodyShade]],
      robot: [[5, 4 + hy, 5, 2, '#1b2b3a']],
      ninja: [[5, 5 + hy, 5, 1, c.skin], [3, 4 + hy, 8, 1, col.main]],
      astronaut: [[5, 4 + hy, 5, 3, '#2a3b66']],
    }[sk.head] || [];
    const headFine = {
      helmet: [[13, 10 + HY, 6, 1, '#34304a'], [19, 10 + HY, 1, 1, glow(col.main)], [10, 12 + HY, 1, 1, '#8b90a3'], [8, 7 + HY, 1, 1, PAL.shine], [7, 14 + HY, 14, 1, SH]],
      face: [...eye, [19, 13 + HY, 2, 1, '#b0705a'], [8, 11 + HY, 2, 2, '#d9a77c'], [15, 8 + HY, 3, 1, SH2], [7, 14 + HY, 14, 1, SH]],
      cat: [...eye, [19, 12 + HY, 2, 1, '#e07a7a'], [20, 13 + HY, 3, 1, '#5a4a3a'], [9, 7 + HY, 1, 2, c.bodyShade], [7, 14 + HY, 14, 1, SH]],
      robot: sleeping ? [[16, 11 + HY, 3, 1, glow('#5ef0ff')]] : [[16, 9 + HY, 2, 2, glow('#5ef0ff')], [16, 9 + HY, 1, 1, PAL.shine], [7, 7 + HY, 1, 1, SH2], [20, 7 + HY, 1, 1, SH2], [9, 14 + HY, 8, 1, SH]],
      ninja: [...eye.map((r) => (sleeping ? r : [r[0], r[1] + 1, r[2], r[3] === 3 ? 2 : r[3], r[4]])), [6, 8 + HY, 16, 1, HL], [5, 8 + HY, 2, 2, col.dark]],
      astronaut: [[10, 8 + HY, 3, 1, '#cfe0ff'], [10, 9 + HY, 1, 2, '#9fb8ff'], [17, 10 + HY, 1, 1, PAL.shine], [10, 13 + HY, 10, 1, 'rgba(0,0,0,0.25)']],
    }[sk.head] || eye;
    grp(head, headDetail, [...headFine, [20, 8 + HY, 1, 4, HL]], headRound);
    if (sk.head === 'ninja') grp([], [[1, 4 + hy, 2, 1, col.main]], [[frame ? 1 : 2, 10 + HY, 3, 1, col.dark]]);
    if (sk.hat === 'hair') grp([[3, 2 + hy, 7, 2, c.hair], [3, 3 + hy, 2, 3, c.hair]], [], [[10, 4 + HY, 1, 3, 'rgba(0,0,0,0.25)'], [15, 4 + HY, 1, 2, 'rgba(0,0,0,0.25)'], [8, 4 + HY, 4, 1, HL], [13, 7 + HY, 2, 1, c.hair]], [[7, 3 + HY, 12, 1, c.hair]]);
    if (sk.hat === 'wizard') grp([[2, 3 + hy, 9, 1, c.hat], [4, 1 + hy, 5, 2, c.hat], [5, 0 + hy, 3, 1, c.hat]], [[4, 2 + hy, 5, 1, col.main]], [[11, 2 + HY, 1, 1, PAL.spark], [14, 4 + HY, 2, 1, PAL.gold], [4, 7 + HY, 18, 1, SH]], [[16, 0 + HY, 2, 1, c.hat]]);
    if (sk.beard) grp([[6, 7 + hy, 4, 2, c.hair]], [], [[14, 15 + HY, 1, 3, 'rgba(0,0,0,0.12)'], [17, 15 + HY, 1, 3, 'rgba(0,0,0,0.12)'], [12, 14 + HY, 8, 1, 'rgba(0,0,0,0.1)']], [[14, 18 + HY, 4, 1, c.hair]]);
    if (sk.hat === 'chef') grp([[4, 0 + hy, 6, 3, '#ffffff']], [], [[11, 1 + HY, 1, 4, '#e3e6ec'], [15, 1 + HY, 1, 4, '#e3e6ec'], [9, 1 + HY, 4, 1, PAL.shine], [8, 5 + HY, 12, 1, SH]]);

    // front arm & item
    const arm = (rects) => grp(rects.map((r) => [...r, c.body]), [], rects.flatMap(([x, y, w, h]) => [[(x + w) * RES - 1, y * RES, 1, h * RES, SH]]));
    const spark = (pts) => grp([], [], pts.flatMap(([x, y, color]) => twinkle(x, y, color)));
    const hand = (x, y) => grp([], [], [[x, y, 2, 2, c.hand]]);
    switch (pose) {
      case 'type': case 'hammer': case 'paint':
        arm([[9, 9 + frame, 2, 1]]);
        hand(21, 18 + frame * 2);
        if (pose === 'hammer') grp([[11, 7 + frame * 2, 1, 2, PAL.steelDark]], [], [[22, 14 + frame * 4, 1, 4, PAL.steel]]);
        if (pose === 'paint') grp([], [[11, 9 + frame, 1, 1, col.main]], [[22, 18 + frame * 2, 1, 1, PAL.shine]]);
        break;
      case 'read':
        grp([[8, 9 + dy, 4, 3, PAL.cover]], [[9, 9 + dy, 1, 2, PAL.page], [11, 9 + dy, 1, 2, PAL.page]],
          [[18, 19 + F, 2, 1, PAL.ink], [22, 19 + F, 2, 1, PAL.ink], [18, 21 + F, 1, 1, PAL.ink], [22, 21 + F, 2, 1, PAL.ink], [20, 18 + F, 2, 5, SH2], [16, 23 + F, 8, 1, SH2]]);
        break;
      case 'wait':
        arm([[9, 5, 1, 4], [9 + frame, 4, 1, 1]]);
        hand(18 + frame * 2, 7);
        break;
      case 'done':
        arm([[9, 4, 1, 5]]);
        if (sk.item === 'sword') grp([], [], [[19, 2, 1, 6, HL2]], [[18, 1, 2, 7, PAL.blade], [16, 8, 6, 1, PAL.gold]]);
        hand(18, 8);
        spark(frame ? [[11, 1, PAL.spark], [7, 0, PAL.shine]] : [[12, 3, PAL.shine], [8, 1, PAL.spark]]);
        break;
      case 'dangle':
        arm([[9, 5, 1, 4]]);
        hand(18, 9);
        break;
      case 'dance':
        if (frame) { arm([[9, 5, 1, 4]]); hand(18, 9); } else { arm([[9, 9 + dy, 1, 3]]); hand(18, 23 + F); }
        grp([], [], frame ? [[24, 3, 1, 4, col.main], [25, 3, 1, 1, col.main], [22, 6, 2, 2, col.main]] : [[3, 3, 1, 4, col.main], [4, 3, 1, 1, col.main], [1, 6, 2, 2, col.main]]);
        break;
      case 'sleep':
        arm([[9, 10 + dy, 1, 2]]);
        break;
      default:
        if (sk.item === 'sword') groups.push({ rects: [[20, 11 + F, 2, 12, PAL.blade], [20, 10 + F, 1, 1, PAL.blade], [18, 22 + F, 6, 2, PAL.gold], [20, 24 + F, 2, 2, PAL.grip]], details: [[21, 11 + F, 1, 11, PAL.bladeShade], [20, 12 + F, 1, 8, HL2], [20, 22 + F, 2, 1, '#e0405a']] });
        if (sk.item === 'staff') grp([[10, 3 + dy, 1, 12, PAL.wood]], [[10, 2 + dy, 1, 1, col.main]], [[21, 6 + F, 1, 24, PAL.woodDark], [19, 3 + F, 4, 3, glow(col.main)]], [[19, 3 + F, 4, 4, col.main]]);
        if (sk.item === 'mug') grp([], [], [[22, 21 + F, 1, 2, '#ffffff']], [[19, 20 + F, 3, 4, '#ffffff']]);
        arm([[9, 9 + dy, 1, 3]]);
        hand(18, 23 + F);
    }

    const ay = dy;
    const A = ay * RES;
    switch (opts.accessory) {
      case 'crown': grp([[5, 1 + ay, 4, 2, PAL.gold]], [[6, 1 + ay, 1, 1, '#e0405a']], [[10, 0 + A, 1, 2, PAL.gold], [13, 0 + A, 1, 2, PAL.gold], [16, 0 + A, 1, 2, PAL.gold], [10, 2 + A, 8, 1, HL2]]); break;
      case 'partyhat': grp([[6, 0 + ay, 2, 3, col.main]], [[6, 1 + ay, 2, 1, '#ffffff']], [[13, 0 + A, 1, 1, '#ffe066'], [13, 4 + A, 1, 1, '#ffe066']]); break;
      case 'flower': grp([], [[9, 2 + ay, 2, 2, '#ff8fb1'], [9, 2 + ay, 1, 1, '#ffe066']], [[19, 5 + A, 1, 1, '#ffd0e0']]); break;
      case 'glasses': grp([], [], [[15, 8 + A, 5, 1, PAL.line], [15, 12 + A, 5, 1, PAL.line], [14, 9 + A, 1, 3, PAL.line], [20, 9 + A, 1, 3, PAL.line], [15, 9 + A, 5, 3, 'rgba(191,227,255,0.45)'], [8, 10 + A, 6, 1, PAL.line]]); break;
      case 'sunglasses': grp([], [], [[13, 9 + A, 8, 3, '#111111'], [14, 9 + A, 2, 1, '#777777'], [8, 10 + A, 5, 1, '#111111']]); break;
      case 'headphones': grp([[3, 2 + ay, 8, 1, '#2b2b33']]); grp([[3, 5 + ay, 2, 2, col.main]], [], [[7, 10 + A, 1, 3, HL2], [8, 11 + A, 1, 1, glow('#3dffb0')]]); break;
      case 'halo': grp([], [], [[8, 0 + A, 12, 1, glow('#ffe066')], [7, 1 + A, 1, 1, glow('#ffe066')], [20, 1 + A, 1, 1, glow('#ffe066')]]); break;
      case 'bow': grp([], [[8, 2 + ay, 3, 1, '#ff6fa8'], [9, 3 + ay, 1, 1, '#ff6fa8']], [[18, 4 + A, 2, 2, '#e0508a']]); break;
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

  const fxGroups = (list) => list.map(({ rects, details = [], fine = [], fineRects = [] }) => ({ rects: [...rects.map(d2), ...fineRects], details: [...details.map(d2), ...fine] }));

  const FX = {
    goblin: { w: 16, h: 16, build: (frame) => {
      const g = '#7cc47f';
      const gd = '#4f8a52';
      return fxGroups([
        { rects: [[2, 4, 2, 2, g], [12, 4, 2, 2, g], [4, 3, 8, 6, g]], details: [[6, 8, 4, 1, gd]],
          fine: [[12, 10, 2, 3, '#ffffff'], [18, 10, 2, 3, '#ffffff'], [12, 11, 2, 2, PAL.line], [18, 11, 2, 2, PAL.line], [12, 11, 1, 1, '#ff5f3c'], [18, 11, 1, 1, '#ff5f3c'],
            [11, 9, 4, 1, gd], [17, 9, 4, 1, gd], [15, 13, 2, 2, gd], [13, 16, 1, 1, '#ffffff'], [18, 16, 1, 1, '#ffffff'], [5, 9, 2, 1, gd], [25, 9, 2, 1, gd], [9, 7, 6, 1, 'rgba(255,255,255,0.3)']],
          fineRects: [[3, 7, 2, 2, g], [27, 7, 2, 2, g]] },
        { rects: [[5, 9, 6, 4, '#8a5a3a']], details: [[5, 11, 6, 1, PAL.belt]], fine: [[14, 22, 3, 2, PAL.gold], [12, 19, 1, 3, 'rgba(0,0,0,0.2)'], [19, 19, 1, 3, 'rgba(0,0,0,0.2)'], [10, 25, 12, 1, '#6e452b']] },
        { rects: [[5, 13, 2, 2, gd], [9, 13, 2, 2, gd]], fine: [[10, 29, 4, 1, SH2], [18, 29, 4, 1, SH2]] },
        frame
          ? { rects: [[12, 9, 4, 2, PAL.wood]], fine: [[30, 17, 2, 1, '#c9d1dc'], [27, 17, 1, 1, '#c9d1dc'], [26, 21, 4, 1, PAL.woodDark]] }
          : { rects: [[12, 4, 2, 7, PAL.wood]], fine: [[23, 6, 1, 2, '#c9d1dc'], [28, 9, 1, 2, '#c9d1dc'], [26, 12, 1, 8, PAL.woodDark]] },
      ]);
    } },
    chest: { w: 16, h: 12, build: (open) => fxGroups([
      { rects: [[2, 5, 12, 6, PAL.wood]], details: [[2, 7, 12, 1, PAL.gold], [7, 6, 2, 3, PAL.gold]],
        fine: [[4, 17, 24, 1, SH], [4, 20, 24, 1, SH], [15, 15, 2, 2, PAL.belt], [4, 10, 2, 12, PAL.gold], [26, 10, 2, 12, PAL.gold], [5, 11, 1, 1, PAL.shine], [4, 21, 24, 1, SH2], [10, 12, 1, 2, '#b07a44']] },
      open
        ? { rects: [[2, 0, 12, 2, '#b07a44']], details: [[3, 3, 10, 2, '#ffe066'], [5, 2, 1, 1, PAL.shine], [10, 2, 1, 1, PAL.shine]],
          fine: [[8, 6, 4, 2, glow('#ffd23f')], [16, 7, 3, 2, '#e8b13a'], [21, 6, 2, 1, PAL.shine], [13, 5, 1, 1, PAL.shine], [4, 1, 24, 1, HL], [4, 3, 2, 1, PAL.gold], [26, 3, 2, 1, PAL.gold]] }
        : { rects: [[2, 2, 12, 3, '#b07a44']], details: [[2, 3, 12, 1, PAL.gold]], fine: [[4, 5, 24, 1, HL], [15, 7, 2, 3, '#ffe9a0'], [4, 9, 24, 1, SH]] },
    ]) },
    dragon: { w: 32, h: 16, build: (frame) => {
      const scales = [];
      for (let i = 0; i < 6; i++) scales.push([18 + i * 4, 14 + (i % 2), 2, 1, '#b33f3b']);
      return fxGroups([
        { rects: [[1, 8, 8, 2, '#c2453f']], fine: [[2, 17, 14, 1, '#a8322d'], [0, 15, 2, 2, '#f0c27b']], fineRects: [[0, 14, 3, 6, '#c2453f']] },
        { rects: frame ? [[11, 0, 9, 6, '#a8322d']] : [[11, 11, 9, 5, '#a8322d']],
          fine: frame ? [[26, 1, 1, 10, '#7a2420'], [32, 2, 1, 9, '#7a2420'], [24, 10, 16, 1, 'rgba(255,255,255,0.15)']] : [[26, 23, 1, 8, '#7a2420'], [32, 23, 1, 8, '#7a2420']] },
        { rects: [[8, 6, 14, 5, '#d9534f'], [22, 4, 7, 5, '#d9534f']], details: [[9, 9, 12, 2, '#f0c27b'], [26, 5, 1, 1, '#ffe066'], [29, 7, 2, 1, PAL.spark]],
          fine: [...scales, [18, 18, 24, 1, '#d8a860'], [52, 10, 2, 1, PAL.line], [56, 16, 1, 1, '#ffffff'], [54, 16, 1, 1, '#ffffff'], [58, 14, 5, 2, glow('#ff9a3c')], [60, 13, 3, 1, glow('#ffd65a')], [44, 9, 10, 1, HL], [56, 12, 1, 1, PAL.line]],
          fineRects: [[46, 5, 2, 3, '#f0c27b'], [50, 6, 2, 2, '#f0c27b']] },
      ]);
    } },
    butterfly: { w: 8, h: 6, build: (frame) => fxGroups([
      { rects: frame ? [[0, 1, 3, 3, '#ff8fb1'], [5, 1, 3, 3, '#ff8fb1']] : [[1, 0, 2, 2, '#ff8fb1'], [5, 0, 2, 2, '#ff8fb1']],
        fine: frame ? [[1, 3, 2, 2, PAL.shine], [12, 3, 2, 2, PAL.shine], [2, 6, 2, 1, '#c25b8a'], [12, 6, 2, 1, '#c25b8a']] : [[3, 1, 1, 1, PAL.shine], [11, 1, 1, 1, PAL.shine]] },
      { rects: [[3, 1, 2, 4, '#3a2a20']], fine: [[6, 0, 1, 2, '#3a2a20'], [9, 0, 1, 2, '#3a2a20'], [7, 3, 1, 4, HL]] },
    ]) },
    heart: { w: 8, h: 7, build: () => fxGroups([
      { rects: [[1, 1, 2, 2, '#ff5f87'], [5, 1, 2, 2, '#ff5f87'], [1, 2, 6, 2, '#ff5f87'], [2, 4, 4, 1, '#ff5f87'], [3, 5, 2, 1, '#ff5f87']],
        details: [[2, 1, 1, 1, PAL.shine]], fine: [[4, 4, 1, 1, HL], [10, 8, 2, 2, '#e04570'], [8, 10, 2, 1, '#e04570']],
        fineRects: [[3, 1, 4, 1, '#ff5f87'], [11, 1, 4, 1, '#ff5f87']] },
    ]) },
  };

  // ---- Drawing ---------------------------------------------------------------

  // `unit` is device pixels per logical pixel; groups are in fine pixels (RES per logical pixel).
  // Outlines are half a fine pixel thick and every edge is rounded to whole device pixels so nothing
  // smears. Colours starting with '*' are emissive and get a soft neon glow. `remap` lets room themes
  // recolour furniture without redrawing it. `width` is in logical pixels (for mirroring).
  function paint(ctx, unit, groups, facing, width, remap) {
    ctx.save();
    if (facing < 0) ctx.setTransform(-1, 0, 0, 1, width * unit + ctx.getTransform().e, ctx.getTransform().f);
    const f = unit / RES;
    const o = Math.max(1, Math.round(f / 2));
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
    const line = remap ? remap(PAL.line) : PAL.line;
    for (const { rects, details } of groups) {
      ctx.fillStyle = line;
      for (const [x, y, w, h] of rects) ctx.fillRect(px(x) - o, px(y) - o, px(x + w) - px(x) + 2 * o, px(y + h) - px(y) + 2 * o);
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
    rest: ['idle', 'rest'], walk: ['walk', 'idle'], type: ['type', 'work', 'idle'], hammer: ['hammer', 'work', 'idle'],
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
    W, H, RES, PAL, SKINS, FX, MINI, grouper,
    buildCharacter, buildMini, drawMiniAt, drawCharacter, drawCharacterAt, drawFx, drawFxAt, paint,
    parseSheet, drawCustomAt, colorsFor,
  };
});
