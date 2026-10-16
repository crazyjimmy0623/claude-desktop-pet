// The drawer: the room editor, the guild book and settings in one panel that slides out along the
// top of the taskbar beside the room (or the strip), instead of opening windows of their own.
// Guild and settings are their own pages, loaded into frames the first time they are opened.
(function () {
  const NAMES = { edit: '✏️ 編輯房間', guild: '📖 夥伴手冊', settings: '⚙️ 設定' };

  function create({ editor = null, onChange = () => {} } = {}) {
    const el = document.createElement('div');
    el.id = 'drawer';
    el.className = 'drawer ui hidden';
    const bar = document.createElement('div');
    bar.className = 'drawer-tabs';
    const seg = document.createElement('div');
    seg.className = 'seg';
    bar.append(seg);
    const body = document.createElement('div');
    body.className = 'drawer-body';
    el.append(bar, body);

    const panes = {};
    if (editor) {
      editor.classList.remove('hidden');
      editor.classList.add('pane');
      panes.edit = editor;
      body.append(editor);
    }
    for (const id of ['guild', 'settings']) {
      const f = document.createElement('iframe');
      f.className = 'pane hidden';
      f.title = NAMES[id];
      panes[id] = f;
      body.append(f);
    }

    const buttons = {};
    for (const id of Object.keys(panes)) {
      const b = document.createElement('button');
      b.textContent = NAMES[id];
      b.addEventListener('click', () => api.toggle(id));
      buttons[id] = b;
      seg.append(b);
    }
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    const shut = document.createElement('button');
    shut.textContent = '✕';
    shut.title = '收起';
    shut.className = 'icon-btn close';
    shut.addEventListener('click', () => api.close());
    bar.append(spacer, shut);

    let current = null;
    const api = {
      el,
      get current() { return current; },
      // Open a pane; for the guild, `arg` picks its tab (e.g. 'gacha' or 'equip:user').
      open(id, arg) {
        if (!panes[id]) return;
        const changed = current !== id;
        current = id;
        el.classList.remove('hidden');
        for (const [k, p] of Object.entries(panes)) p.classList.toggle('hidden', k !== id);
        for (const [k, b] of Object.entries(buttons)) b.classList.toggle('active', k === id);
        const p = panes[id];
        if (p.tagName === 'IFRAME') {
          if (!p.src) p.src = `../${id}/index.html?docked=1${arg ? `&tab=${encodeURIComponent(arg)}` : ''}`;
          else if (arg) p.contentWindow?.postMessage({ guildTab: arg }, '*');
        }
        if (changed) onChange(current);
      },
      close() {
        if (!current) return;
        current = null;
        el.classList.add('hidden');
        onChange(null);
      },
      toggle(id) {
        if (current === id) api.close();
        else api.open(id);
      },
      // Whether a window point is over the open drawer (frames swallow their own mouse events).
      contains(x, y) {
        if (!current) return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      },
    };
    return api;
  }

  // Width that fits beside something `beside` px wide on this screen.
  const widthBeside = (beside, max = 1040, min = 440) => Math.max(min, Math.min(max, (window.screen.availWidth || 1280) - beside - 32));

  window.Drawer = { create, widthBeside };
})();
