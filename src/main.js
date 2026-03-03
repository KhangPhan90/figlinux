const { app, BrowserWindow, ipcMain, Menu, shell, session } = require('electron');
const path = require('path');

// ── Chromium performance flags (must be set before app.whenReady) ──────────
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');         // GPU often blocklisted on Linux
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096'); // larger V8 heap for big files
const { TabManager }      = require('./tab-manager');
const { buildMenu }       = require('./menu');
const fontServer          = require('./font-server');
const sessionStore        = require('./session');
const windowState         = require('./window-state');
const config              = require('./config');
const shortcutsModule     = require('./shortcuts');
const shortcutsWindow     = require('./shortcuts-window');

app.setName('Figlinux');
app.setDesktopName('io.github.KhangPhan90.Figlinux.desktop');

let win;
let tabManager;

// ── Menu rebuild (called at startup and every time shortcuts change) ───────────
function rebuildMenu() {
  const cfg = config.load();
  const effectiveShortcuts = shortcutsModule.resolveAll(cfg.shortcuts || {});

  const menu = buildMenu(
    tabManager, win, createWindow,
    () => shortcutsWindow.open(),
    effectiveShortcuts,
  );
  win.setMenu(menu);
  win.setMenuBarVisibility(false);

  if (tabManager) tabManager.setShortcuts(effectiveShortcuts);
}

// ── Window creation ───────────────────────────────────────────────────────────
function createWindow() {
  const state = windowState.load();

  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (state.maximized) win.maximize();
  windowState.track(win);

  // Tab bar HTML renders in the main window's webContents (top 48px)
  win.loadFile(path.join(__dirname, 'ui/tabbar.html'));

  tabManager = new TabManager(win);

  // Home tab is always present and cannot be closed
  tabManager.createTab('https://www.figma.com/files/', { home: true });

  // Restore additional tabs if session restore is enabled
  const cfg = config.load();
  if (cfg.sessionRestore) {
    const savedUrls = sessionStore.load();
    if (savedUrls) savedUrls.forEach(url => tabManager.createTab(url));
    tabManager.onTabsChange = (tabs) => sessionStore.save(tabs.filter(t => !t.home));
  }

  // Build menu and apply shortcuts to tabManager
  rebuildMenu();

  // Push initial tab state once the tab bar is ready
  win.webContents.on('did-finish-load', () => tabManager._sendUpdate());
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  fontServer.start();

  // Handle file downloads — save to ~/Downloads and reveal in file manager
  session.defaultSession.on('will-download', (_event, item) => {
    const savePath = path.join(app.getPath('downloads'), item.getFilename());
    item.setSavePath(savePath);
    item.once('done', (_e, state) => {
      if (state === 'completed') shell.showItemInFolder(savePath);
    });
  });

  // Initialise shortcuts window IPC (registered once, not per-window)
  shortcutsWindow.init({
    getTabManager: () => tabManager,
    getWin:        () => win,
    rebuildMenu,
    config,
  });

  // ── IPC from tab bar renderer (registered ONCE here, not inside createWindow) ─
  // All handlers reference the module-level `tabManager` variable so they always
  // talk to whichever TabManager is currently active without accumulating on every
  // createWindow() call (e.g. when the user opens a New Window from the menu).
  ipcMain.on('new-tab',          ()           => tabManager?.createTab());
  ipcMain.on('close-tab',        (_e, i)      => tabManager?.closeTab(i));
  ipcMain.on('switch-tab',       (_e, i)      => tabManager?.setActive(i));
  ipcMain.on('pin-tab',          (_e, i)      => tabManager?.pinTab(i));
  ipcMain.on('duplicate-tab',    (_e, i)      => tabManager?.duplicateTab(i));
  ipcMain.on('close-other-tabs', (_e, i)      => tabManager?.closeOtherTabs(i));
  ipcMain.on('reorder-tab',      (_e, f, t)   => tabManager?.reorderTab(f, t));
  ipcMain.on('go-back',          (_e, i)      => tabManager?.goBack(i));
  ipcMain.on('go-forward',       (_e, i)      => tabManager?.goForward(i));
  ipcMain.on('zoom-in',          ()           => tabManager?.zoomIn());
  ipcMain.on('zoom-out',         ()           => tabManager?.zoomOut());
  ipcMain.on('zoom-reset',       ()           => tabManager?.resetZoom());
  ipcMain.on('open-shortcuts',   ()           => shortcutsWindow.open());

  createWindow();
});

app.on('window-all-closed', () => app.quit());
