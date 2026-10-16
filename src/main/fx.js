// Random events: goblins on failures, treasure chests after long turns, a dragon on context compaction.
const { EventEmitter } = require('events');

const GOBLIN_MS = 3500;
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
    actors.on('failure', (a) => this.goblin(a));
    actors.on('turn', (a, { duration }) => {
      if (duration >= LONG_TURN_MS) this.chest(a);
    });
    actors.on('compact', (a) => this.dragon(a));
  }

  get enabled() { return this.store.settings.ambient; }

  nextId(kind) { return `${kind}-${Date.now()}-${++this.seq}`; }

  goblin(a) {
    if (!this.enabled) return;
    this.emit('fx', { type: 'goblin', id: this.nextId('goblin'), actorId: a.id, duration: GOBLIN_MS });
    setTimeout(() => {
      this.progress.onGoblin(a.id);
      this.actors.say(a, '⚔️ 打倒哥布林！', 2000);
    }, GOBLIN_MS);
  }

  chest(a) {
    if (!this.enabled) return;
    const id = this.nextId('chest');
    this.chests.set(id, a.id);
    this.emit('fx', { type: 'chest', id, actorId: a.id });
    this.actors.say(a, '🎁 撿到寶箱！點我打開', 4000);
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

  dragon(a) {
    if (!this.enabled) return;
    this.emit('fx', { type: 'dragon', id: this.nextId('dragon'), actorId: a?.id });
    this.progress.onDragon();
  }
}

module.exports = { Fx };
