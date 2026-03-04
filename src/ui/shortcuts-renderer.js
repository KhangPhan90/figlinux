// ── State ─────────────────────────────────────────────────────────────────────
let allData = null;
let recordingId = null;

const isMac = window.shortcutsAPI.platform === 'darwin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAccel(accel) {
  if (!accel) return '—';
  return accel
    .replace(/CmdOrCtrl/g, isMac ? 'Cmd' : 'Ctrl')
    .replace(/\+/g, ' + ');
}

// Build an Electron-style accelerator string from a keydown event.
// Returns: accelerator string, '' to clear (Backspace), or null to ignore.
function buildAccelFromEvent(e) {
  const { key } = e;

  // Standalone modifiers — ignore
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(key)) {
    return null;
  }

  if (key === 'Backspace' || key === 'Delete') return ''; // signal: clear

  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('CmdOrCtrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  // Normalize the key to Electron accelerator format
  const KEY_MAP = {
    ' ':          'Space',
    'ArrowUp':    'Up',    'ArrowDown':  'Down',
    'ArrowLeft':  'Left',  'ArrowRight': 'Right',
    'Enter':      'Return',
    // Shifted symbol → unshifted key code
    '+': '=',  '_': '-',
    '!': '1',  '@': '2',  '#': '3',  '$': '4',  '%': '5',
    '^': '6',  '&': '7',  '*': '8',  '(': '9',  ')': '0',
    '{': '[',  '}': ']',  '|': '\\', ':': ';',  '"': "'",
    '<': ',',  '>': '.',  '?': '/',  '~': '`',
  };

  let accelKey = KEY_MAP[key] ?? (key.length === 1 ? key.toUpperCase() : key);

  // Function keys (F1–F24) are allowed without modifiers
  const isFnKey = /^F[0-9]{1,2}$/.test(accelKey);
  if (parts.length === 0 && !isFnKey) return null; // must have a modifier

  parts.push(accelKey);
  return parts.join('+');
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildNav() {
  const nav = document.getElementById('nav');
  const appCategories = [...new Set(allData.app.map(s => s.category))];
  const figmaCategories = [...new Set(allData.figma.map(s => s.category))];

  let html = '<div class="nav-group-label">App Shortcuts</div>';
  for (const cat of appCategories) {
    html += `<a class="nav-item" data-cat="app-${slugify(cat)}" href="#">${cat}</a>`;
  }
  html += '<div class="nav-group-label" style="margin-top:14px">Figma Built-in</div>';
  for (const cat of figmaCategories) {
    html += `<a class="nav-item" data-cat="figma-${slugify(cat)}" href="#">${cat}</a>`;
  }
  nav.innerHTML = html;

  nav.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      nav.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      const target = document.getElementById('sec-' + a.dataset.cat);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Highlight active category on scroll
  const sections = document.querySelectorAll('.section[id]');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('sec-', '');
        nav.querySelectorAll('.nav-item').forEach(a => {
          a.classList.toggle('active', a.dataset.cat === id);
        });
      }
    }
  }, { root: document.getElementById('content'), threshold: 0.3 });
  sections.forEach(s => observer.observe(s));

  // Activate first item
  nav.querySelector('.nav-item')?.classList.add('active');
}

function renderContent() {
  const sections = document.getElementById('sections');
  const appCategories = [...new Set(allData.app.map(s => s.category))];
  const figmaCategories = [...new Set(allData.figma.map(s => s.category))];

  let html = '';

  for (const cat of appCategories) {
    const rows = allData.app.filter(s => s.category === cat);
    html += `<section class="section" id="sec-app-${slugify(cat)}">
      <div class="section-title">${cat}</div>
      ${rows.map(renderAppRow).join('')}
    </section>`;
  }

  html += `<div class="figma-group-header">
    <span class="figma-group-title">Figma Built-in</span>
    <span class="figma-group-note">Figma's own shortcuts — listed for reference, cannot be changed here.</span>
  </div>`;

  for (const cat of figmaCategories) {
    const rows = allData.figma.filter(s => s.category === cat);
    html += `<section class="section" id="sec-figma-${slugify(cat)}">
      <div class="section-title">${cat}</div>
      ${rows.map(renderFigmaRow).join('')}
    </section>`;
  }

  sections.innerHTML = html;
  attachRowListeners();
}

function renderAppRow(s) {
  const display = formatAccel(s.currentAccel);
  const isRecording = recordingId === s.id;
  const badgeClass = [
    'shortcut-badge',
    s.readonly ? 'readonly' : '',
    !s.currentAccel && !s.readonly ? 'unset' : '',
    isRecording ? 'recording' : '',
  ].filter(Boolean).join(' ');

  const badgeText = isRecording ? 'Press shortcut…' : display;

  return `
    <div class="shortcut-row${s.readonly ? ' readonly' : ''}" data-id="${s.id}">
      <span class="action-label">${s.label}</span>
      <div class="shortcut-cell">
        <span class="${badgeClass}" data-badge>${badgeText}</span>
        <span class="conflict-msg hidden" data-conflict></span>
      </div>
      <button class="reset-btn${s.isModified ? '' : ' hidden'}" data-reset
        title="Reset to default: ${formatAccel(s.defaultAccel)}">↺</button>
    </div>`;
}

function renderFigmaRow(s) {
  return `
    <div class="shortcut-row readonly">
      <span class="action-label">${s.label}</span>
      <div class="shortcut-cell">
        <span class="shortcut-badge readonly">${formatAccel(s.accel)}</span>
      </div>
      <span style="width:24px"></span>
    </div>`;
}

function attachRowListeners() {
  document.querySelectorAll('.shortcut-row[data-id]').forEach(row => {
    const id = row.dataset.id;
    const def = allData.app.find(s => s.id === id);
    if (!def || def.readonly) return;

    row.querySelector('[data-badge]').addEventListener('click', () => {
      if (recordingId === id) stopRecording(true);
      else startRecording(id);
    });

    const resetBtn = row.querySelector('[data-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.shortcutsAPI.reset(id);
        await refreshAll();
      });
    }
  });
}

// ── Recording mode ────────────────────────────────────────────────────────────

function startRecording(id) {
  if (recordingId) stopRecording(true);
  recordingId = id;
  window.shortcutsAPI.setRecording(true);

  const row = document.querySelector(`[data-id="${id}"]`);
  if (!row) return;
  const badge = row.querySelector('[data-badge]');
  badge.textContent = 'Press shortcut…';
  badge.className = 'shortcut-badge recording';
  clearConflictMsg(id);

  document.getElementById('recording-hint').classList.remove('hidden');
}

function stopRecording(cancelled = false) {
  if (!recordingId) return;
  const id = recordingId;
  recordingId = null;
  window.shortcutsAPI.setRecording(false);
  document.getElementById('recording-hint').classList.add('hidden');

  const row = document.querySelector(`[data-id="${id}"]`);
  if (!row) return;

  if (cancelled) {
    const def = allData.app.find(s => s.id === id);
    const badge = row.querySelector('[data-badge]');
    badge.textContent = formatAccel(def?.currentAccel);
    badge.className = 'shortcut-badge' + (!def?.currentAccel ? ' unset' : '');
  }
  clearConflictMsg(id);
}

function clearConflictMsg(id) {
  const row = id ? document.querySelector(`[data-id="${id}"]`) : null;
  const msg = row ? row.querySelector('[data-conflict]') : null;
  if (msg) {
    msg.textContent = '';
    msg.classList.add('hidden');
  }
  const badge = row?.querySelector('[data-badge]');
  badge?.classList.remove('conflict');
}

// Global keydown — handles recording
window.addEventListener('keydown', async (e) => {
  if (!recordingId) return;
  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') { stopRecording(true); return; }

  const accel = buildAccelFromEvent(e);
  if (accel === null) return; // standalone modifier, ignore

  const id = recordingId;
  const row = document.querySelector(`[data-id="${id}"]`);
  const badge = row?.querySelector('[data-badge]');

  if (accel === '') {
    // Backspace / Delete → unbind
    stopRecording();
    await window.shortcutsAPI.set(id, null);
    await refreshAll();
    return;
  }

  // Attempt to set
  const result = await window.shortcutsAPI.set(id, accel);

  if (result.conflict) {
    // Show conflict but keep recording
    if (badge) {
      badge.textContent = formatAccel(accel);
      badge.className = 'shortcut-badge conflict';
    }
    const msg = row?.querySelector('[data-conflict]');
    if (msg) {
      msg.textContent = `⚠ Already used by "${result.conflict.label}"`;
      msg.classList.remove('hidden');
    }
  } else if (result.ok) {
    stopRecording();
    await refreshAll();
  }
}, { capture: true });

// ── Data refresh ──────────────────────────────────────────────────────────────

async function refreshAll() {
  const scrollTop = document.getElementById('content').scrollTop;
  allData = await window.shortcutsAPI.getAll();
  renderContent();
  document.getElementById('content').scrollTop = scrollTop;
}

// ── Reset all ─────────────────────────────────────────────────────────────────

document.getElementById('reset-all-btn').addEventListener('click', async () => {
  if (!confirm('Reset all shortcuts to their defaults?')) return;
  await window.shortcutsAPI.resetAll();
  await refreshAll();
});

// Click outside a row while recording → cancel
document.getElementById('content').addEventListener('mousedown', (e) => {
  if (!recordingId) return;
  const inRow = e.target.closest(`[data-id="${recordingId}"]`);
  if (!inRow) stopRecording(true);
});

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  allData = await window.shortcutsAPI.getAll();
  buildNav();
  renderContent();
})();
