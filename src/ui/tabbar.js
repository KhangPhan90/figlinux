let currentTabs = [];
let draggingIndex = -1;

function renderTabs(tabs) {
  currentTabs = tabs;
  const container = document.getElementById('tabs');
  container.innerHTML = '';

  // Update back / forward button state and zoom display for the active tab
  const activeTab = tabs.find(t => t.active);
  document.getElementById('back-btn').disabled    = !activeTab?.canGoBack;
  document.getElementById('forward-btn').disabled = !activeTab?.canGoForward;

  const zoom = activeTab?.zoom ?? 100;
  const zoomPct = document.getElementById('zoom-pct');
  zoomPct.textContent = zoom + '%';
  zoomPct.classList.toggle('at-default', zoom === 100);

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.active ? ' active' : '') + (tab.pinned ? ' pinned' : '');
    if (tab.pinned) el.title = tab.title; // tooltip replaces visible title

    // ── Favicon / spinner ───────────────────────────────────────────────────
    const iconEl = document.createElement('span');
    iconEl.className = 'tab-icon';

    if (tab.loading) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      iconEl.appendChild(spinner);
    } else if (tab.favicon) {
      const img = document.createElement('img');
      img.src = tab.favicon;
      img.width = 14;
      img.height = 14;
      img.alt = '';
      img.addEventListener('error', () => { iconEl.innerHTML = ''; });
      iconEl.appendChild(img);
    }

    el.appendChild(iconEl);

    // ── Title + close (hidden for pinned/home tabs) ─────────────────────────
    if (!tab.pinned) {
      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.title;
      el.appendChild(titleEl);

      if (!tab.home) {
        const closeEl = document.createElement('span');
        closeEl.className = 'tab-close';
        closeEl.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>`;
        el.appendChild(closeEl);
      }
    }

    // ── Mouse events ────────────────────────────────────────────────────────
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tab-close')) {
        e.stopPropagation();
        window.shell.closeTab(tab.index);
      } else if (e.button === 1 && !tab.home) {
        e.preventDefault(); // suppress middle-click scroll indicator
        window.shell.closeTab(tab.index);
      } else if (e.button === 0) {
        window.shell.switchTab(tab.index);
      }
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showCtxMenu(e.clientX, e.clientY, tab.index);
    });

    // ── Drag to reorder (home tab is not draggable) ──────────────────────────
    if (!tab.home) {
      el.draggable = true;

      el.addEventListener('dragstart', (e) => {
        draggingIndex = tab.index;
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => el.classList.add('dragging'));
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        draggingIndex = -1;
      });
    }

    el.addEventListener('dragover', (e) => {
      if (draggingIndex === -1 || tab.home) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (draggingIndex !== -1 && draggingIndex !== tab.index && !tab.home) {
        window.shell.reorderTab(draggingIndex, tab.index);
      }
      draggingIndex = -1;
    });

    container.appendChild(el);
  }
}

// ── Context menu ─────────────────────────────────────────────────────────────

let ctxTabIndex = -1;

function showCtxMenu(x, y, tabIndex) {
  ctxTabIndex = tabIndex;
  const menu = document.getElementById('ctx-menu');
  const tab = currentTabs[tabIndex];

  document.getElementById('ctx-pin').textContent =
    tab && tab.pinned ? 'Unpin Tab' : 'Pin Tab';

  // Hide close option for the home tab (it cannot be closed)
  const isHome = tab && tab.home;
  document.querySelector('#ctx-menu [data-action="close"]').style.display = isHome ? 'none' : '';
  document.querySelector('#ctx-menu hr').style.display = isHome ? 'none' : '';

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');

  // Keep menu within viewport bounds
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight)
      menu.style.top = (y - rect.height) + 'px';
  });
}

function hideCtxMenu() {
  document.getElementById('ctx-menu').classList.add('hidden');
  ctxTabIndex = -1;
}

document.getElementById('ctx-menu').addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action || ctxTabIndex === -1) return;

  if (action === 'pin')           window.shell.pinTab(ctxTabIndex);
  else if (action === 'duplicate')      window.shell.duplicateTab(ctxTabIndex);
  else if (action === 'close-others')   window.shell.closeOtherTabs(ctxTabIndex);
  else if (action === 'close')          window.shell.closeTab(ctxTabIndex);

  hideCtxMenu();
});

// Hide context menu when clicking anywhere else
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#ctx-menu')) hideCtxMenu();
});

// ── Wire up controls ─────────────────────────────────────────────────────────

document.getElementById('back-btn').addEventListener('click', () => {
  const active = currentTabs.find(t => t.active);
  if (active) window.shell.goBack(active.index);
});

document.getElementById('forward-btn').addEventListener('click', () => {
  const active = currentTabs.find(t => t.active);
  if (active) window.shell.goForward(active.index);
});

document.getElementById('zoom-out-btn').addEventListener('click', () => window.shell.zoomOut());
document.getElementById('zoom-pct').addEventListener('click', () => window.shell.resetZoom());
document.getElementById('zoom-in-btn').addEventListener('click', () => window.shell.zoomIn());

document.getElementById('settings-btn').addEventListener('click', () => {
  window.shell.openShortcuts();
});

document.getElementById('new-tab-btn').addEventListener('click', () => {
  window.shell.newTab();
});

// Scroll tabs horizontally with mouse wheel
document.getElementById('tabs').addEventListener('wheel', (e) => {
  e.preventDefault();
  document.getElementById('tabs').scrollLeft += e.deltaY || e.deltaX;
}, { passive: false });

// ── Listen for tab state updates from main process ───────────────────────────

window.shell.onTabsUpdated(renderTabs);
