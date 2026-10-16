// Adds or removes the Deskmates http hooks in ~/.claude/settings.json.
// Existing hooks are left untouched; our entries are recognised by their URL.
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.DESKMATES_PORT) || 47321;
const URL = `http://127.0.0.1:${PORT}/event`;
const EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest',
  'Notification', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'PreCompact',
];

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const isOurs = (h) => h?.type === 'http' && typeof h.url === 'string' && h.url.startsWith(`http://127.0.0.1:${PORT}/`);

function read() {
  const raw = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}';
  return { raw, settings: JSON.parse(raw) };
}

function write(raw, settings) {
  const backup = `${settingsPath}.bak-deskmates`;
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

function apply(install) {
  const { raw, settings } = read();
  settings.hooks ??= {};
  for (const event of EVENTS) {
    const entries = (settings.hooks[event] ?? [])
      .map((entry) => ({ ...entry, hooks: (entry.hooks ?? []).filter((h) => !isOurs(h)) }))
      .filter((entry) => entry.hooks.length > 0);
    if (install) entries.push({ matcher: '', hooks: [{ type: 'http', url: URL, timeout: 2 }] });
    if (entries.length) settings.hooks[event] = entries;
    else delete settings.hooks[event];
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  write(raw, settings);
  return status();
}

function status() {
  try {
    const { settings } = read();
    const installed = EVENTS.filter((e) => (settings.hooks?.[e] ?? []).some((entry) => (entry.hooks ?? []).some(isOurs)));
    return { installed: installed.length === EVENTS.length, partial: installed.length > 0 && installed.length < EVENTS.length, settingsPath };
  } catch (err) {
    return { installed: false, partial: false, error: err.message, settingsPath };
  }
}

module.exports = {
  install: () => apply(true),
  uninstall: () => apply(false),
  status,
  EVENTS,
  settingsPath,
};
