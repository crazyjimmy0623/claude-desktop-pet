// Random events: a bug on failures, a delivery box after long turns, a UFO on context compaction.
const { EventEmitter } = require('events');

const BUG_MS = 3500;
const CHEST_TTL_MS = 15 * 60 * 1000;
const LONG_TURN_MS = 10 * 60 * 1000;

class Fx extends EventEmitter {
  constructor(store, actors, progress) {
    super();
    this.store = store;
    this.actors = actors;
    this.progress = progress;
    this.chests = new Map();
    this.seq = 0;
    actors.on('failure', (a) => this.bug(a));
    actors.on('turn', (a, { duration }) => {
      if (duration >= LONG_TURN_MS) this.chest(a);
    });
    actors.on('compact', (a) => this.ufo(a));
  }

  get enabled() { return this.store.settings.ambient; }

  nextId(kind) { return `${kind}-${Date.now()}-${++this.seq}`; }

  bug(a) {
    if (!this.enabled) return;
    this.emit('fx', { type: 'bug', id: this.nextId('bug'), actorId: a.id, duration: BUG_MS });
    setTimeout(() => {
      if (!a.demo) this.progress.onBug(a.id);
      this.actors.say(a, '🐛 抓到 bug！', 2000);
    }, BUG_MS);
  }

  chest(a) {
    if (!this.enabled || a.demo) return;
    const id = this.nextId('chest');
    this.chests.set(id, a.id);
    this.emit('fx', { type: 'chest', id, actorId: a.id });
    this.actors.say(a, '📦 包裹送到！點我打開', 4000);
    setTimeout(() => {
      if (this.chests.delete(id)) this.emit('fx', { type: 'chest-gone', id });
    }, CHEST_TTL_MS);
  }

  openChest(id) {
    const actorId = this.chests.get(id);
    if (!actorId) return null;
    this.chests.delete(id);
    const coins = this.progress.onChest(actorId);
    this.emit('fx', { type: 'chest-open', id, coins, actorId });
    return coins;
  }

  ufo(a) {
    if (!this.enabled) return;
    this.emit('fx', { type: 'ufo', id: this.nextId('ufo'), actorId: a?.id });
    if (!a?.demo) this.progress.onUfo();
  }
}

module.exports = { Fx };
