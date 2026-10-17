// Coins, XP, stats, achievements and the recruit (gacha) machine.
// Currency is only ever earned by working — there is no way to buy it.
const { EventEmitter } = require('events');
const { ITEMS, RARITY, ACHIEVEMENTS, STATIONS, PULL_COST, DUPLICATE_REFUND } = require('../shared/catalog');

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);
const KEEP_DAYS = 120;
// A flow session: this many active minutes on the same kind of work; a pause of up to about three
// minutes between them keeps the run going.
const FLOW_MINUTES = 25;
const FLOW_GAP_MS = 4.5 * 60000;

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function levelFor(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

class Progress extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.flow = { station: null, minutes: 0, at: 0 };
  }

  get p() { return this.store.progress; }

  snapshot() {
    const p = this.p;
    const level = levelFor(p.xp);
    return {
      coins: p.coins, xp: p.xp, level,
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
    if (ev.tool && ev.tool !== '__proto__') day.toolsBy[ev.tool] = (Object.hasOwn(day.toolsBy, ev.tool) ? day.toolsBy[ev.tool] : 0) + 1;
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
    // Own counts only: a folder called 'constructor' would otherwise add 1 to Object's.
    if (actor.name !== '__proto__') day.projects[actor.name] = (Object.hasOwn(day.projects, actor.name) ? day.projects[actor.name] : 0) + 1;
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

  // A minute of the user at the computer. `station` is the kind of work in the foreground (null
  // for anything unmapped); `focusing` while a pomodoro runs, which pays for itself.
  onActiveMinute(station = null, focusing = false) {
    const s = this.p.stats;
    s.activeMinutes += 1;
    this.today().activeMinutes += 1;
    this.earn(s.activeMinutes % 5 === 0 ? 1 : 0, s.activeMinutes % 5 === 0 ? 1 : 0, 'user');
    this.checkIn();
    this.onFlowMinute(station, focusing);
    this.commit();
  }

  // Auto focus sessions, for people working without AI: 25 minutes on the same kind of work pay
  // like a pomodoro. Short pauses and unmapped programs don't break a run; switching to another
  // kind of work or a long pause starts over.
  onFlowMinute(station, focusing, now = Date.now()) {
    const f = this.flow;
    if (focusing || (f.at && now - f.at > FLOW_GAP_MS)) Object.assign(f, { station: null, minutes: 0, at: 0 });
    if (focusing || !station || station === 'ignore') return;
    if (station !== f.station) Object.assign(f, { station, minutes: 0 });
    f.minutes += 1;
    f.at = now;
    if (f.minutes < FLOW_MINUTES) return;
    f.minutes = 0;
    this.p.stats.flowSessions = (this.p.stats.flowSessions || 0) + 1;
    this.earn(3, 20, 'user');
    this.emit('toast', { text: `🔥 專注 ${FLOW_MINUTES} 分鐘：${STATIONS[station]?.name || station}（+3 🪙）`, actorId: 'user' });
  }

  // Daily check-in: the first time each day, 3 coins and one more for every day in a row, up to 10.
  checkIn(now = new Date()) {
    const p = this.p;
    const today = dayKey(now);
    if (p.checkIn.last === today) return false;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    p.checkIn.streak = p.checkIn.last === dayKey(yesterday) ? p.checkIn.streak + 1 : 1;
    p.checkIn.last = today;
    p.stats.checkInBest = Math.max(p.stats.checkInBest || 0, p.checkIn.streak);
    const coins = Math.min(10, 2 + p.checkIn.streak);
    this.earn(coins, 5, 'user');
    this.emit('toast', { text: `📅 每日簽到：連續 ${p.checkIn.streak} 天（+${coins} 🪙）`, actorId: 'user' });
    this.commit();
    return true;
  }

  // A pomodoro pays by its length: 3 coins and 20 XP for 25 minutes, in proportion for others (a
  // few minutes earn nothing), and counts as that many 25-minute pomodoros - so a timer set to one
  // minute can't be run over and over for coins or the pomodoro achievements. Returns the coins.
  onFocusDone(minutes = 25) {
    const share = Math.max(0, minutes) / 25;
    const add = (v) => Math.round((v + share) * 100) / 100;
    this.p.stats.focus = add(this.p.stats.focus);
    this.today().focus = add(this.today().focus);
    const coins = Math.floor(3 * share);
    this.earn(coins, Math.floor(20 * share), 'user');
    this.commit();
    return coins;
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

  // ---- Building --------------------------------------------------------------

  // Coins spent on building (positive) or given back for taking things away (negative).
  spend(amount) {
    const p = this.p;
    const n = Math.round(Number(amount) || 0);
    if (n > 0 && p.coins < n) return { error: `金幣不足（需要 ${n} 🪙，現在有 ${p.coins} 🪙）` };
    p.coins -= n;
    this.commit();
    return { coins: p.coins };
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
