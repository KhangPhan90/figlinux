const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { DEFS, FIGMA_DEFS, resolveAll } = require('./shortcuts');

let _getTabManager;
let _getWin;
let _rebuildMenu;
let _config;
let _shortcutsWin = null;

function init({ getTabManager, getWin, rebuildMenu, config }) {
  _getTabManager = getTabManager;
  _getWin        = getWin;
  _rebuildMenu   = rebuildMenu;
  _config        = config;
  registerIPC();
}

function open() {
  if (_shortcutsWin && !_shortcutsWin.isDestroyed()) {
    _shortcutsWin.focus();
    return;
  }

  _shortcutsWin = new BrowserWindow({
    width: 850,
    height: 620,
    parent: _getWin(),
    modal: false,
    title: 'Keyboard Shortcuts',
    resizable: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'shortcuts-preload.js'),
    },
  });

  _shortcutsWin.loadFile(path.join(__dirname, 'ui/shortcuts.html'));
  _shortcutsWin.setMenuBarVisibility(false);
  _shortcutsWin.on('closed', () => { _shortcutsWin = null; });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIPC() {
  ipcMain.handle('shortcuts:get-all', () => {
    const cfg = _config.load();
    const overrides = cfg.shortcuts || {};
    const resolved = resolveAll(overrides);

    const app = DEFS.map(def => ({
      id:           def.id,
      label:        def.label,
      category:     def.category,
      defaultAccel: def.defaultAccel,
      readonly:     def.readonly || false,
      currentAccel: def.readonly ? def.defaultAccel : (resolved[def.id] ?? def.defaultAccel),
      isModified:   !def.readonly && (def.id in overrides),
    }));

    const figma = FIGMA_DEFS.map(def => ({
      label:    def.label,
      category: def.category,
      accel:    def.accel,
    }));

    return { app, figma };
  });

  ipcMain.handle('shortcuts:set', (_event, id, accel) => {
    const cfg = _config.load();
    const overrides = cfg.shortcuts || {};

    // Conflict check — scan all other non-readonly shortcuts
    if (accel) {
      for (const def of DEFS) {
        if (def.id === id || def.readonly) continue;
        const current = def.id in overrides ? overrides[def.id] : def.defaultAccel;
        if (current && current.toUpperCase() === accel.toUpperCase()) {
          return { conflict: { id: def.id, label: def.label } };
        }
      }
    }

    if (accel == null || accel === '') {
      delete overrides[id];
    } else {
      overrides[id] = accel;
    }

    cfg.shortcuts = overrides;
    _config.save(cfg);
    _rebuildMenu();
    return { ok: true };
  });

  ipcMain.handle('shortcuts:reset', (_event, id) => {
    const cfg = _config.load();
    const overrides = cfg.shortcuts || {};
    delete overrides[id];
    cfg.shortcuts = overrides;
    _config.save(cfg);
    _rebuildMenu();
    return { ok: true };
  });

  ipcMain.handle('shortcuts:reset-all', () => {
    const cfg = _config.load();
    cfg.shortcuts = {};
    _config.save(cfg);
    _rebuildMenu();
    return { ok: true };
  });
}

module.exports = { init, open };
