// The taskbar panel: a few shortcuts and the current level, refreshed whenever it pops up.
const $ = (id) => document.getElementById(id);
let state = null;

const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function render() {
  if (!state) return;
  $('stats').textContent = `Lv.${state.level} · ${state.coins} 🪙`;
  $('modeIc').textContent = state.mode === 'room' ? '🧍' : '🏠';
  $('modeText').textContent = state.mode === 'room' ? '切換到工作列' : '切換到房間';
  $('hideText').textContent = state.hidden ? '顯示夥伴' : '暫時隱藏夥伴';
  $('focusText').textContent = state.focus ? `停止番茄鐘（${state.focus.phase === 'focus' ? '專注' : '休息'}）` : `開始專注 ${state.focusMinutes} 分鐘`;
  $('focusLeft').textContent = state.focus ? mmss(Math.max(0, state.focus.endsAt - Date.now())) : '';
}

async function refresh() {
  state = await desk.invoke('hub:state');
  render();
}

document.querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', async () => {
  state = await desk.invoke('hub:action', b.dataset.act);
  render();
}));
desk.on('hub:refresh', refresh);
desk.on('progress', refresh);
desk.on('settings', refresh);
setInterval(render, 1000);
refresh();
