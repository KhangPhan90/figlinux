const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULTS = { width: 1400, height: 900, maximized: false };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(win) {
  try {
    const maximized = win.isMaximized();
    const data = { maximized, ...(maximized ? {} : win.getBounds()) };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data));
  } catch (e) {
    console.error('[window-state] save error:', e.message);
  }
}

function track(win) {
  let timer;
  const deferred = () => {
    clearTimeout(timer);
    timer = setTimeout(() => save(win), 500);
  };
  win.on('resize', deferred);
  win.on('move', deferred);
  win.on('close', () => { clearTimeout(timer); save(win); }); // cancel debounce, save immediately
}

module.exports = { load, track };
