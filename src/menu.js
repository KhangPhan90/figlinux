const { Menu, app, shell } = require('electron');
const config = require('./config');

/**
 * Builds the application menu.
 * The menu bar is hidden but accelerators still fire globally.
 *
 * @param {object}   tabManager
 * @param {object}   win
 * @param {function} createWindow
 * @param {function} openShortcutsWindow
 * @param {object}   shortcuts  — resolved map: { id → accelerator | null }
 */
function buildMenu(tabManager, win, createWindow, openShortcutsWindow, shortcuts = {}) {
  const cfg = config.load();

  // Returns the accelerator for a shortcut id, or undefined (= no shortcut).
  const a = (id) => shortcuts[id] || undefined;

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Tab',   accelerator: a('new-tab'),   click: () => tabManager.createTab() },
        { label: 'Close Tab', accelerator: a('close-tab'), click: () => tabManager.closeTab(tabManager.activeIndex) },
        { type: 'separator' },
        {
          label:   'Restore Tabs on Startup',
          type:    'checkbox',
          checked: cfg.sessionRestore,
          click: (item) => { cfg.sessionRestore = item.checked; config.save(cfg); },
        },
        { type: 'separator' },
        { label: 'New Window', accelerator: a('new-window'), click: () => createWindow() },
        { type: 'separator' },
        { label: 'Quit', accelerator: a('quit'), click: () => app.quit() },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label:       'Go Back',
          accelerator: a('go-back'),
          click: () => tabManager.goBack(tabManager.activeIndex),
        },
        {
          label:       'Go Forward',
          accelerator: a('go-forward'),
          click: () => tabManager.goForward(tabManager.activeIndex),
        },
        { type: 'separator' },
        {
          label:       'Reload Tab',
          accelerator: a('reload'),
          click: () => tabManager.reloadActive(),
        },
      ],
    },
    {
      // Standard edit roles — Electron wires these to the active webContents
      label: 'Edit',
      submenu: [
        { role: 'undo',      label: 'Undo' },
        { role: 'redo',      label: 'Redo' },
        { type: 'separator' },
        { role: 'cut',       label: 'Cut' },
        { role: 'copy',      label: 'Copy' },
        { role: 'paste',     label: 'Paste' },
        { role: 'selectAll', label: 'Select All' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In',    accelerator: a('zoom-in'),    click: () => tabManager.zoomIn() },
        { label: 'Zoom Out',   accelerator: a('zoom-out'),   click: () => tabManager.zoomOut() },
        { type: 'separator' },
        { label: 'Reset Zoom', accelerator: a('zoom-reset'), click: () => tabManager.resetZoom() },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Next Tab',     accelerator: a('next-tab'), click: () => tabManager.nextTab() },
        { label: 'Previous Tab', accelerator: a('prev-tab'), click: () => tabManager.previousTab() },
        { type: 'separator' },
        {
          label:       'Minimize',
          accelerator: a('minimize'),
          click: () => win.minimize(),
        },
        {
          label:       'Maximize / Restore',
          accelerator: a('maximize'),
          click: () => win.isMaximized() ? win.unmaximize() : win.maximize(),
        },
        { type: 'separator' },
        {
          label:       'Keyboard Shortcuts…',
          accelerator: 'CmdOrCtrl+,',
          click: () => openShortcutsWindow(),
        },
      ],
    },
    {
      label: 'Developer',
      submenu: [
        {
          label:       'Toggle DevTools',
          accelerator: a('devtools'),
          click: () => tabManager.toggleDevTools(),
        },
        {
          label:       'Reload App',
          accelerator: a('reload-app'),
          click: () => { app.relaunch(); app.quit(); },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
