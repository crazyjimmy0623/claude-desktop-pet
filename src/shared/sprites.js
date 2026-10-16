// Procedural pixel art. Characters live on a 32x28 grid, facing right.
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

  // ---- Character -------------------------------------------------------------

  function buildCharacter(skinId, pose, frame, col, opts = {}) {
    const sk = SKINS[skinId] || SKINS.knight;
    const c = sk.c;
    const prop = opts.prop !== false;
    const groups = [];
    const grp = (rects, details = []) => groups.push({ rects, details });
    const sleeping = pose === 'sleep';

    let dy = 0;
    if (pose === 'rest' || pose === 'read') dy = frame;
    if (pose === 'walk') dy = frame ? -1 : 0;
    if (pose === 'dance') dy = frame ? -1 : 1;
    if (sleeping) dy = 2 + frame;

    // --- Behind the body: props, tails, backpacks.
    if (sleeping && (sk.item === 'sword' || sk.item === 'staff')) {
      grp(sk.item === 'sword'
        ? [[1, 25, 8, 1, PAL.blade], [9, 24, 1, 3, PAL.gold], [10, 25, 3, 1, PAL.grip]]
        : [[0, 25, 13, 1, PAL.wood], [13, 24, 3, 3, col.main]]);
    }
    if (pose === 'hammer' && prop) {
      grp([[22, 21, 8, 2, PAL.anvilTop], [24, 23, 4, 2, PAL.anvil], [23, 25, 6, 2, PAL.anvil]], [[22, 21, 8, 1, PAL.anvilShine]]);
    }
    if (pose === 'type' && prop) {
      grp([[20, 21, 10, 2, PAL.wood], [21, 23, 1, 4, PAL.woodDark], [28, 23, 1, 4, PAL.woodDark]], [[20, 22, 10, 1, PAL.woodDark]]);
      grp([[22, 20, 7, 1, '#c9ced8'], [27, 14, 2, 6, '#3a3f4c']], [[27, 15, 1, 4, PAL.screen]]);
    }
    if (pose === 'paint' && prop) {
      grp([[24, 12, 1, 15, PAL.wood], [29, 12, 1, 15, PAL.wood]]);
      grp([[22, 9, 9, 9, PAL.page]], [
        [24, 11, 3, 1, col.main], [25, 13, 4, 1, '#5aa7ff'], [23, 15, 2, 1, '#7cc47f'],
        ...(frame ? [[27, 11, 2, 2, PAL.spark]] : [[23, 12, 1, 2, '#e0405a']]),
      ]);
    }
    if (sk.tail) grp([[4, 15 + dy, 2, 5, c.body], [5, 19 + dy, 4, 2, c.body]], [[4, 15 + dy, 2, 1, c.bodyShade]]);
    if (sk.backpack) grp([[6, 17 + dy, 3, 6, c.body]], [[6, 18 + dy, 1, 4, c.bodyShade]]);

    // --- Hat pieces that sit behind the head.
    if (sk.head === 'helmet') grp([[13, 4 + dy, 4, 1, col.main], [11, 5 + dy, 6, 1, col.main], [10, 6 + dy, 5, 1, col.dark]]);
    if (sk.head === 'cat') grp([[9, 6 + dy, 3, 3, c.body], [16, 6 + dy, 3, 3, c.body]], [[10, 7 + dy, 1, 2, '#f6b8b8'], [17, 7 + dy, 1, 2, '#f6b8b8']]);
    if (sk.head === 'robot') grp([[13, 5 + dy, 1, 3, c.bodyShade], [12, 3 + dy, 3, 2, c.head]], [[13, 3 + dy, 1, 1, col.main]]);

    // --- Back arm.
    const backUp = pose === 'dangle' || (pose === 'dance' && frame === 0);
    grp(backUp ? [[7, 11, 2, 8, c.bodyShade]] : [[7, 18 + dy, 2, 4, c.bodyShade]]);

    // --- Legs.
    const legs = {
      walk: frame ? [[9, 23, 3, 3], [16, 23, 3, 4]] : [[10, 23, 3, 4], [15, 23, 3, 4]],
      dangle: [[11, 23, 2, 4], [15, 23, 2, 4]],
      sleep: [[15, 24, 7, 2]],
    }[pose] || [[10, 23, 3, 4], [15, 23, 3, 4]];
    grp(
      legs.map((r) => [...r, c.leg]),
      legs.map(([x, y, w, h]) => (sleeping ? [x + w - 1, y, 1, h, c.boot] : [x, y + h - 1, w, 1, c.boot])),
    );

    // --- Torso.
    const ty = 18 + dy;
    switch (sk.body) {
      case 'armor':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty, 6, 6, col.main], [11, ty + 5, 6, 1, col.dark], [9, ty + 3, 10, 1, PAL.belt], [13, ty + 3, 2, 1, PAL.gold]]);
        break;
      case 'robe':
        grp([[9, ty, 10, 6, c.body], [8, ty + 4, 12, 4, c.body]], [[9, ty, 1, 7, c.bodyShade], [13, ty, 2, 8, c.bodyShade], [8, ty + 7, 12, 1, col.main]]);
        break;
      case 'shirt':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [13, ty, 2, 1, col.dark], [13, ty + 1, 2, 3, col.main], [9, ty + 4, 10, 1, '#3b3b45']]);
        break;
      case 'fur':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [12, ty + 1, 6, 4, c.belly], [9, ty, 10, 1, col.main], [14, ty + 1, 2, 1, PAL.gold]]);
        break;
      case 'metal':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty + 1, 6, 3, '#2c3442'], [12, ty + 2, 1, 1, col.main], [14, ty + 2, 1, 1, '#5ef0ff'], [16, ty + 2, 1, 1, PAL.spark]]);
        break;
      case 'gi':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [12, ty, 1, 3, '#3d4361'], [15, ty, 1, 3, '#3d4361'], [9, ty + 3, 10, 1, col.main]]);
        break;
      case 'apron':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty + 1, 6, 5, '#ffffff'], [10, ty, 8, 1, col.main]]);
        break;
      case 'suit':
        grp([[9, ty, 10, 6, c.body]], [[9, ty, 1, 6, c.bodyShade], [11, ty + 1, 2, 2, col.main], [9, ty + 4, 10, 1, '#8a93a6']]);
        break;
      default:
        grp([[9, ty, 10, 6, c.body]]);
    }

    // --- Head.
    const hy = dy;
    const eyes = (x1, x2, y, color = PAL.line) => (sleeping
      ? [[x1 - 1, y + 1, 2, 1, color], [x2 - 1, y + 1, 2, 1, color]]
      : [[x1, y, 1, 2, color], [x2, y, 1, 2, color]]);
    const roundHead = (color, details) => grp([[9, 8 + hy, 10, 10, color], [8, 9 + hy, 12, 8, color]], details);
    switch (sk.head) {
      case 'helmet':
        roundHead(c.head, [
          [9, 17 + hy, 10, 1, c.headShade], [8, 15 + hy, 1, 2, c.headShade], [10, 9 + hy, 2, 1, PAL.shine], [9, 10 + hy, 1, 2, PAL.shine],
          [11, 11 + hy, 8, 2, PAL.line], [14, 13 + hy, 2, 5, PAL.line],
        ]);
        break;
      case 'face':
        roundHead(c.skin, [...eyes(14, 17, 12 + hy), [13, 14 + hy, 1, 1, PAL.blush], [18, 14 + hy, 1, 1, PAL.blush], [10, 13 + hy, 1, 2, '#d9a77c']]);
        if (sk.hat === 'hair') grp([[8, 7 + hy, 12, 3, c.hair], [8, 9 + hy, 3, 6, c.hair]], [[12, 10 + hy, 7, 1, c.hair]]);
        if (sk.hat === 'wizard') {
          if (sk.beard) grp([[11, 14 + hy, 8, 4, c.hair], [12, 18 + hy, 6, 1, c.hair]]);
          grp([[7, 7 + hy, 14, 2, c.hat], [10, 5 + hy, 8, 2, c.hat], [11, 3 + hy, 6, 2, c.hat], [13, 1 + hy, 3, 2, c.hat], [15, 0 + hy, 2, 1, c.hat]],
            [[10, 6 + hy, 8, 1, col.main], [13, 3 + hy, 1, 1, PAL.spark]]);
        }
        if (sk.hat === 'chef') {
          grp([[8, 9 + hy, 2, 3, c.hair]]);
          grp([[9, 4 + hy, 10, 5, '#ffffff'], [8, 2 + hy, 12, 3, '#ffffff'], [10, 1 + hy, 8, 1, '#ffffff']], [[9, 7 + hy, 10, 1, '#e3e6ec']]);
        }
        break;
      case 'cat':
        roundHead(c.body, [
          [12, 8 + hy, 1, 2, c.bodyShade], [14, 8 + hy, 1, 3, c.bodyShade], [16, 8 + hy, 1, 2, c.bodyShade],
          ...eyes(14, 17, 12 + hy), [14, 14 + hy, 5, 2, c.belly], [16, 14 + hy, 1, 1, '#e07a7a'],
          [19, 13 + hy, 1, 1, '#5a4a3a'], [19, 15 + hy, 1, 1, '#5a4a3a'],
        ]);
        break;
      case 'robot':
        grp([[8, 8 + hy, 12, 10, c.head]], [
          [10, 11 + hy, 9, 4, '#1b2b3a'], ...(sleeping ? [[12, 13 + hy, 2, 1, '#5ef0ff'], [16, 13 + hy, 2, 1, '#5ef0ff']] : [[12, 12 + hy, 2, 2, '#5ef0ff'], [16, 12 + hy, 2, 2, '#5ef0ff']]),
          [8, 12 + hy, 1, 2, c.bodyShade], [12, 16 + hy, 6, 1, c.bodyShade], [9, 9 + hy, 2, 1, PAL.shine],
        ]);
        break;
      case 'ninja':
        roundHead(c.head, [[11, 11 + hy, 8, 3, c.skin], ...eyes(14, 17, 12 + hy).map((r) => (sleeping ? r : [r[0], r[1], 1, 1, r[4]])), [8, 9 + hy, 12, 1, col.main]]);
        grp([], [[5, 9 + hy, 3, 1, col.main], [4, 10 + hy, 3, 1, col.main]]);
        break;
      case 'astronaut':
        grp([[9, 7 + hy, 10, 11, c.head], [8, 8 + hy, 12, 9, c.head]], [
          [10, 10 + hy, 9, 6, '#2a3b66'], [11, 11 + hy, 2, 1, '#9fb8ff'], [11, 12 + hy, 1, 1, '#9fb8ff'], [9, 8 + hy, 2, 1, PAL.shine],
        ]);
        break;
    }

    // --- Front arm and whatever it holds.
    const arm = (rects) => grp(rects.map((r, i) => [...r, i === rects.length - 1 && rects.length > 1 ? c.hand : c.body]));
    const toolUp = () => {
      if (sk.item === 'sword') {
        grp([[19, 1, 2, 7, PAL.blade], [18, 8, 4, 1, PAL.gold], [19, 9, 2, 2, PAL.grip]], [[20, 1, 1, 7, PAL.bladeShade]]);
      } else if (sk.item === 'staff') {
        grp([[19, 2, 2, 9, PAL.wood]]);
        grp([[18, 0, 4, 3, col.main]], [[18, 0, 1, 1, PAL.shine]]);
      } else {
        grp([[19, 3, 2, 7, PAL.wood]]);
        grp([[17, 1, 6, 3, PAL.steelDark]], [[17, 1, 6, 1, PAL.steel]]);
      }
      arm([[19, 12, 2, 7], [19, 10, 2, 2]]);
    };
    const sparks = (pts) => grp([], pts.map(([x, y, color]) => [x, y, 1, 1, color]));

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
            grp([[24, 17, 1, 4, PAL.gold], [25, 18, 5, 2, PAL.blade]], [[25, 19, 5, 1, PAL.bladeShade]]);
          } else {
            grp([[24, 18, 3, 2, PAL.wood]]);
            grp([[27, 16, 3, 5, PAL.steelDark]], [[27, 16, 1, 5, PAL.steel]]);
          }
          if (prop) sparks([[27, 14, PAL.spark], [30, 15, PAL.shine], [24, 14, PAL.spark], [29, 12, PAL.spark]]);
        }
        break;
      case 'type':
        arm([[19, 18, 4, 2], [22, 18 + frame, 2, 2]]);
        break;
      case 'paint':
        arm([[19, 16, 3, 2], [21, 16, 2, 2]]);
        grp([[23, 14 + frame, 3, 1, PAL.wood]], [[25, 14 + frame, 1, 1, col.main]]);
        break;
      case 'read':
        arm([[19, 18 + dy, 2, 3]]);
        grp([[17, 16 + dy, 9, 6, PAL.cover]], [
          [18, 17 + dy, 3, 4, PAL.page], [22, 17 + dy, 3, 4, PAL.page],
          [18, 18 + dy + frame, 3, 1, PAL.ink], [22, 18 + dy, 3, 1, PAL.ink],
          [18, 20 + dy - frame, 2, 1, PAL.ink], [22, 20 + dy, 2, 1, PAL.ink],
        ]);
        break;
      case 'wait':
        arm([[19, 11, 2, 8], [19 + frame, 9, 3, 2]]);
        break;
      case 'dance':
        if (frame) arm([[19, 11, 2, 8], [19, 9, 2, 2]]);
        else arm([[19, 18 + dy, 2, 4]]);
        sparks(frame ? [[24, 6, col.main], [24, 7, col.main], [24, 8, col.main], [25, 6, col.main], [23, 8, col.main]]
          : [[4, 4, col.main], [4, 5, col.main], [4, 6, col.main], [5, 4, col.main], [3, 6, col.main]]);
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
            grp([[21, 9 + y, 2, 10, PAL.blade], [20, 19 + y, 4, 1, PAL.gold], [21, 20 + y, 2, 2, PAL.grip], [21, 22 + y, 2, 1, PAL.gold]], [[22, 9 + y, 1, 10, PAL.bladeShade]]);
            break;
          case 'staff':
            grp([[21, 5 + y, 2, 18, PAL.wood]], [[22, 5 + y, 1, 18, PAL.woodDark]]);
            grp([[20, 2 + y, 4, 3, col.main]], [[20, 2 + y, 1, 1, PAL.shine]]);
            break;
          case 'mug':
            grp([[22, 18 + y, 4, 4, '#ffffff'], [26, 19 + y, 1, 2, '#ffffff']], [[22, 18 + y, 4, 1, PAL.grip]]);
            if (frame) sparks([[23, 15 + y, '#e6e9f0'], [24, 14 + y, '#e6e9f0']]);
            break;
          case 'wrench':
            grp([[21, 12 + y, 2, 9, PAL.steel], [20, 10 + y, 4, 2, PAL.steel]], [[21, 10 + y, 2, 1, PAL.line]]);
            break;
          case 'kunai':
            grp([[21, 14 + y, 1, 6, '#c9d1dc'], [21, 20 + y, 1, 2, PAL.grip]]);
            break;
          case 'ladle':
            grp([[21, 10 + y, 1, 11, PAL.steel], [20, 8 + y, 3, 2, PAL.steel]]);
            break;
        }
        arm([[19, 18 + y, 2, 3], [20, 20 + y, 2, 2]]);
      }
    }

    // --- Accessory on top of everything.
    const ay = dy;
    switch (opts.accessory) {
      case 'crown':
        grp([[11, 5 + ay, 7, 3, PAL.gold], [11, 3 + ay, 1, 2, PAL.gold], [14, 3 + ay, 1, 2, PAL.gold], [17, 3 + ay, 1, 2, PAL.gold]], [[14, 6 + ay, 1, 1, '#e0405a']]);
        break;
      case 'partyhat':
        grp([[14, 1 + ay, 1, 1, col.main], [13, 2 + ay, 3, 2, col.main], [12, 4 + ay, 5, 2, col.main], [11, 6 + ay, 7, 2, col.main]], [[12, 5 + ay, 5, 1, '#ffffff'], [14, 0 + ay, 1, 1, '#ffffff']]);
        break;
      case 'flower':
        grp([[17, 5 + ay, 3, 3, '#ff8fb1']], [[18, 6 + ay, 1, 1, '#ffe066']]);
        break;
      case 'glasses':
        grp([], [[13, 11 + ay, 3, 3, PAL.line], [17, 11 + ay, 3, 3, PAL.line], [14, 12 + ay, 1, 1, '#bfe3ff'], [18, 12 + ay, 1, 1, '#bfe3ff'], [16, 12 + ay, 1, 1, PAL.line]]);
        break;
      case 'sunglasses':
        grp([], [[12, 11 + ay, 4, 2, '#111111'], [17, 11 + ay, 3, 2, '#111111'], [16, 11 + ay, 1, 1, '#111111'], [13, 11 + ay, 1, 1, '#666666']]);
        break;
      case 'headphones':
        grp([[9, 6 + ay, 10, 1, '#2b2b33']]);
        grp([[9, 11 + ay, 3, 5, col.main]], [[9, 11 + ay, 1, 5, col.dark]]);
        break;
      case 'halo':
        grp([], [[11, 2 + ay, 8, 1, '#ffe066'], [10, 3 + ay, 1, 1, '#ffe066'], [19, 3 + ay, 1, 1, '#ffe066']]);
        break;
      case 'bow':
        grp([[16, 6 + ay, 2, 2, '#ff6fa8'], [19, 6 + ay, 2, 2, '#ff6fa8'], [18, 6 + ay, 1, 2, '#ff6fa8']]);
        break;
    }
    return groups;
  }


  // ---- Mini characters (room mode) -------------------------------------------
  // 12x16 people on a 14x18 grid (1px margin for the outline), the same scale as Pixel Crew's office.
  const MINI = { W: 14, H: 18, anchor: 6.5, feet: 16 };

  function buildMini(skinId, pose, frame, col, opts = {}) {
    const sk = SKINS[skinId] || SKINS.knight;
    const c = sk.c;
    const groups = [];
    const grp = (rects, details = []) => groups.push({ rects, details });
    const sleeping = pose === 'sleep';
    let dy = 0;
    if (pose === 'rest' || pose === 'read') dy = frame;
    if (pose === 'walk') dy = frame ? -1 : 0;
    if (pose === 'dance') dy = frame ? -1 : 0;
    if (sleeping) dy = 2;
    const headColor = sk.head === 'face' || sk.head === 'ninja' ? (sk.head === 'ninja' ? c.head : c.skin) : (c.head || c.body);

    if (sk.tail) grp([[2, 9 + dy, 1, 4, c.body]]);
    if (sk.backpack) grp([[2, 9 + dy, 2, 4, c.body]]);
    if (sk.head === 'helmet') grp([[5, 1 + dy, 3, 2, col.main]]);
    if (sk.head === 'cat') grp([[3, 2 + dy, 2, 2, c.body], [8, 2 + dy, 2, 2, c.body]]);
    if (sk.head === 'robot') grp([[6, 1 + dy, 1, 2, c.bodyShade]], [[6, 1 + dy, 1, 1, col.main]]);

    // back arm, legs, torso
    const armsUp = pose === 'dangle' || (pose === 'dance' && !frame);
    grp(armsUp ? [[3, 5, 1, 4, c.bodyShade]] : [[3, 9 + dy, 1, 3, c.bodyShade]]);
    const legs = pose === 'walk' && frame ? [[3, 13, 2, 3], [8, 13, 2, 2]]
      : sleeping ? [[6, 14, 5, 2]]
      : pose === 'dangle' ? [[4, 13, 2, 3], [7, 13, 2, 3]] : [[4, 13, 2, 3], [7, 13, 2, 3]];
    grp(legs.map((r) => [...r, c.leg]), legs.map(([x, y, w, h]) => (sleeping ? [x + w - 1, y, 1, h, c.boot] : [x, y + h - 1, w, 1, c.boot])));
    const ty = 9 + dy;
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
    grp(torso, torsoDetail);

    // head
    const hy = dy;
    const eye = sleeping ? [[7, 5 + hy, 2, 1, PAL.line]] : [[8, 5 + hy, 1, 1, PAL.line]];
    const head = sk.head === 'robot' ? [[3, 3 + hy, 8, 5, headColor]]
      : sk.head === 'astronaut' ? [[4, 2 + hy, 6, 6, headColor], [3, 3 + hy, 8, 4, headColor]]
      : [[4, 3 + hy, 6, 5, headColor], [3, 4 + hy, 8, 3, headColor]];
    const headDetail = {
      helmet: [[6, 5 + hy, 4, 1, PAL.line], [8, 6 + hy, 1, 2, PAL.line], [4, 4 + hy, 1, 1, PAL.shine]],
      face: [...eye, [9, 6 + hy, 1, 1, PAL.blush]],
      cat: [...eye, [9, 6 + hy, 1, 1, '#e07a7a'], [5, 3 + hy, 1, 1, c.bodyShade]],
      robot: [[5, 4 + hy, 5, 2, '#1b2b3a'], [8, 5 + hy, 1, 1, '#5ef0ff']],
      ninja: [[5, 5 + hy, 5, 1, c.skin], ...eye, [3, 4 + hy, 8, 1, col.main]],
      astronaut: [[5, 4 + hy, 5, 3, '#2a3b66'], [6, 4 + hy, 1, 1, '#9fb8ff']],
    }[sk.head] || eye;
    grp(head, headDetail);
    if (sk.head === 'ninja') grp([], [[1, 4 + hy, 2, 1, col.main]]);
    if (sk.hat === 'hair') grp([[3, 2 + hy, 7, 2, c.hair], [3, 3 + hy, 2, 3, c.hair]]);
    if (sk.hat === 'wizard') grp([[2, 3 + hy, 9, 1, c.hat], [4, 1 + hy, 5, 2, c.hat], [5, 0 + hy, 3, 1, c.hat]], [[4, 2 + hy, 5, 1, col.main]]);
    if (sk.beard) grp([[6, 7 + hy, 4, 2, c.hair]]);
    if (sk.hat === 'chef') grp([[4, 0 + hy, 6, 3, '#ffffff']]);

    // front arm & item
    const arm = (rects) => grp(rects.map((r) => [...r, c.body]));
    const spark = (pts) => grp([], pts.map(([x, y, color]) => [x, y, 1, 1, color]));
    switch (pose) {
      case 'type': case 'hammer': case 'paint':
        arm([[9, 9 + frame, 2, 1]]);
        if (pose === 'hammer') grp([[11, 7 + frame * 2, 1, 2, PAL.steelDark]]);
        if (pose === 'paint') grp([], [[11, 9 + frame, 1, 1, col.main]]);
        break;
      case 'read':
        grp([[8, 9 + dy, 4, 3, PAL.cover]], [[9, 9 + dy, 1, 2, PAL.page], [11, 9 + dy, 1, 2, PAL.page]]);
        break;
      case 'wait':
        arm([[9, 5, 1, 4], [9 + frame, 4, 1, 1]]);
        break;
      case 'done':
        arm([[9, 4, 1, 5]]);
        if (sk.item === 'sword') grp([[9, 0, 1, 4, PAL.blade]]);
        spark(frame ? [[11, 1, PAL.spark], [7, 0, PAL.shine]] : [[12, 3, PAL.shine], [8, 1, PAL.spark]]);
        break;
      case 'dangle':
        arm([[9, 5, 1, 4]]);
        break;
      case 'dance':
        if (frame) arm([[9, 5, 1, 4]]); else arm([[9, 9 + dy, 1, 3]]);
        spark(frame ? [[12, 2, col.main], [12, 3, col.main]] : [[1, 2, col.main], [1, 3, col.main]]);
        break;
      case 'sleep':
        arm([[9, 10 + dy, 1, 2]]);
        break;
      default:
        if (sk.item === 'sword') grp([[10, 5 + dy, 1, 7, PAL.blade]], [[9, 11 + dy, 3, 1, PAL.gold]]);
        if (sk.item === 'staff') grp([[10, 3 + dy, 1, 12, PAL.wood]], [[10, 2 + dy, 1, 1, col.main]]);
        arm([[9, 9 + dy, 1, 3]]);
    }

    const ay = dy;
    switch (opts.accessory) {
      case 'crown': grp([[5, 1 + ay, 4, 2, PAL.gold]], [[6, 1 + ay, 1, 1, '#e0405a']]); break;
      case 'partyhat': grp([[6, 0 + ay, 2, 3, col.main]], [[6, 1 + ay, 2, 1, '#ffffff']]); break;
      case 'flower': grp([], [[9, 2 + ay, 2, 2, '#ff8fb1'], [9, 2 + ay, 1, 1, '#ffe066']]); break;
      case 'glasses': grp([], [[7, 5 + ay, 3, 1, PAL.line], [8, 5 + ay, 1, 1, '#bfe3ff']]); break;
      case 'sunglasses': grp([], [[6, 5 + ay, 4, 1, '#111111']]); break;
      case 'headphones': grp([[3, 2 + ay, 8, 1, '#2b2b33']]); grp([[3, 5 + ay, 2, 2, col.main]]); break;
      case 'halo': grp([], [[4, 0 + ay, 6, 1, '#ffe066']]); break;
      case 'bow': grp([], [[8, 2 + ay, 3, 1, '#ff6fa8'], [9, 3 + ay, 1, 1, '#ff6fa8']]); break;
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
    goblin: { w: 16, h: 16, build: (frame) => {
      const g = '#7cc47f';
      const gd = '#4f8a52';
      return [
        { rects: [[2, 4, 2, 2, g], [12, 4, 2, 2, g], [4, 3, 8, 6, g]], details: [[6, 5, 1, 2, '#ffffff'], [9, 5, 1, 2, '#ffffff'], [6, 6, 1, 1, PAL.line], [9, 6, 1, 1, PAL.line], [6, 8, 4, 1, gd]] },
        { rects: [[5, 9, 6, 4, '#8a5a3a']], details: [[5, 11, 6, 1, PAL.belt]] },
        { rects: [[5, 13, 2, 2, gd], [9, 13, 2, 2, gd]], details: [] },
        { rects: frame ? [[12, 9, 4, 2, PAL.wood]] : [[12, 4, 2, 7, PAL.wood]], details: [] },
      ];
    } },
    chest: { w: 16, h: 12, build: (open) => [
      { rects: [[2, 5, 12, 6, PAL.wood]], details: [[2, 7, 12, 1, PAL.gold], [7, 6, 2, 3, PAL.gold]] },
      { rects: open ? [[2, 0, 12, 2, '#b07a44']] : [[2, 2, 12, 3, '#b07a44']], details: open ? [[3, 3, 10, 2, '#ffe066'], [5, 2, 1, 1, PAL.shine], [10, 2, 1, 1, PAL.shine]] : [[2, 3, 12, 1, PAL.gold]] },
    ] },
    dragon: { w: 32, h: 16, build: (frame) => [
      { rects: [[1, 8, 8, 2, '#c2453f']], details: [] },
      { rects: frame ? [[11, 0, 9, 6, '#a8322d']] : [[11, 11, 9, 5, '#a8322d']], details: [] },
      { rects: [[8, 6, 14, 5, '#d9534f'], [22, 4, 7, 5, '#d9534f']], details: [[9, 9, 12, 2, '#f0c27b'], [26, 5, 1, 1, '#ffe066'], [29, 7, 2, 1, PAL.spark]] },
    ] },
    butterfly: { w: 8, h: 6, build: (frame) => [
      { rects: frame ? [[0, 1, 3, 3, '#ff8fb1'], [5, 1, 3, 3, '#ff8fb1']] : [[1, 0, 2, 2, '#ff8fb1'], [5, 0, 2, 2, '#ff8fb1']], details: [] },
      { rects: [[3, 1, 2, 4, '#3a2a20']], details: [] },
    ] },
    heart: { w: 8, h: 7, build: () => [
      { rects: [[1, 1, 2, 2, '#ff5f87'], [5, 1, 2, 2, '#ff5f87'], [1, 2, 6, 2, '#ff5f87'], [2, 4, 4, 1, '#ff5f87'], [3, 5, 2, 1, '#ff5f87']], details: [[2, 1, 1, 1, PAL.shine]] },
    ] },
  };

  // ---- Drawing ---------------------------------------------------------------

  // Outlines are half an art pixel thick (finer than the fill pixels); every edge is rounded to whole
  // device pixels so nothing smears. Colours starting with '*' are emissive and get a soft neon glow.
  // `remap` lets room themes recolour furniture without redrawing it.
  function paint(ctx, unit, groups, facing, width, remap) {
    ctx.save();
    if (facing < 0) ctx.setTransform(-1, 0, 0, 1, width * unit + ctx.getTransform().e, ctx.getTransform().f);
    const o = Math.max(1, Math.round(unit / 2));
    const px = (v) => Math.round(v * unit);
    const fill = (x, y, w, h, color) => {
      let c = remap ? remap(color) : color;
      const glow = c[0] === '*';
      if (glow) {
        c = c.slice(1);
        ctx.shadowColor = c;
        ctx.shadowBlur = unit * 3;
      }
      ctx.fillStyle = c;
      ctx.fillRect(px(x), px(y), px(x + w) - px(x), px(y + h) - px(y));
      if (glow) ctx.shadowBlur = 0;
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
    W, H, PAL, SKINS, FX, MINI,
    buildCharacter, buildMini, drawMiniAt, drawCharacter, drawCharacterAt, drawFx, drawFxAt, paint,
    parseSheet, drawCustomAt, colorsFor,
  };
});
