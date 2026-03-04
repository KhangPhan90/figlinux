const { app, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULTS = { width: 1400, height: 900, maximized: false };

function isVisibleOnAnyDisplay(state) {
  if (state.x == null || state.y == null) return false;
  const displays = screen.getAllDisplays();
  // Window is visible if at least 100px of its top-left region overlaps a display
  const margin = 100;
  return displays.some(d => {
    const { x, y, width, height } = d.bounds;
    return (
      state.x + margin > x && state.x < x + width &&
      state.y + margin > y && state.y < y + height
    );
  });
}

function load() {
  try {
    const state = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
    // If saved position is off-screen (e.g. monitor unplugged), drop x/y so
    // Electron centres the window on the primary display.
    if (!state.maximized && !isVisibleOnAnyDisplay(state)) {
      delete state.x;
      delete state.y;
    }
    return state;
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
