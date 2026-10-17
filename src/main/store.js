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
    layoutVersion: 10,
    alwaysOnTop: true,
    hideInFullscreen: true,
    scale: 3,
    roomZoom: 2,
    timeOfDay: 'clock', // clock | day | dusk | night
    weather: 'auto', // auto | clear | rain | snow | petals | leaves
    roomPos: null, // { right, bottom } of the floating room window
    sources: { claude: true, activity: true },
    userName: '你',
    idleMinutes: 5,
    appMap: {}, // process name (lower case) -> station id or 'ignore'; overrides the built-in table
    characters: {
      user: { skin: 'office', accessory: null },
      ai: { skin: 'droid', accessory: null }, // 'auto' = a different owned character per session
      projects: {}, // project name -> { skin, accessory }
      residents: [], // characters who simply live in the room: { id, name, skin, accessory }
      customs: [], // characters made in the studio: { id, name, recipe } - worn as skin 'mix:<id>'
      drawings: [], // hand-drawn characters and friends' cards: { id, name, art | recipe, friend } - skin 'draw:<id>'
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
      flowSessions: 0, checkInBest: 0,
    },
    checkIn: { last: '', streak: 0 }, // the last day a check-in was paid, and the run of days
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

// Test mode (`npm run test-mode`): coins never run out and everything is unlocked, played
// on a copy of the real save so nothing done while testing reaches it.
const TEST_COINS = 999999;

class Store extends EventEmitter {
  constructor({ test = false } = {}) {
    super();
    this.test = test;
    const dir = app.getPath('userData');
    this.file = path.join(dir, test ? 'deskmates-test.json' : 'deskmates.json');
    if (test && !fs.existsSync(this.file)) {
      try { fs.copyFileSync(path.join(dir, 'deskmates.json'), this.file); } catch { /* no real save yet: start fresh */ }
    }
    let raw = {};
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (err) {
      // First run: start from defaults. A save that can't be read is set aside first, so starting
      // over never writes on top of someone's coins; if even that fails, nothing is written at all.
      if (err.code !== 'ENOENT') {
        const aside = `${this.file}.unreadable-${Date.now()}`;
        try {
          fs.renameSync(this.file, aside);
          console.error(`[deskmates] could not read the save (${err.message}); kept it as ${aside}`);
        } catch {
          this.readOnly = true;
          console.error(`[deskmates] could not read the save (${err.message}); not saving this run`);
        }
      }
    }
    this.data = mergeDefaults(DEFAULTS, raw);
    for (const id of STARTER_ITEMS) if (!this.data.progress.owned.includes(id)) this.data.progress.owned.push(id);
    // Things taken out of the game (Bru and Okai) leave the collection, and whoever wore one
    // changes back to the usual look.
    const known = new Set(ITEMS.map((i) => i.id));
    this.data.progress.owned = this.data.progress.owned.filter((id) => known.has(id));
    const wearable = (skin) => typeof skin !== 'string' || skin === 'auto' || /^(mix|draw|custom):/.test(skin) || known.has(`skin:${skin}`);
    const chars = this.data.settings.characters;
    for (const [slot, usual] of [[chars.user, 'office'], [chars.ai, 'droid'], ...Object.values(chars.projects || {}).map((x) => [x, 'droid']),
      ...(chars.residents || []).map((x) => [x, 'office'])]) {
      if (slot && !wearable(slot.skin)) slot.skin = usual;
    }
    if (test) {
      for (const i of ITEMS) if (!this.data.progress.owned.includes(i.id)) this.data.progress.owned.push(i.id);
      this.data.progress.coins = TEST_COINS;
    }
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
    // v7 replaced the long flat room with the isometric diorama; v8 made it a tower; v9 a street
    // corner; v10 adds the landing below the shop.
    if ((raw.settings?.layoutVersion || 0) < 10) {
      s.layoutVersion = 10;
      this.data.room = null;
      s.roomZoom = 2;
    }
    this.saveTimer = null;
  }

  get settings() { return this.data.settings; }
  get progress() { return this.data.progress; }
  get room() { return this.data.room; }

  updateSettings(patch) {
    // Against the real defaults: with the current settings as defaults, a key the patch dropped
    // (a deleted app-map row, a forgotten project) would be copied straight back.
    this.data.settings = mergeDefaults(DEFAULTS.settings, { ...this.data.settings, ...patch });
    this.save();
    this.emit('settings', this.data.settings);
  }

  setRoom(room) {
    this.data.room = room;
    this.save();
    this.emit('room', room);
  }

  touchProgress() {
    if (this.test) this.data.progress.coins = TEST_COINS;
    this.save();
    this.emit('progress', this.data.progress);
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 800);
  }

  flush() {
    clearTimeout(this.saveTimer);
    if (this.readOnly) return;
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // On disk before the rename, so a power cut can't leave an empty save behind.
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, JSON.stringify(this.data, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, DEFAULTS };
