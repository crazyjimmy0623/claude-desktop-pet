/* global desk, Catalog */
const $ = (id) => document.getElementById(id);
let settings = null;
let builtIn = {};
let focusState = null;

const set = (patch) => desk.invoke('settings:set', patch);

function bindCheckbox(id, get, patch) {
  $(id).addEventListener('change', (e) => set(patch(e.target.checked)));
  return () => { $(id).checked = get(); };
}

function bindNumber(id, get, patch, min, max) {
  $(id).addEventListener('change', (e) => {
    const v = Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0)));
    e.target.value = v;
    set(patch(v));
  });
  return () => { if (document.activeElement !== $(id)) $(id).value = get(); };
}

function bindSelect(id, get, patch, numeric) {
  $(id).addEventListener('change', (e) => set(patch(numeric ? Number(e.target.value) : e.target.value)));
  return () => { $(id).value = String(get()); };
}

const renderers = [
  bindCheckbox('alwaysOnTop', () => settings.alwaysOnTop, (v) => ({ alwaysOnTop: v })),
  bindCheckbox('hideInFullscreen', () => settings.hideInFullscreen, (v) => ({ hideInFullscreen: v })),
  bindSelect('scale', () => settings.scale, (v) => ({ scale: v }), true),
  bindSelect('roomZoom', () => settings.roomZoom, (v) => ({ roomZoom: v }), true),
  bindSelect('timeOfDay', () => settings.timeOfDay, (v) => ({ timeOfDay: v })),
  bindSelect('weather', () => settings.weather, (v) => ({ weather: v })),
  bindCheckbox('ambient', () => settings.ambient, (v) => ({ ambient: v })),
  bindCheckbox('src-claude', () => settings.sources.claude, (v) => ({ sources: { ...settings.sources, claude: v } })),
  bindCheckbox('src-activity', () => settings.sources.activity, (v) => ({ sources: { ...settings.sources, activity: v } })),
  bindNumber('idleMinutes', () => settings.idleMinutes, (v) => ({ idleMinutes: v }), 1, 120),
  bindNumber('pomo-focus', () => settings.pomodoro.focus, (v) => ({ pomodoro: { ...settings.pomodoro, focus: v } }), 1, 180),
  bindNumber('pomo-break', () => settings.pomodoro.break, (v) => ({ pomodoro: { ...settings.pomodoro, break: v } }), 1, 60),
  bindNumber('rem-water', () => settings.reminders.water, (v) => ({ reminders: { ...settings.reminders, water: v } }), 0, 480),
  bindNumber('rem-stretch', () => settings.reminders.stretch, (v) => ({ reminders: { ...settings.reminders, stretch: v } }), 0, 480),
];

document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => set({ mode: b.dataset.mode })));
renderers.push(() => document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === settings.mode)));

$('autostart').addEventListener('change', (e) => desk.invoke('autostart:set', e.target.checked));
$('run-demo').addEventListener('click', () => desk.invoke('demo'));
$('regroup').addEventListener('click', () => desk.invoke('actors:regroup'));
$('clear-ai').addEventListener('click', () => desk.invoke('actors:clear'));
desk.invoke('autostart:get').then((on) => { $('autostart').checked = on; });

$('userName').addEventListener('change', (e) => set({ userName: e.target.value.trim() || '你' }));

// ---- App map ---------------------------------------------------------------------

const stationOptions = () => [
  ...Object.entries(Catalog.STATIONS).map(([id, s]) => [id, `${s.icon} ${s.name}`]),
  ['ignore', '🙈 忽略（維持原本狀態）'],
];

function renderMap() {
  const rows = $('map-rows');
  rows.replaceChildren();
  const entries = Object.entries(settings.appMap);
  if (!entries.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" class="help">還沒有自訂規則。</td>';
    rows.append(tr);
  }
  for (const [name, station] of entries) {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = name;
    input.addEventListener('change', () => {
      const map = { ...settings.appMap };
      delete map[name];
      const key = input.value.trim().toLowerCase().replace(/\.exe$/, '');
      if (key) map[key] = station;
      set({ appMap: map });
    });
    nameTd.append(input);
    const stTd = document.createElement('td');
    const select = document.createElement('select');
    for (const [id, label] of stationOptions()) select.add(new Option(label, id, false, id === station));
    select.addEventListener('change', () => set({ appMap: { ...settings.appMap, [name]: select.value } }));
    stTd.append(select);
    const delTd = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'btn';
    del.textContent = '刪除';
    del.addEventListener('click', () => {
      const map = { ...settings.appMap };
      delete map[name];
      set({ appMap: map });
    });
    delTd.append(del);
    tr.append(nameTd, stTd, delTd);
    rows.append(tr);
  }
}

$('map-add').addEventListener('click', () => {
  let name = 'new-app';
  for (let i = 2; settings.appMap[name]; i++) name = `new-app-${i}`;
  set({ appMap: { ...settings.appMap, [name]: 'code' } });
});

function renderBuiltIn() {
  const box = $('builtin');
  box.replaceChildren();
  for (const [station, names] of Object.entries(builtIn)) {
    const p = document.createElement('p');
    const s = Catalog.STATIONS[station];
    p.innerHTML = `<b>${s ? `${s.icon} ${s.name}` : '🙈 忽略'}</b>：`;
    p.append(document.createTextNode(names.filter(Boolean).join('、')));
    box.append(p);
  }
}

// ---- Hooks, pomodoro, assets ---------------------------------------------------------

function renderHooks(status) {
  const el = $('hooks-status');
  if (status.error) {
    el.textContent = `讀取失敗：${status.error}`;
    el.className = 'status off';
  } else {
    el.textContent = status.installed ? '✔ 已安裝' : status.partial ? '△ 部分安裝' : '✖ 未安裝';
    el.className = `status ${status.installed ? 'ok' : 'off'}`;
  }
  $('hooks-install').disabled = status.installed;
  $('hooks-uninstall').disabled = !status.installed && !status.partial;
}

$('hooks-install').addEventListener('click', async () => renderHooks(await desk.invoke('hooks:install')));
$('hooks-uninstall').addEventListener('click', async () => renderHooks(await desk.invoke('hooks:uninstall')));

function renderPomodoro() {
  $('pomo-toggle').textContent = focusState ? '停止番茄鐘' : `開始專注 ${settings.pomodoro.focus} 分鐘`;
}

$('pomo-toggle').addEventListener('click', async () => {
  await desk.invoke(focusState ? 'focus:stop' : 'focus:start');
});

function renderAssets(assets) {
  const c = assets.characters.map((x) => x.name);
  $('assets-summary').textContent = `角色 ${c.length} 個${c.length ? `（${c.join('、')}）` : ''}・地板圖 ${assets.tiles.length} 張`;
}

$('assets-open').addEventListener('click', () => desk.invoke('assets:open-folder'));
$('assets-reload').addEventListener('click', async () => renderAssets(await desk.invoke('assets:reload')));

// ---- Wiring ----------------------------------------------------------------------------

function render() {
  for (const r of renderers) r();
  if (document.activeElement !== $('userName')) $('userName').value = settings.userName;
  renderMap();
  renderPomodoro();
}

desk.on('settings', (s) => {
  settings = s;
  render();
});

desk.on('actors', (list) => {
  const user = list.find((a) => a.kind === 'user');
  focusState = user?.focus || null;
  renderPomodoro();
  $('current-app').textContent = user ? `你的角色現在：${user.label || '待命'}` : '';
});

desk.on('assets', renderAssets);

desk.invoke('init').then((init) => {
  settings = init.settings;
  builtIn = init.appMapBuiltIn || {};
  focusState = init.focus;
  $('version').textContent = `v${init.version}`;
  renderHooks(init.hooks);
  renderAssets(init.assets);
  renderBuiltIn();
  const url = `http://127.0.0.1:${init.port}`;
  $('api-example').textContent = [
    `curl -X POST ${url}/api/event -H "Content-Type: application/json" \\`,
    `  -d '{"id":"my-bot","name":"我的機器人","state":"work","station":"terminal","label":"跑測試"}'`,
    '',
    'state：idle | think | work | wait | done | sleep | end（end = 下班）',
    `station：${Object.keys(Catalog.STATIONS).join(' | ')}`,
    '選填：label（氣泡文字）、icon（表情符號）、say（說一句話）、source',
  ].join('\n');
  $('codex-example').textContent = `notify = ["curl", "-s", "-m", "1", "${url}/codex", "-H", "Content-Type: application/json", "-d"]`;
  render();
});
