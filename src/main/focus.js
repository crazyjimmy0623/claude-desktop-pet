// Pomodoro timer and gentle reminders, both shown on the user's own character.
const { EventEmitter } = require('events');

class Focus extends EventEmitter {
  constructor(store, actors, progress) {
    super();
    this.store = store;
    this.actors = actors;
    this.progress = progress;
    this.state = null; // { phase: 'focus' | 'break', endsAt, total }
    this.lastReminder = { water: Date.now(), stretch: Date.now() };
    this.timer = setInterval(() => this.tick(), 1000);
  }

  start() {
    const minutes = this.store.settings.pomodoro.focus;
    this.set({ phase: 'focus', endsAt: Date.now() + minutes * 60000, total: minutes * 60000 });
    this.actors.sayTo('user', `🍅 專注 ${minutes} 分鐘，開始！`, 3000);
  }

  stop() {
    if (!this.state) return;
    this.set(null);
    this.actors.sayTo('user', '🍅 番茄鐘先停了', 2500);
  }

  set(state) {
    this.state = state;
    this.actors.setFocus(state);
    this.emit('change', state);
  }

  tick() {
    const now = Date.now();
    if (this.state && now >= this.state.endsAt) {
      if (this.state.phase === 'focus') {
        const coins = this.progress.onFocusDone(this.state.total / 60000);
        const minutes = this.store.settings.pomodoro.break;
        this.set({ phase: 'break', endsAt: now + minutes * 60000, total: minutes * 60000 });
        this.actors.sayTo('user', `🍅 專注完成！休息一下吧${coins ? `（+${coins} 🪙）` : ''}`, 6000, 'success');
      } else {
        this.set(null);
        this.actors.sayTo('user', '⏰ 休息完了，回來囉', 6000);
      }
    }

    const user = this.actors.map.get('user');
    if (!user || user.state === 'sleep') return;
    const { water, stretch } = this.store.settings.reminders;
    if (water > 0 && now - this.lastReminder.water >= water * 60000) {
      this.lastReminder.water = now;
      this.actors.say(user, '💧 喝口水吧', 10000, 'alert');
    } else if (stretch > 0 && now - this.lastReminder.stretch >= stretch * 60000) {
      this.lastReminder.stretch = now;
      this.actors.say(user, '🙆 起來伸展一下', 10000, 'alert');
    }
  }
}

module.exports = { Focus };
