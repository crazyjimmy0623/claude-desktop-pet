#!/usr/bin/env node
// CLI wrapper: `npm run install-hooks` / `npm run uninstall-hooks`.
const hooks = require('../src/main/hooks-install');

const uninstall = process.argv.includes('--uninstall');
const result = uninstall ? hooks.uninstall() : hooks.install();
console.log(`${uninstall ? 'Removed' : 'Installed'} Deskmates hooks for ${hooks.EVENTS.length} events in ${hooks.settingsPath}`);
console.log(`Original settings backed up at ${hooks.settingsPath}.bak-deskmates`);
if (result.error) console.error(result.error);
