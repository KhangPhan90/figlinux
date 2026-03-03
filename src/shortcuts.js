// ── Shortcut registry ─────────────────────────────────────────────────────────
// Single source of truth for every app-level shortcut.
// readonly: true  →  shown in UI but not editable
// defaultAccel: null  →  unbound by default

const DEFS = [
  // ── Tabs ────────────────────────────────────────────────────────────────────
  { id: 'new-tab',    label: 'New Tab',            category: 'Tabs',       defaultAccel: 'CmdOrCtrl+T' },
  { id: 'close-tab',  label: 'Close Tab',          category: 'Tabs',       defaultAccel: 'CmdOrCtrl+W' },
  { id: 'next-tab',   label: 'Next Tab',           category: 'Tabs',       defaultAccel: 'CmdOrCtrl+Tab' },
  { id: 'prev-tab',   label: 'Previous Tab',       category: 'Tabs',       defaultAccel: 'CmdOrCtrl+Shift+Tab' },
  { id: 'switch-tab', label: 'Switch to Tab 1–9',  category: 'Tabs',       defaultAccel: 'Ctrl+1 … Ctrl+9', readonly: true },

  // ── Navigation ──────────────────────────────────────────────────────────────
  { id: 'go-back',    label: 'Go Back',            category: 'Navigation', defaultAccel: null },
  { id: 'go-forward', label: 'Go Forward',         category: 'Navigation', defaultAccel: null },
  { id: 'reload',     label: 'Reload Tab',         category: 'Navigation', defaultAccel: 'CmdOrCtrl+Shift+R' },

  // ── Window ──────────────────────────────────────────────────────────────────
  { id: 'new-window', label: 'New Window',         category: 'Window',     defaultAccel: 'CmdOrCtrl+Shift+N' },
  { id: 'minimize',   label: 'Minimize',           category: 'Window',     defaultAccel: 'CmdOrCtrl+M' },
  { id: 'maximize',   label: 'Maximize / Restore', category: 'Window',     defaultAccel: 'CmdOrCtrl+Shift+M' },
  { id: 'quit',       label: 'Quit',               category: 'Window',     defaultAccel: 'CmdOrCtrl+Q' },

  // ── View ────────────────────────────────────────────────────────────────────
  { id: 'zoom-in',    label: 'Zoom In',            category: 'View',       defaultAccel: 'CmdOrCtrl+Shift+=' },
  { id: 'zoom-out',   label: 'Zoom Out',           category: 'View',       defaultAccel: 'CmdOrCtrl+Shift+-' },
  { id: 'zoom-reset', label: 'Reset Zoom',         category: 'View',       defaultAccel: 'CmdOrCtrl+Shift+0' },

  // ── Developer ───────────────────────────────────────────────────────────────
  { id: 'devtools',   label: 'Toggle DevTools',    category: 'Developer',  defaultAccel: 'CmdOrCtrl+Shift+I' },
  { id: 'reload-app', label: 'Reload App',         category: 'Developer',  defaultAccel: 'CmdOrCtrl+Shift+Alt+R' },
];

// Figma's own shortcuts — listed for reference only, cannot be changed here
const FIGMA_DEFS = [
  { label: 'Undo',             category: 'Edit',   accel: 'Ctrl+Z' },
  { label: 'Redo',             category: 'Edit',   accel: 'Ctrl+Shift+Z' },
  { label: 'Copy',             category: 'Edit',   accel: 'Ctrl+C' },
  { label: 'Paste',            category: 'Edit',   accel: 'Ctrl+V' },
  { label: 'Cut',              category: 'Edit',   accel: 'Ctrl+X' },
  { label: 'Select All',       category: 'Edit',   accel: 'Ctrl+A' },
  { label: 'Duplicate',        category: 'Edit',   accel: 'Ctrl+D' },
  { label: 'Save',             category: 'File',   accel: 'Ctrl+S' },
  { label: 'Canvas Zoom In',   category: 'Canvas', accel: 'Ctrl+=' },
  { label: 'Canvas Zoom Out',  category: 'Canvas', accel: 'Ctrl+-' },
  { label: 'Zoom to 100%',     category: 'Canvas', accel: 'Ctrl+0' },
  { label: 'Fit to Screen',    category: 'Canvas', accel: 'Shift+1' },
  { label: 'Show / Hide UI',   category: 'Canvas', accel: 'Ctrl+\\' },
  { label: 'Group',            category: 'Layers', accel: 'Ctrl+G' },
  { label: 'Ungroup',          category: 'Layers', accel: 'Ctrl+Shift+G' },
  { label: 'Frame Selection',  category: 'Layers', accel: 'Ctrl+Alt+G' },
  { label: 'Bold',             category: 'Text',   accel: 'Ctrl+B' },
  { label: 'Italic',           category: 'Text',   accel: 'Ctrl+I' },
  { label: 'Underline',        category: 'Text',   accel: 'Ctrl+U' },
  { label: 'Find',             category: 'Search', accel: 'Ctrl+F' },
];

/**
 * Merge user overrides with defaults to produce the effective shortcut map.
 * Returns { id → accelerator | null } for all non-readonly shortcuts.
 */
function resolveAll(userOverrides = {}) {
  const result = {};
  for (const def of DEFS) {
    if (def.readonly) continue;
    result[def.id] = (def.id in userOverrides) ? userOverrides[def.id] : def.defaultAccel;
  }
  return result;
}

/**
 * Test whether an Electron before-input-event matches an accelerator string.
 */
function matchesInput(accel, input) {
  if (!accel) return false;
  const parts = accel.split('+');
  const key = parts[parts.length - 1];
  const needsCtrl  = parts.some(p => /^(cmdorctrl|ctrl|control)$/i.test(p));
  const needsShift = parts.some(p => /^shift$/i.test(p));
  const needsAlt   = parts.some(p => /^alt$/i.test(p));
  return (input.control || input.meta) === needsCtrl
    && input.shift === needsShift
    && input.alt   === needsAlt
    && input.key.toLowerCase() === key.toLowerCase();
}

module.exports = { DEFS, FIGMA_DEFS, resolveAll, matchesInput };
