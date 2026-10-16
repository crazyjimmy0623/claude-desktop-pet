// Settings, progress and the room layout, persisted as one JSON file in userData.
const { app } = require('electron');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { ITEMS } = require('../shared/catalog');

const STARTER_ITEMS = ITEMS.filter((i) => i.rarity === 'starter').map((i) => i.id);

const DEFAULTS = {
  settings: {
    mode: 'strip', // strip | room
    layoutVersion: 6,
    alwaysOnTop: true,
    hideInFullscreen: true,
    scale: 3,
    roomZoom: 2,
    sources: { claude: true, activity: true },
    userName: '你',
    idleMinutes: 5,
    appMap: {}, // process name (lower case) -> station id or 'ignore'; overrides the built-in table
    characters: {
      user: { skin: 'office', accessory: null },
      ai: { skin: 'droid', accessory: null }, // 'auto' = a different owned character per session
      projects: {}, // project name -> { skin, accessory }
    },
    pomodoro: { focus: 25, break: 5 },
    reminders: { water: 0, stretch: 0 }, // minutes between reminders, 0 = off
    ambient: true,
  },
  progress: {
    coins: 20,
    xp: 0,
    owned: STARTER_ITEMS,
    achievements: {}, // id -> unlock timestamp
    stats: {
      turns: 0, toolCalls: 0, edits: 0, reads: 0, failures: 0, permissions: 0, subagents: 0, maxHelpers: 0,
      nightTurns: 0, earlyTurns: 0, bugs: 0, focus: 0, chests: 0, ufos: 0, pulls: 0, activeMinutes: 0, streak: 0,
    },
    days: {}, // 'YYYY-MM-DD' -> { turns, tools, activeMinutes, focus, projects: {}, toolsBy: {} }
  },
  room: null,
};

function mergeDefaults(defaults, value) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults;
  if (defaults && typeof defaults === 'object') {
    const out = { ...(value && typeof value === 'object' ? value : {}) };
    for (const [k, v] of Object.entries(defaults)) out[k] = mergeDefaults(v, out[k]);
    return out;
  }
  return value === undefined ? defaults : value;
}

class Store extends EventEmitter {
  constructor() {
    super();
    this.file = path.join(app.getPath('userData'), 'deskmates.json');
    let raw = {};
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      // First run, or a corrupt file: start from defaults.
    }
    this.data = mergeDefaults(DEFAULTS, raw);
    for (const id of STARTER_ITEMS) if (!this.data.progress.owned.includes(id)) this.data.progress.owned.push(id);
    const s = this.data.settings;
    if (s.mode !== 'room') s.mode = 'strip';
    // v2 rooms match Pixel Crew's proportions (28x21 tiles, 12x16 people at 2x); older rooms are reset once.
    // v3 docks a long room above the taskbar; older room layouts are reset once.
    if ((raw.settings?.layoutVersion || 0) < 3) {
      this.data.room = null;
    }
    // v4 draws art on a 2x fine grid; roomZoom now counts device pixels per fine pixel.
    if ((raw.settings?.layoutVersion || 0) < 4) {
      s.layoutVersion = 4;
      s.roomZoom = 2;
    }
    delete s.roomBounds;
    // v5 drops the medieval set: knight -> commander, mage -> scientist, crown -> VR, goblin/dragon -> bug/UFO.
    if ((raw.settings?.layoutVersion || 0) < 5) {
      s.layoutVersion = 5;
      const RENAME = { 'skin:knight': 'skin:commander', 'skin:mage': 'skin:scientist', 'acc:crown': 'acc:vr' };
      const p = this.data.progress;
      p.owned = [...new Set(p.owned.map((id) => RENAME[id] || id))];
      const slot = (c) => {
        if (!c) return;
        if (c.skin === 'knight') c.skin = 'commander';
        if (c.skin === 'mage') c.skin = 'scientist';
        if (c.accessory === 'crown') c.accessory = 'vr';
      };
      slot(s.characters.user);
      slot(s.characters.ai);
      Object.values(s.characters.projects || {}).forEach(slot);
      const st = p.stats;
      st.bugs = (st.bugs || 0) + (st.goblins || 0);
      st.ufos = (st.ufos || 0) + (st.dragons || 0);
      delete st.goblins;
      delete st.dragons;
      for (const [from, to] of [['goblins_10', 'bugs_10'], ['dragon', 'ufo']]) {
        if (p.achievements[from]) p.achievements[to] = p.achievements[from];
        delete p.achievements[from];
      }
    }
    // v6 gives AI sessions the scary robot by default.
    if ((raw.settings?.layoutVersion || 0) < 6) {
      s.layoutVersion = 6;
      if (s.characters.ai?.skin === 'auto') s.characters.ai.skin = 'droid';
    }
    // Rooms from before themes existed switch to the cyberpunk look once.
    if (this.data.room && !this.data.room.theme) Object.assign(this.data.room, { theme: 'cyber', wall: 'cyber', floor: 'cyber' });
    this.saveTimer = null;
  }

  get settings() { return this.data.settings; }
  get progress() { return this.data.progress; }
  get room() { return this.data.room; }

  updateSettings(patch) {
    this.data.settings = mergeDefaults(this.data.settings, { ...this.data.settings, ...patch });
    this.save();
    this.emit('settings', this.data.settings);
  }

  setRoom(room) {
    this.data.room = room;
    this.save();
    this.emit('room', room);
  }

  touchProgress() {
    this.save();
    this.emit('progress', this.data.progress);
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 800);
  }

  flush() {
    clearTimeout(this.saveTimer);
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, DEFAULTS };
