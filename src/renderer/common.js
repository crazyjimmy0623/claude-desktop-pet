/* global Sprites, Catalog */
// Helpers shared by the strip and room views.
(function () {
  window.addEventListener('error', (e) => console.error(`[uncaught] ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => console.error(`[unhandled] ${e.reason?.stack || e.reason}`));
  const { STATIONS } = Catalog;

  const STATE_LABEL = {
    idle: '閒著', think: '思考中', work: '工作中', wait: '等你批准', done: '完成！', sleep: '睡覺中', leaving: '下班',
  };

  const POSE_SPEED = { command: 220, game: 260, type: 180, read: 600, paint: 400, dance: 300, rest: 160, sleep: 1400, wait: 250, done: 200, walk: 110 };
  // Walking is a 4-step cycle and idling an 8-frame breath; everything else flips between two frames.
  const POSE_FRAMES = { walk: 4, rest: 8 };

  function poseFor(actor, { moving, dragging, now, atStation = true }) {
    let pose = 'rest';
    let station = null;
    if (dragging) pose = 'dangle';
    else if (moving) pose = 'walk';
    else {
      switch (actor.state) {
        case 'think': pose = 'rest'; break;
        case 'work':
          station = STATIONS[actor.station] ? actor.station : 'code';
          pose = atStation ? STATIONS[station].pose : 'rest';
          break;
        case 'wait': pose = 'wait'; break;
        case 'done': pose = 'done'; break;
        case 'sleep': pose = 'sleep'; break;
        default: pose = 'rest';
      }
    }
    const speed = actor.state === 'think' && pose === 'rest' ? 220 : POSE_SPEED[pose] || 700;
    return { pose, frame: Math.floor(now / speed) % (POSE_FRAMES[pose] || 2), station };
  }

  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  function bubbleFor(actor, now) {
    if (actor.say && actor.say.until > now) return { text: actor.say.text, cls: actor.say.cls || '' };
    if (actor.focus) {
      const left = Math.max(0, actor.focus.endsAt - now);
      return actor.focus.phase === 'focus' ? { text: `🍅 ${mmss(left)}`, cls: 'focus' } : { text: `☕ 休息 ${mmss(left)}`, cls: 'success' };
    }
    if (actor.kind === 'user' || actor.kind === 'resident') return null;
    switch (actor.state) {
      case 'think': return { text: `💭 思考中${'.'.repeat(1 + (Math.floor(now / 400) % 3))}`, cls: '' };
      case 'work': return { text: `${actor.icon || '🛠️'} ${actor.label}`.trim(), cls: '' };
      case 'wait': return { text: `❗ 等你批准${actor.label ? `：${actor.label}` : ''}`, cls: 'alert' };
      case 'done': return { text: '✨ 完成！', cls: 'success' };
      default: return null;
    }
  }

  function infoRows(actor, now) {
    const mins = Math.floor((now - actor.startedAt) / 60000);
    const activity = actor.state === 'work' || actor.state === 'wait'
      ? `${STATE_LABEL[actor.state]} · ${actor.icon || ''} ${actor.label}`.replace(/\s+/g, ' ').trim()
      : STATE_LABEL[actor.state] || actor.state;
    const rows = [['狀態', activity]];
    if (actor.kind === 'user') {
      if (actor.focus) rows.push(['番茄鐘', `${actor.focus.phase === 'focus' ? '專注' : '休息'} ${mmss(Math.max(0, actor.focus.endsAt - now))}`]);
      rows.push(['陪伴', mins < 1 ? '剛剛' : `${mins} 分鐘`]);
    } else if (actor.kind === 'resident') {
      rows.push(['身分', '🏡 住在這裡的居民']);
      rows.push(['今天', mins < 1 ? '剛起床' : `醒著 ${mins} 分鐘`]);
    } else {
      rows.push(['最後交代', actor.prompt || '—']);
      rows.push(['上工', mins < 1 ? '剛剛' : `${mins} 分鐘`]);
      rows.push(['小幫手', actor.helpers ? `${actor.helpers} 位` : '—']);
      rows.push(['來源', actor.source === 'claude' ? `Claude Code · ${actor.id.split(':')[1].slice(0, 8)}` : actor.source]);
    }
    return rows;
  }

  // Custom Aseprite sheets: id -> { img, frames, tags }.
  const sheets = new Map();
  function loadSheets(assets) {
    sheets.clear();
    for (const c of assets?.characters || []) {
      const img = new Image();
      img.src = c.dataUrl;
      sheets.set(c.id, { img, ...Sprites.parseSheet(c.json) });
    }
  }

  // Draws an actor's sprite with its top-left at (x, y) on ctx.
  function drawActorAt(ctx, unit, x, y, actor, pose, frame, facing, opts, now) {
    const colors = Sprites.colorsFor(actor.hue ?? actor.id);
    if (actor.skin?.startsWith('custom:') && sheets.has(actor.skin)) {
      Sprites.drawCustomAt(ctx, unit, x, y, sheets.get(actor.skin), pose, now, facing);
    } else {
      Sprites.drawCharacterAt(ctx, unit, x, y, actor.skin || 'office', pose, frame, colors, facing, { accessory: actor.accessory, ...opts });
    }
  }

  // Room-scale (12x16) version; (x, y) is the top-left of the 14x18 mini grid.
  function drawMiniAt(ctx, unit, x, y, actor, pose, frame, facing, now) {
    if (actor.skin?.startsWith('custom:') && sheets.has(actor.skin)) {
      const half = unit / 2;
      Sprites.drawCustomAt(ctx, half, x + (Sprites.MINI.W * unit - Sprites.W * half) / 2, y + (Sprites.MINI.H * unit - Sprites.H * half), sheets.get(actor.skin), pose, now, facing);
      return;
    }
    Sprites.drawMiniAt(ctx, unit, x, y, actor.skin || 'office', pose, frame, Sprites.colorsFor(actor.hue ?? actor.id), facing, { accessory: actor.accessory });
  }

  const colorOf = (actor) => Sprites.colorsFor(actor.hue ?? actor.id);

  window.Common = { colorOf, drawMiniAt, STATE_LABEL, poseFor, bubbleFor, infoRows, loadSheets, drawActorAt, mmss, sheets };
})();
