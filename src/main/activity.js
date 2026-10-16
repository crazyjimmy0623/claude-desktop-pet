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
    this.idleTimer = null;
    this.foreground = { app: '', fullscreen: false };
    this.idleSeconds = 0;
    this.stopped = true;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.spawnHelper();
    this.idleTimer = setInterval(() => {
      this.idleSeconds = powerMonitor.getSystemIdleTime();
      this.emit('idle', this.idleSeconds);
    }, 5000);
  }

  spawnHelper() {
    // Packaged builds unpack the script next to app.asar.
    const script = path.join(__dirname, 'foreground.ps1').replace('app.asar', 'app.asar.unpacked');
    this.child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ParentPid', String(process.pid)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    readline.createInterface({ input: this.child.stdout }).on('line', (line) => {
      const [name, full] = line.trim().split('|');
      this.foreground = { app: name || '', fullscreen: full === 'True' };
      this.emit('foreground', this.foreground);
    });
    this.child.on('exit', () => {
      this.child = null;
      if (!this.stopped) setTimeout(() => this.spawnHelper(), 5000);
    });
  }

  stop() {
    this.stopped = true;
    clearInterval(this.idleTimer);
    this.child?.kill();
    this.child = null;
  }
}

module.exports = { ActivityMonitor };
