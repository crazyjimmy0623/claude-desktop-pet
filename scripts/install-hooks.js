#!/usr/bin/env node
// Adds (or with --uninstall removes) the desktop-pet http hooks in ~/.claude/settings.json.
// Existing hooks are left untouched; our entries are recognised by their URL.
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.CLAUDE_PET_PORT) || 47321;
const URL = `http://127.0.0.1:${PORT}/event`;
const EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest',
  'Notification', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop',
];

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const uninstall = process.argv.includes('--uninstall');

const raw = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}';
const settings = JSON.parse(raw);
const isOurs = (h) => h?.type === 'http' && typeof h.url === 'string' && h.url.startsWith(`http://127.0.0.1:${PORT}/`);

settings.hooks ??= {};
for (const event of EVENTS) {
  const entries = (settings.hooks[event] ?? [])
    .map((entry) => ({ ...entry, hooks: (entry.hooks ?? []).filter((h) => !isOurs(h)) }))
    .filter((entry) => entry.hooks.length > 0);
  if (!uninstall) entries.push({ matcher: '', hooks: [{ type: 'http', url: URL, timeout: 2 }] });
  if (entries.length) settings.hooks[event] = entries;
  else delete settings.hooks[event];
}
if (!Object.keys(settings.hooks).length) delete settings.hooks;

const backup = `${settingsPath}.bak-pet`;
if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw);
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log(`${uninstall ? 'Removed' : 'Installed'} desktop-pet hooks for ${EVENTS.length} events in ${settingsPath}`);
console.log(`Original settings backed up at ${backup}`);
