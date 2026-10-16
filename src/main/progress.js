// Coins, XP, stats, achievements and the recruit (gacha) machine.
// Currency is only ever earned by working — there is no way to buy it.
const { EventEmitter } = require('events');
const { ITEMS, RARITY, ACHIEVEMENTS, PULL_COST, DUPLICATE_REFUND, ROOM_UPGRADES } = require('../shared/catalog');

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);
const KEEP_DAYS = 120;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function levelFor(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

class Progress extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
  }

  get p() { return this.store.progress; }

  snapshot() {
    const p = this.p;
    const level = levelFor(p.xp);
    return {
      coins: p.coins, xp: p.xp, level, roomLevel: p.roomLevel || 0,
      levelFloor: 50 * (level - 1) ** 2, levelCeil: 50 * level ** 2,
      owned: p.owned, achievements: p.achievements, stats: p.stats, days: p.days,
    };
  }

  today() {
    const key = dayKey();
    const p = this.p;
    if (!p.days[key]) {
      p.days[key] = { turns: 0, tools: 0, activeMinutes: 0, focus: 0, projects: {}, toolsBy: {} };
      const keys = Object.keys(p.days).sort();
      while (keys.length > KEEP_DAYS) delete p.days[keys.shift()];
      this.updateStreak();
    }
    return p.days[key];
  }

  updateStreak() {
    const days = this.p.days;
    let streak = 0;
    const d = new Date();
    while (days[dayKey(d)]) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    this.p.stats.streak = streak;
  }

  earn(coins, xp, actorId) {
    const p = this.p;
    const before = levelFor(p.xp);
    p.coins += coins;
    p.xp += xp;
    if (coins > 0) this.emit('coins', { actorId, amount: coins });
    const after = levelFor(p.xp);
    if (after > before) this.emit('toast', { text: `🎉 團隊升到 Lv.${after}！`, actorId });
  }

  commit() {
    const s = this.p.stats;
    s.owned = this.p.owned.length;
    s.totalItems = ITEMS.length;
    for (const a of ACHIEVEMENTS) {
      if (this.p.achievements[a.id] || !a.test(s)) continue;
      this.p.achievements[a.id] = Date.now();
      this.p.coins += a.reward;
      this.emit('toast', { text: `🏆 成就解鎖：${a.name}（+${a.reward} 🪙）` });
    }
    delete s.owned;
    delete s.totalItems;
    this.store.touchProgress();
  }

  // ---- Earning ---------------------------------------------------------------

  onTool(actor, ev) {
    const s = this.p.stats;
    const day = this.today();
    s.toolCalls += 1;
    day.tools += 1;
    day.toolsBy[ev.tool] = (day.toolsBy[ev.tool] || 0) + 1;
    if (EDIT_TOOLS.has(ev.rawTool)) s.edits += 1;
    if (READ_TOOLS.has(ev.rawTool)) s.reads += 1;
    this.earn(s.toolCalls % 20 === 0 ? 1 : 0, 1, actor.id);
    this.commit();
  }

  onTurn(actor) {
    const s = this.p.stats;
    const day = this.today();
    s.turns += 1;
    day.turns += 1;
    day.projects[actor.name] = (day.projects[actor.name] || 0) + 1;
    const hour = new Date().getHours();
    if (hour < 5) s.nightTurns += 1;
    if (hour >= 5 && hour < 7) s.earlyTurns += 1;
    this.earn(1, 5, actor.id);
    this.commit();
  }

  onFailure() {
    this.p.stats.failures += 1;
    this.commit();
  }

  onPermission() {
    this.p.stats.permissions += 1;
    this.commit();
  }

  onHelpers(actor) {
    const s = this.p.stats;
    s.subagents += 1;
    s.maxHelpers = Math.max(s.maxHelpers, actor.helpers);
    this.commit();
  }

  onActiveMinute() {
    const s = this.p.stats;
    s.activeMinutes += 1;
    this.today().activeMinutes += 1;
    this.earn(s.activeMinutes % 15 === 0 ? 1 : 0, s.activeMinutes % 5 === 0 ? 1 : 0, 'user');
    this.commit();
  }

  onFocusDone() {
    this.p.stats.focus += 1;
    this.today().focus += 1;
    this.earn(3, 20, 'user');
    this.commit();
  }

  onBug(actorId) {
    this.p.stats.bugs += 1;
    this.earn(1, 3, actorId);
    this.commit();
  }

  onChest(actorId) {
    const coins = 3 + Math.floor(Math.random() * 6);
    this.p.stats.chests += 1;
    this.earn(coins, 5, actorId);
    this.commit();
    return coins;
  }

  onUfo() {
    this.p.stats.ufos += 1;
    this.commit();
  }

  // ---- Room upgrades -----------------------------------------------------------

  upgradeRoom() {
    const p = this.p;
    const next = ROOM_UPGRADES.find((u) => u.level === (p.roomLevel || 0) + 1);
    if (!next) return { error: '房間已經全部升級完了' };
    if (p.coins < next.cost) return { error: `金幣不足（需要 ${next.cost} 🪙）` };
    p.coins -= next.cost;
    p.roomLevel = next.level;
    this.commit();
    return { level: p.roomLevel, name: next.name };
  }

  // ---- Recruiting ------------------------------------------------------------

  pull(count = 1) {
    const p = this.p;
    const cost = PULL_COST * count;
    if (p.coins < cost) return { error: `金幣不足（需要 ${cost} 🪙）` };
    p.coins -= cost;
    const fullPool = ITEMS.filter((i) => RARITY[i.rarity].weight > 0);
    const results = [];
    for (let n = 0; n < count; n++) {
      // A 10-pull always contains at least one rare-or-better.
      const pity = count >= 10 && n === count - 1 && results.every((r) => ITEMS.find((i) => i.id === r.id).rarity === 'common');
      const pool = pity ? fullPool.filter((i) => i.rarity !== 'common') : fullPool;
      const total = pool.reduce((sum, i) => sum + RARITY[i.rarity].weight, 0);
      let roll = Math.random() * total;
      let item = pool[pool.length - 1];
      for (const i of pool) {
        roll -= RARITY[i.rarity].weight;
        if (roll < 0) { item = i; break; }
      }
      const duplicate = p.owned.includes(item.id);
      if (duplicate) p.coins += DUPLICATE_REFUND;
      else p.owned.push(item.id);
      results.push({ id: item.id, duplicate });
      p.stats.pulls += 1;
    }
    this.commit();
    return { results };
  }
}

module.exports = { Progress, levelFor, dayKey };
