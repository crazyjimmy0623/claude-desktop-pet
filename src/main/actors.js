// The single source of truth for every character on screen. Event sources (Claude hooks,
// the generic API, the activity monitor, the pomodoro timer) feed in; all windows render the snapshot.
const { EventEmitter } = require('events');
const path = require('path');
const { STATIONS, ITEMS } = require('../shared/catalog');
const { stationForApp } = require('./app-map');
const { clip } = require('./summarize');

const DONE_MS = 6000;
const SLEEP_AFTER_MS = 3 * 60 * 1000;
const STALE_MS = 2 * 60 * 60 * 1000;
const LEAVE_MS = 6000;

const TOOL_ICONS = {
  Read: '📖', Grep: '🔍', Glob: '🔍', ToolSearch: '🔍', LS: '📂',
  Edit: '🔨', Write: '🔨', MultiEdit: '🔨', NotebookEdit: '🔨',
  Bash: '⚡', PowerShell: '⚡', WebFetch: '🌐', WebSearch: '🌐',
  Agent: '🧙', Task: '🧙', Skill: '📜', TodoWrite: '📋', AskUserQuestion: '❓',
};
const VALID_STATES = new Set(['idle', 'think', 'work', 'wait', 'done', 'sleep']);
const SKIN_IDS = new Set(ITEMS.filter((i) => i.type === 'skin').map((i) => i.id.slice(5)));

class Actors extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.map = new Map();
    this.pending = false;
    this.foreground = '';
    this.idleSeconds = 0;
    this.activeSeconds = 0;
    this.focus = null;
    this.customSkins = new Set();
    this.colorSeq = 0;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  // ---- Snapshot ------------------------------------------------------------

  resolveLook(a) {
    const { characters } = this.store.settings;
    const owned = new Set(this.store.progress.owned);
    const pick = a.kind === 'user' ? characters.user : (characters.projects[a.name] || characters.ai);
    const fallback = a.kind === 'user' ? 'office' : 'droid';
    let skin = pick?.skin || fallback;
    if (skin === 'auto') {
      // Rotate through owned characters, skipping the one the user wears.
      const userSkin = characters.user?.skin;
      const pool = [...SKIN_IDS].filter((s) => owned.has(`skin:${s}`) && s !== userSkin);
      skin = pool.length ? pool[a.seq % pool.length] : fallback;
    }
    const isCustom = skin.startsWith('custom:') && this.customSkins.has(skin);
    if (!isCustom && !(SKIN_IDS.has(skin) && owned.has(`skin:${skin}`))) skin = fallback;
    const accessory = pick?.accessory && owned.has(`acc:${pick.accessory}`) ? pick.accessory : null;
    return { skin, accessory };
  }

  list() {
    return [...this.map.values()].map((a) => ({
      id: a.id, kind: a.kind, source: a.source, name: a.name, cwd: a.cwd,
      state: a.state, station: a.station, label: a.label, icon: a.icon, prompt: a.prompt,
      helpers: a.helpers, since: a.since, startedAt: a.startedAt, hue: a.hue,
      say: a.say && a.say.until > Date.now() ? a.say : null,
      focus: a.kind === 'user' ? this.focus : null,
      ...this.resolveLook(a),
    }));
  }

  changed() {
    if (this.pending) return;
    this.pending = true;
    setImmediate(() => {
      this.pending = false;
      this.emit('change', this.list());
    });
  }

  // ---- Helpers -------------------------------------------------------------

  ensure(id, init) {
    let a = this.map.get(id);
    if (!a) {
      const now = Date.now();
      a = {
        id, kind: 'ai', source: 'api', name: '', cwd: '', state: 'idle', station: null, label: '', icon: '', prompt: '',
        helpers: 0, since: now, startedAt: now, lastEvent: now, turnStart: now, say: null, ...init,
        // Golden-angle hues keep every new character's colour far from the ones already on screen.
        seq: this.colorSeq,
        hue: id === 'user' ? 35 : Math.round((200 + this.colorSeq++ * 137.508) % 360),
      };
      this.map.set(id, a);
      this.changed();
    }
    return a;
  }

  setState(a, state, station = null) {
    if (a.state === 'leaving') return;
    if (a.state === state && a.station === station) return;
    a.state = state;
    a.station = station;
    a.since = Date.now();
    this.changed();
  }

  say(a, text, ms = 3000, cls = '') {
    if (!a) return;
    a.say = { text, cls, until: Date.now() + ms };
    this.changed();
  }

  sayTo(id, text, ms, cls) {
    this.say(this.map.get(id), text, ms, cls);
  }

  leave(a) {
    if (a.state === 'leaving') return;
    a.state = 'leaving';
    a.station = null;
    a.helpers = 0;
    this.say(a, '👋 收工！', 2500);
    setTimeout(() => {
      this.map.delete(a.id);
      this.changed();
    }, LEAVE_MS);
  }

  remove(id) {
    const a = this.map.get(id);
    if (a && a.kind !== 'user') this.leave(a);
  }

  clearAll() {
    for (const a of this.map.values()) if (a.kind !== 'user') this.leave(a);
  }

  // ---- Claude Code hooks ----------------------------------------------------

  claude(ev) {
    if (!this.store.settings.sources.claude) return;
    const id = `claude:${ev.session}`;
    let a = this.map.get(id);
    if (ev.event === 'SessionEnd') {
      if (a) this.leave(a);
      return;
    }
    if (!a) a = this.ensure(id, { kind: 'ai', source: 'claude', name: ev.project, cwd: ev.cwd });
    if (a.state === 'leaving') return;
    a.lastEvent = Date.now();
    if (ev.cwd && ev.project !== a.name) {
      a.name = ev.project;
      a.cwd = ev.cwd;
      this.changed();
    }
    const fromSubagent = !!ev.agentId;

    switch (ev.event) {
      case 'SessionStart':
        if (ev.source === 'compact') break;
        this.setState(a, 'idle');
        this.say(a, ev.source === 'resume' ? '⚔️ 我回來了！' : '⚔️ 上工！', 2500);
        break;
      case 'UserPromptSubmit':
        a.prompt = ev.prompt || '';
        a.turnStart = Date.now();
        this.setState(a, 'think', 'code');
        if (ev.prompt) {
          const user = this.map.get('user');
          if (user && user.state !== 'sleep') {
            // The user's own character walks over and says it.
            this.say(user, `💬 ${ev.prompt}`, 5000);
            this.emit('talk', user, a);
          } else {
            this.say(a, `📝 ${ev.prompt}`, 2500);
          }
        }
        break;
      case 'PreToolUse':
        if (fromSubagent) break;
        a.label = `${ev.tool}${ev.detail ? ` · ${ev.detail}` : ''}`;
        a.icon = TOOL_ICONS[ev.tool] || (ev.rawTool?.startsWith('mcp__') ? '🔌' : '🛠️');
        a.since = Date.now();
        this.setState(a, 'work', ev.station);
        this.changed();
        this.emit('tool', a, ev);
        break;
      case 'PostToolUse':
        if (fromSubagent) break;
        if (a.state === 'work' || a.state === 'wait') this.setState(a, 'think', 'code');
        break;
      case 'PostToolUseFailure':
        if (fromSubagent) break;
        this.setState(a, 'think', 'code');
        this.say(a, `💥 ${ev.tool} 失敗了`, 2500);
        this.emit('failure', a, ev);
        break;
      case 'PermissionRequest':
        a.label = ev.tool;
        this.setState(a, 'wait', 'wait');
        this.emit('permission', a);
        break;
      case 'Notification':
        if (ev.notificationType === 'permission_prompt' || /permission/i.test(ev.message)) this.setState(a, 'wait', 'wait');
        else if (ev.notificationType === 'idle_prompt' || /waiting for your input/i.test(ev.message)) {
          if (a.state !== 'sleep') this.say(a, '💬 等你回覆～', 6000);
        } else if (ev.message) this.say(a, `🔔 ${ev.message}`, 5000);
        break;
      case 'Stop':
        this.setState(a, 'done');
        this.emit('turn', a, { duration: Date.now() - a.turnStart });
        break;
      case 'StopFailure':
        this.setState(a, 'idle');
        this.say(a, '💥 出錯了…', 5000);
        break;
      case 'SubagentStart':
        a.helpers += 1;
        this.changed();
        this.emit('helpers', a);
        break;
      case 'SubagentStop':
        a.helpers = Math.max(0, a.helpers - 1);
        this.changed();
        break;
      case 'PreCompact':
        this.emit('compact', a);
        break;
    }
  }

  // ---- Generic API & other tools -------------------------------------------

  api(p) {
    if (!p || typeof p !== 'object') return;
    const id = `api:${String(p.id || p.name || 'default').slice(0, 80)}`;
    let a = this.map.get(id);
    if (p.state === 'end') {
      if (a) this.leave(a);
      return;
    }
    a = a || this.ensure(id, { kind: 'ai', source: String(p.source || 'api'), name: clip(p.name || p.id || 'API', 30) });
    if (a.state === 'leaving') return;
    a.lastEvent = Date.now();
    const station = STATIONS[p.station] ? p.station : null;
    a.label = clip(p.label || (station ? STATIONS[station].name : ''), 40);
    a.icon = clip(p.icon || (station ? STATIONS[station].icon : ''), 4);
    if (VALID_STATES.has(p.state)) {
      if (p.state === 'think') a.turnStart = Date.now();
      this.setState(a, p.state, station || (p.state === 'wait' ? 'wait' : null));
      if (p.state === 'done') this.emit('turn', a, { duration: Date.now() - a.turnStart });
    }
    if (p.say) this.say(a, clip(p.say, 60), 4000);
    this.changed();
  }

  // Codex CLI `notify` payload: { type: 'agent-turn-complete', 'thread-id', cwd, 'last-assistant-message' }.
  codex(p) {
    if (!p || typeof p !== 'object') return;
    const id = `codex:${p['thread-id'] || p.thread_id || 'default'}`;
    const name = p.cwd ? path.win32.basename(path.posix.basename(String(p.cwd))) : 'Codex';
    const a = this.ensure(id, { kind: 'ai', source: 'codex', name, cwd: p.cwd || '' });
    a.lastEvent = Date.now();
    if (p.type === 'agent-turn-complete') {
      this.setState(a, 'done');
      this.emit('turn', a, { duration: 0 });
    }
  }

  // ---- The user's own activity ---------------------------------------------

  setForeground(app) {
    this.foreground = app;
    this.updateUser();
  }

  setIdle(seconds) {
    this.idleSeconds = seconds;
    this.updateUser();
  }

  setFocus(focus) {
    this.focus = focus;
    this.updateUser();
    this.changed();
  }

  updateUser() {
    const s = this.store.settings;
    const existing = this.map.get('user');
    if (!s.sources.activity) {
      if (existing) {
        this.map.delete('user');
        this.changed();
      }
      return;
    }
    const a = existing || this.ensure('user', { kind: 'user', source: 'activity', name: s.userName });
    a.lastEvent = Date.now();
    if (a.name !== s.userName) {
      a.name = s.userName;
      this.changed();
    }
    const away = this.idleSeconds >= s.idleMinutes * 60;
    if (away) {
      if (a.state !== 'sleep') {
        a.label = '離開中';
        this.setState(a, 'sleep', 'rest');
      }
      return;
    }
    if (a.state === 'sleep') this.say(a, '👋 歡迎回來！', 3000);
    if (this.focus?.phase === 'break') {
      a.label = '休息中';
      a.icon = '☕';
      this.setState(a, 'work', 'coffee');
      return;
    }
    const station = stationForApp(this.foreground, s.appMap);
    if (station === 'ignore') {
      if (a.state === 'sleep') this.setState(a, 'idle');
      return;
    }
    if (station) {
      a.label = `${STATIONS[station].name} · ${this.foreground}`;
      a.icon = STATIONS[station].icon;
      this.setState(a, 'work', station);
    } else {
      a.label = this.foreground;
      a.icon = '';
      this.setState(a, 'idle');
    }
  }

  // ---- Clock ---------------------------------------------------------------

  tick() {
    const now = Date.now();
    for (const a of this.map.values()) {
      if (a.kind === 'user') continue;
      if (a.state === 'done' && now - a.since > DONE_MS) this.setState(a, 'idle');
      if (a.state === 'idle' && now - a.since > SLEEP_AFTER_MS) this.setState(a, 'sleep', 'rest');
      if (a.state !== 'leaving' && now - a.lastEvent > STALE_MS) this.leave(a);
    }
    const user = this.map.get('user');
    if (user && user.state !== 'sleep') {
      this.activeSeconds += 1;
      if (this.activeSeconds >= 60) {
        this.activeSeconds = 0;
        this.emit('active-minute');
      }
    }
  }
}

module.exports = { Actors, TOOL_ICONS };
