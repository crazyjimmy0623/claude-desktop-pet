/* global pet, drawKnight, SPRITE */
// One knight per Claude Code session. Hook events set its state; the loop below animates it.
const SCALE = 3;
const MINI_SCALE = 2;
const DPR = window.devicePixelRatio || 1;
const KNIGHT_W = SPRITE.W * SCALE;
const MAX_MINIS = 3;
const DONE_MS = 6000;
const SLEEP_AFTER_MS = 3 * 60 * 1000;
const STALE_MS = 2 * 60 * 60 * 1000;
const GRAVITY = 1800;
const SPACING = 170; // wide enough that neighbouring speech bubbles don't overlap

const TOOL_ICONS = {
  Read: '📖', Grep: '🔍', Glob: '🔍', ToolSearch: '🔍', LS: '📂',
  Edit: '🔨', Write: '🔨', MultiEdit: '🔨', NotebookEdit: '🔨',
  Bash: '⚡', PowerShell: '⚡',
  WebFetch: '🌐', WebSearch: '🌐',
  Agent: '🧙', Task: '🧙',
  Skill: '📜', TodoWrite: '📋', AskUserQuestion: '❓',
};
const STATE_LABEL = {
  idle: '待命', think: '思考中', work: '工作中', wait: '等你批准', done: '完成！', sleep: '睡覺中', leaving: '下班',
};
const OUCH = ['唉唷！', '頭好暈…', '放我下來啦', '咚！'];

const stage = document.getElementById('stage');
const knights = new Map();
let drag = null;
let mouseIgnored = true;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function colorsFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return { main: `hsl(${hue}, 65%, 55%)`, dark: `hsl(${hue}, 60%, 38%)` };
}

function makeCanvas(scale, className) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE.W * scale * DPR;
  canvas.height = SPRITE.H * scale * DPR;
  canvas.style.width = `${SPRITE.W * scale}px`;
  canvas.style.height = `${SPRITE.H * scale}px`;
  if (className) canvas.className = className;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function freeSpot() {
  const W = window.innerWidth;
  const taken = [...knights.values()].map((k) => k.target ?? k.x);
  for (let x = W - 150; x > 80; x -= SPACING) {
    if (taken.every((t) => Math.abs(t - x) > SPACING - 30)) return x;
  }
  return 80 + Math.random() * (W - 200);
}

function spawn(ev) {
  const now = Date.now();
  const el = document.createElement('div');
  el.className = 'knight';
  const helpersEl = document.createElement('div');
  helpersEl.className = 'helpers';
  const bubble = document.createElement('div');
  bubble.className = 'bubble hidden';
  const zzz = document.createElement('div');
  zzz.className = 'zzz hidden';
  zzz.innerHTML = '<span>z</span><span>z</span><span>Z</span>';
  const { canvas, ctx } = makeCanvas(SCALE, 'body hit');
  const plate = document.createElement('div');
  plate.className = 'nameplate';
  el.append(helpersEl, bubble, zzz, canvas, plate);
  stage.append(el);

  const colors = colorsFor(ev.session);
  el.style.setProperty('--c', colors.main);
  const k = {
    id: ev.session, el, canvas, ctx, bubble, zzz, plate, helpersEl, colors,
    minis: [],
    project: ev.project, cwd: ev.cwd,
    state: 'idle', since: now, startedAt: now, lastEvent: now,
    x: freeSpot(), y: 170, vy: 0, facing: -1,
    target: null, nextWander: now + 4000 + Math.random() * 6000,
    tool: '', detail: '', icon: '', kind: 'forge', prompt: '',
    helpers: 0, say: '', sayClass: '', sayUntil: 0,
    dragging: false, wasDropped: false, card: null, drawKey: '',
  };
  plate.textContent = k.project;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    drag = { k, sx: e.clientX, sy: e.clientY, moved: false };
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    pet.knightMenu({ session: k.id, cwd: k.cwd, project: k.project });
  });

  knights.set(k.id, k);
  pet.reportCount(knights.size);
  return k;
}

function remove(k) {
  k.el.remove();
  knights.delete(k.id);
  pet.reportCount(knights.size);
}

function setState(k, state) {
  if (k.state === 'leaving') return;
  k.state = state;
  k.since = Date.now();
  if (state !== 'idle') k.target = null;
}

function say(k, text, ms, cls = '') {
  k.say = text;
  k.sayClass = cls;
  k.sayUntil = Date.now() + ms;
}

function leave(k) {
  if (k.state === 'leaving') return;
  closeCard(k);
  setState(k, 'leaving');
  k.helpers = 0;
  say(k, '👋 收工！', 2500);
  k.target = k.x > window.innerWidth / 2 ? window.innerWidth + 80 : -80;
}

function onHookEvent(ev) {
  let k = knights.get(ev.session);
  if (ev.event === 'SessionEnd') {
    if (k) leave(k);
    return;
  }
  if (!k) k = spawn(ev);
  if (k.state === 'leaving') return;
  k.lastEvent = Date.now();
  if (ev.cwd && ev.project !== k.project) {
    k.project = ev.project;
    k.cwd = ev.cwd;
    k.plate.textContent = k.project;
  }
  const fromSubagent = !!ev.agentId;

  switch (ev.event) {
    case 'SessionStart':
      if (ev.source === 'compact') break;
      setState(k, 'idle');
      say(k, ev.source === 'resume' ? '⚔️ 我回來了！' : '⚔️ 上工！', 2500);
      break;
    case 'UserPromptSubmit':
      k.prompt = ev.prompt;
      setState(k, 'think');
      if (ev.prompt) say(k, `📝 ${ev.prompt}`, 2500);
      break;
    case 'PreToolUse':
      if (fromSubagent) break;
      k.tool = ev.tool;
      k.detail = ev.detail;
      k.kind = ev.kind;
      k.icon = TOOL_ICONS[ev.tool] || (ev.rawTool?.startsWith('mcp__') ? '🔌' : '🛠️');
      setState(k, 'work');
      break;
    case 'PostToolUse':
      if (fromSubagent) break;
      if (k.state === 'work' || k.state === 'wait') setState(k, 'think');
      break;
    case 'PostToolUseFailure':
      if (fromSubagent) break;
      setState(k, 'think');
      say(k, `💥 ${ev.tool} 失敗了`, 2500);
      break;
    case 'PermissionRequest':
      k.tool = ev.tool;
      k.detail = ev.detail;
      setState(k, 'wait');
      break;
    case 'Notification':
      if (ev.notificationType === 'permission_prompt' || /permission/i.test(ev.message)) {
        setState(k, 'wait');
      } else if (ev.notificationType === 'idle_prompt' || /waiting for your input/i.test(ev.message)) {
        if (k.state !== 'sleep') say(k, '💬 等你回覆～', 6000);
      } else if (ev.message) {
        say(k, `🔔 ${ev.message}`, 5000);
      }
      break;
    case 'Stop':
      setState(k, 'done');
      break;
    case 'StopFailure':
      setState(k, 'idle');
      say(k, '💥 出錯了…', 5000);
      break;
    case 'SubagentStart':
      k.helpers += 1;
      break;
    case 'SubagentStop':
      k.helpers = Math.max(0, k.helpers - 1);
      break;
  }
}

function pickWander(k, now) {
  const W = window.innerWidth;
  for (let tries = 0; tries < 6; tries++) {
    const step = (60 + Math.random() * 160) * (Math.random() < 0.5 ? -1 : 1);
    const t = clamp(k.x + step, 70, W - 70);
    const crowded = [...knights.values()].some((o) => o !== k && Math.abs((o.target ?? o.x) - t) < SPACING - 30);
    if (!crowded) {
      k.target = t;
      return;
    }
  }
  k.nextWander = now + 5000;
}

function poseFor(k, moving, now) {
  if (k.dragging) return ['dangle', 0];
  if (moving) return ['walk', Math.floor(now / 160) % 2];
  switch (k.state) {
    case 'think': return ['rest', Math.floor(now / 900) % 2];
    case 'work': return k.kind === 'read' ? ['read', Math.floor(now / 600) % 2] : ['forge', Math.floor(now / 220) % 2];
    case 'wait': return ['wait', Math.floor(now / 250) % 2];
    case 'done': return ['done', Math.floor(now / 200) % 2];
    case 'sleep': return ['sleep', Math.floor(now / 1400) % 2];
    default: return ['rest', Math.floor(now / 700) % 2];
  }
}

function bubbleFor(k, now) {
  if (k.card) return null;
  if (now < k.sayUntil) return [k.say, k.sayClass];
  switch (k.state) {
    case 'think': return [`💭 思考中${'.'.repeat(1 + (Math.floor(now / 400) % 3))}`, ''];
    case 'work': return [`${k.icon} ${k.tool}${k.detail ? ` · ${k.detail}` : ''}`, ''];
    case 'wait': return [`❗ 等你批准${k.tool ? `：${k.tool}` : ''}`, 'alert'];
    case 'done': return ['✨ 完成！', 'success'];
    default: return null;
  }
}

function renderMinis(k, now) {
  const want = Math.min(k.helpers, MAX_MINIS);
  while (k.minis.length < want) {
    const m = makeCanvas(MINI_SCALE);
    m.key = '';
    k.minis.push(m);
    k.helpersEl.append(m.canvas);
  }
  while (k.minis.length > want) k.minis.pop().canvas.remove();
  k.minis.forEach((m, i) => {
    const frame = Math.floor(now / 240 + i * 0.5) % 2;
    const key = `${frame}`;
    if (m.key !== key) {
      m.key = key;
      drawKnight(m.ctx, MINI_SCALE * DPR, 'forge', frame, k.colors, 1);
    }
  });
  let more = k.helpersEl.querySelector('.more');
  if (k.helpers > MAX_MINIS) {
    if (!more) {
      more = document.createElement('div');
      more.className = 'more';
      k.helpersEl.append(more);
    }
    more.textContent = `+${k.helpers - MAX_MINIS}`;
  } else if (more) {
    more.remove();
  }
}

function update(k, dt, now) {
  // Falling after a drop or a spawn from the sky.
  if (!k.dragging && k.y > 0) {
    k.vy -= GRAVITY * dt;
    k.y = Math.max(0, k.y + k.vy * dt);
    if (k.y === 0) {
      k.vy = 0;
      if (k.wasDropped) {
        k.wasDropped = false;
        say(k, pick(OUCH), 1500);
      }
    }
  }

  if (k.state === 'done' && now - k.since > DONE_MS) setState(k, 'idle');
  if (k.state === 'idle' && now - k.since > SLEEP_AFTER_MS) setState(k, 'sleep');
  if (k.state !== 'leaving' && now - k.lastEvent > STALE_MS) leave(k);

  let moving = false;
  if (!k.dragging && k.y === 0 && (k.state === 'idle' || k.state === 'leaving')) {
    if (k.state === 'idle' && k.target == null && now > k.nextWander) pickWander(k, now);
    if (k.target != null) {
      const d = k.target - k.x;
      const speed = k.state === 'leaving' ? 80 : 30;
      if (Math.abs(d) < 1) {
        k.x = k.target;
        k.target = null;
        k.nextWander = now + 5000 + Math.random() * 10000;
        if (k.state === 'leaving') {
          remove(k);
          return;
        }
      } else {
        k.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        k.facing = Math.sign(d);
        moving = true;
      }
    }
  }

  const [pose, frame] = poseFor(k, moving, now);
  const key = `${pose}:${frame}:${k.facing}`;
  if (key !== k.drawKey) {
    k.drawKey = key;
    drawKnight(k.ctx, SCALE * DPR, pose, frame, k.colors, k.facing);
  }

  const hop = k.state === 'wait' && !k.dragging ? Math.abs(Math.sin(now / 160)) * 8 : 0;
  k.el.style.transform = `translate(${Math.round(k.x - KNIGHT_W / 2)}px, ${-Math.round(k.y + hop)}px)`;
  k.el.classList.toggle('dragging', k.dragging);
  // Whoever needs attention draws on top of their neighbours.
  k.el.style.zIndex = k.card || k.dragging ? 4 : k.state === 'wait' ? 3 : k.state === 'done' ? 2 : 1;

  const b = bubbleFor(k, now);
  k.bubble.classList.toggle('hidden', !b);
  if (b) {
    if (k.bubble.textContent !== b[0]) k.bubble.textContent = b[0];
    const cls = `bubble ${b[1]}`.trim();
    if (k.bubble.className !== cls) k.bubble.className = cls;
  }
  k.zzz.classList.toggle('hidden', k.state !== 'sleep' || k.dragging);
  renderMinis(k, now);
  if (k.card && now >= k.cardUntil) closeCard(k);
  else if (k.card && Math.floor(now / 1000) !== k.cardSecond) fillCard(k, now);
}

// ---- Info card -------------------------------------------------------------

function fillCard(k, now) {
  k.cardSecond = Math.floor(now / 1000);
  const mins = Math.floor((now - k.startedAt) / 60000);
  const activity = k.state === 'work' || k.state === 'wait'
    ? `${STATE_LABEL[k.state]} · ${k.icon || ''} ${k.tool} ${k.detail}`.trim()
    : STATE_LABEL[k.state];
  const rows = [
    ['狀態', activity],
    ['最後指令', k.prompt || '—'],
    ['上工', mins < 1 ? '剛剛' : `${mins} 分鐘`],
    ['小幫手', k.helpers ? `${k.helpers} 位` : '—'],
    ['Session', k.id.slice(0, 8)],
  ];
  k.card.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = `⚔️ ${k.project}`;
  k.card.append(h);
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    const b = document.createElement('b');
    b.textContent = label;
    const s = document.createElement('span');
    s.textContent = value;
    s.title = value;
    row.append(b, s);
    k.card.append(row);
  }
}

function openCard(k) {
  k.card = document.createElement('div');
  k.card.className = 'card hit';
  k.card.addEventListener('mousedown', () => closeCard(k));
  k.el.append(k.card);
  k.cardUntil = Date.now() + 10000;
  fillCard(k, Date.now());
}

function closeCard(k) {
  if (!k.card) return;
  k.card.remove();
  k.card = null;
}

function toggleCard(k) {
  if (k.card) closeCard(k);
  else openCard(k);
}

// ---- Mouse: click-through except over knights, plus drag & drop ------------

function setMouseIgnored(ignore) {
  if (ignore === mouseIgnored) return;
  mouseIgnored = ignore;
  pet.setIgnoreMouse(ignore);
}

window.addEventListener('mousemove', (e) => {
  if (drag) {
    const { k } = drag;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
      drag.moved = true;
      k.dragging = true;
      k.target = null;
      closeCard(k);
    }
    if (drag.moved) {
      k.x = clamp(e.clientX, 40, window.innerWidth - 40);
      k.y = clamp(window.innerHeight - e.clientY - 80, 0, window.innerHeight - 130);
      k.vy = 0;
    }
  }
  const overKnight = !!e.target.closest?.('.hit');
  setMouseIgnored(!overKnight && !drag);
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  const { k } = drag;
  if (drag.moved) {
    k.dragging = false;
    k.wasDropped = k.y > 20;
    k.nextWander = Date.now() + 4000;
  } else {
    toggleCard(k);
  }
  drag = null;
});

// Forwarded mouse events stop when the cursor leaves the window.
document.addEventListener('mouseleave', () => {
  if (!drag) setMouseIgnored(true);
});

// ---- Wiring ----------------------------------------------------------------

pet.onEvent(onHookEvent);

pet.onCommand((cmd) => {
  if (cmd.type === 'remove') {
    const k = knights.get(cmd.session);
    if (k) leave(k);
  } else if (cmd.type === 'clear') {
    for (const k of knights.values()) leave(k);
  } else if (cmd.type === 'regroup') {
    const W = window.innerWidth;
    [...knights.values()].forEach((k, i) => {
      k.x = clamp(W - 150 - i * SPACING, 70, W - 70);
      k.y = 120;
      k.target = null;
      k.nextWander = Date.now() + 6000;
    });
  }
});

let last = performance.now();
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const now = Date.now();
  for (const k of [...knights.values()]) update(k, dt, now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
