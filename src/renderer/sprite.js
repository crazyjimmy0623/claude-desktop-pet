// Procedural pixel-art knight. Coordinates are sprite pixels on a 32x28 grid, facing right.
// A pose is a list of groups; each group is outlined as one silhouette, then filled,
// then its details are drawn on top, so later groups get a clean outline over earlier ones.
const SPRITE = { W: 32, H: 28 };

const PAL = {
  line: '#1d1b26',
  helm: '#f1f1f4',
  helmShade: '#c4c6d4',
  shine: '#ffffff',
  armor: '#a3abc0',
  armorShade: '#717a92',
  blade: '#e6edf5',
  bladeShade: '#aab6c6',
  gold: '#e8b13a',
  grip: '#6b4423',
  belt: '#4a3424',
  leg: '#5b6178',
  boot: '#363a4a',
  page: '#fbf6e6',
  ink: '#cdbf9f',
  cover: '#8a4b2a',
  anvil: '#4a4f5e',
  anvilTop: '#6c7385',
  anvilShine: '#8a91a3',
  spark: '#ffd65a',
};

function buildKnight(pose, frame, col) {
  const groups = [];
  const grp = (rects, details = []) => groups.push({ rects, details });
  const c = (color) => (rects) => rects.map((r) => [...r, color]);

  let dy = 0;
  if (pose === 'rest' || pose === 'read') dy = frame;
  if (pose === 'walk') dy = frame ? -1 : 0;
  if (pose === 'sleep') dy = 2 + frame;

  // Lying sword when asleep sits behind everything.
  if (pose === 'sleep') {
    grp([[1, 25, 8, 1, PAL.blade], [9, 24, 1, 3, PAL.gold], [10, 25, 3, 1, PAL.grip]]);
  }

  // Anvil for forging.
  if (pose === 'forge') {
    grp(
      [[22, 21, 8, 2, PAL.anvilTop], [24, 23, 4, 2, PAL.anvil], [23, 25, 6, 2, PAL.anvil]],
      [[22, 21, 8, 1, PAL.anvilShine]],
    );
  }

  // Plume.
  grp([[13, 4 + dy, 4, 1, col.main], [11, 5 + dy, 6, 1, col.main], [10, 6 + dy, 5, 1, col.dark]]);

  // Back arm.
  if (pose === 'dangle') grp([[7, 11, 2, 8, PAL.armorShade]]);
  else grp([[7, 18 + dy, 2, 4, PAL.armorShade]]);

  // Legs.
  const legs = {
    walk: frame ? [[9, 23, 3, 3], [16, 23, 3, 4]] : [[10, 23, 3, 4], [15, 23, 3, 4]],
    dangle: [[11, 23, 2, 4], [15, 23, 2, 4]],
    sleep: [[15, 24, 7, 2]],
  }[pose] || [[10, 23, 3, 4], [15, 23, 3, 4]];
  grp(
    c(PAL.leg)(legs),
    legs.map(([x, y, w, h]) => (pose === 'sleep' ? [x + w - 1, y, 1, h, PAL.boot] : [x, y + h - 1, w, 1, PAL.boot])),
  );

  // Torso with tabard in the session's colour.
  grp([[9, 18 + dy, 10, 6, PAL.armor]], [
    [9, 18 + dy, 1, 6, PAL.armorShade],
    [11, 18 + dy, 6, 6, col.main],
    [11, 23 + dy, 6, 1, col.dark],
    [9, 21 + dy, 10, 1, PAL.belt],
    [13, 21 + dy, 2, 1, PAL.gold],
  ]);

  // Helmet with the T visor.
  grp([[9, 8 + dy, 10, 10, PAL.helm], [8, 9 + dy, 12, 8, PAL.helm]], [
    [9, 17 + dy, 10, 1, PAL.helmShade],
    [8, 15 + dy, 1, 2, PAL.helmShade],
    [10, 9 + dy, 2, 1, PAL.shine],
    [9, 10 + dy, 1, 2, PAL.shine],
    [11, 11 + dy, 8, 2, PAL.line],
    [14, 13 + dy, 2, 5, PAL.line],
  ]);

  // Front arm and whatever it holds.
  const swordUp = () => {
    grp([[19, 1, 2, 7, PAL.blade], [18, 8, 4, 1, PAL.gold], [19, 9, 2, 2, PAL.grip]], [[20, 1, 1, 7, PAL.bladeShade]]);
    grp([[19, 12, 2, 7, PAL.armor], [19, 10, 2, 2, PAL.armorShade]]);
  };
  const sparks = (pts) => grp([], pts.map(([x, y, color]) => [x, y, 1, 1, color]));

  switch (pose) {
    case 'done':
      swordUp();
      sparks(frame
        ? [[16, 1, PAL.shine], [23, 3, PAL.spark], [15, 5, PAL.spark], [24, 0, PAL.spark]]
        : [[17, 3, PAL.spark], [23, 1, PAL.shine], [24, 5, PAL.spark], [16, 0, PAL.spark]]);
      break;
    case 'forge':
      if (frame === 0) {
        swordUp();
      } else {
        grp([[19, 18, 4, 2, PAL.armor], [22, 18, 2, 2, PAL.armorShade]]);
        grp([[24, 17, 1, 4, PAL.gold], [25, 18, 5, 2, PAL.blade]], [[25, 19, 5, 1, PAL.bladeShade]]);
        sparks([[27, 15, PAL.spark], [30, 16, PAL.shine], [24, 14, PAL.spark], [29, 13, PAL.spark]]);
      }
      break;
    case 'read':
      grp([[19, 18 + dy, 2, 3, PAL.armor]]);
      grp([[17, 16 + dy, 9, 6, PAL.cover]], [
        [18, 17 + dy, 3, 4, PAL.page],
        [22, 17 + dy, 3, 4, PAL.page],
        [18, 18 + dy + frame, 3, 1, PAL.ink],
        [22, 18 + dy, 3, 1, PAL.ink],
        [18, 20 + dy - frame, 2, 1, PAL.ink],
        [22, 20 + dy, 2, 1, PAL.ink],
      ]);
      break;
    case 'wait':
      grp([[19, 11, 2, 8, PAL.armor], [19 + frame, 9, 3, 2, PAL.armorShade]]);
      break;
    case 'dangle':
      grp([[19, 11, 2, 8, PAL.armor]]);
      break;
    case 'sleep':
      grp([[19, 19 + dy, 2, 3, PAL.armor]]);
      break;
    default: // rest / walk: sword held upright
      grp([[21, 9 + dy, 2, 10, PAL.blade], [20, 19 + dy, 4, 1, PAL.gold], [21, 20 + dy, 2, 2, PAL.grip], [21, 22 + dy, 2, 1, PAL.gold]],
        [[22, 9 + dy, 1, 10, PAL.bladeShade]]);
      grp([[19, 18 + dy, 2, 3, PAL.armor], [20, 20 + dy, 2, 2, PAL.armorShade]]);
  }
  return groups;
}

function drawKnight(ctx, unit, pose, frame, col, facing) {
  const { canvas } = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (facing < 0) ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
  for (const { rects, details } of buildKnight(pose, frame, col)) {
    ctx.fillStyle = PAL.line;
    for (const [x, y, w, h] of rects) ctx.fillRect((x - 1) * unit, (y - 1) * unit, (w + 2) * unit, (h + 2) * unit);
    for (const [x, y, w, h, color] of rects) {
      ctx.fillStyle = color;
      ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
    }
    for (const [x, y, w, h, color] of details) {
      ctx.fillStyle = color;
      ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
    }
  }
}
