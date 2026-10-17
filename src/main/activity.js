// Watches the foreground program (via a long-lived PowerShell helper) and keyboard/mouse idleness.
const { powerMonitor } = require('electron');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const readline = require('readline');

class ActivityMonitor extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.respawn = null;
    this.quickExits = 0;
    this.idleTimer = null;
    this.foreground = { app: '', fullscreen: false };
    this.idleSeconds = 0;
    this.stopped = true;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.quickExits = 0;
    this.spawnHelper();
    this.idleTimer = setInterval(() => {
      this.idleSeconds = powerMonitor.getSystemIdleTime();
      this.emit('idle', this.idleSeconds);
    }, 5000);
  }

  spawnHelper() {
    // Packaged builds unpack the script next to app.asar.
    const script = path.join(__dirname, 'foreground.ps1').replace('app.asar', 'app.asar.unpacked');
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ParentPid', String(process.pid)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    this.child = child;
    const born = Date.now();
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      const [name, full] = line.trim().split('|');
      this.foreground = { app: name || '', fullscreen: full === 'True' };
      this.emit('foreground', this.foreground);
    });
    child.on('error', (err) => console.error(`[deskmates] foreground helper: ${err.message}`));
    child.on('exit', () => {
      if (this.child === child) this.child = null;
      if (this.stopped) return;
      // A helper that dies straight away (a policy that blocks scripts, say) is tried less and less
      // often and then left alone, rather than a new PowerShell every five seconds for ever.
      this.quickExits = Date.now() - born < 30000 ? this.quickExits + 1 : 0;
      if (this.quickExits > 5) {
        console.error('[deskmates] the foreground helper keeps exiting; not starting it again this run');
        return;
      }
      this.respawn = setTimeout(() => {
        this.respawn = null;
        if (!this.stopped) this.spawnHelper();
      }, 5000 * 2 ** Math.max(0, this.quickExits - 1));
    });
  }

  stop() {
    this.stopped = true;
    clearInterval(this.idleTimer);
    // A restart already on its way is called off too, or tracking would come back with the setting off.
    clearTimeout(this.respawn);
    this.respawn = null;
    this.child?.kill();
    this.child = null;
  }
}

module.exports = { ActivityMonitor };
