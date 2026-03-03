const { WebContentsView, shell, app } = require('electron');
const path = require('path');
const { matchesInput } = require('./shortcuts');

const TAB_BAR_HEIGHT = 48;
const HIBERNATE_DELAY_MS = 5 * 60 * 1000; // hibernate inactive tabs after 5 minutes

// Must be Windows UA — Figma only contacts the local font agent on Windows/macOS
const FIGMA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function isFigmaUrl(url) {
  try {
    const host = new URL(url).hostname;
    return (
      host.endsWith('figma.com') ||
      host.endsWith('figmausercontent.com') ||
      host.endsWith('figma-alpha.com')
    );
  } catch {
    return false;
  }
}

function isAllowedUrl(url) {
  try {
    const host = new URL(url).hostname;
    return (
      isFigmaUrl(url) ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('google.com') ||
      host.endsWith('googleapis.com') ||
      host.endsWith('microsoft.com') ||
      host.endsWith('live.com') ||
      host.endsWith('microsoftonline.com') ||
      host === 'github.com' ||
      host.endsWith('.github.com') ||
      host.endsWith('okta.com') ||
      host.endsWith('amazonaws.com') ||
      host.endsWith('cloudfront.net')
    );
  } catch {
    return false;
  }
}

class TabManager {
  constructor(win) {
    this.win = win;
    this.tabs = [];
    this.activeIndex = -1;
    this.onTabsChange = null;
    this.shortcuts = {}; // set by setShortcuts() after menu is built
    this._updateTimer = null; // debounce timer for _sendUpdate

    const update = () => this.updateActiveBounds();
    // On Linux/Wayland the compositor applies maximize asynchronously, so
    // the new content size isn't available until after the event fires.
    // Schedule retries at increasing intervals so at least one lands after
    // the compositor has committed the new dimensions.
    const updateAfterStateChange = () => {
      [0, 100, 300].forEach(ms => setTimeout(update, ms));
    };
    win.on('resize', update);
    win.on('maximize', updateAfterStateChange);
    win.on('unmaximize', updateAfterStateChange);
    win.on('enter-full-screen', updateAfterStateChange);
    win.on('leave-full-screen', updateAfterStateChange);
  }

  setShortcuts(shortcuts) {
    this.shortcuts = shortcuts;
  }

  createTab(url = 'https://www.figma.com/files/', { home = false } = {}) {
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // needed for Figma's WASM
      },
    });

    view.webContents.setUserAgent(FIGMA_UA);
    // Keep tab responsive even when it is not the active view
    view.webContents.setBackgroundThrottling(false);
    view.webContents.loadURL(url);
    this.win.contentView.addChildView(view);

    const tab = {
      view,
      title: 'New Tab',
      url,
      favicon: null,
      loading: false,
      pinned: false,
      home,
      hibernated: false,    // true while tab is sleeping (navigated to about:blank)
      _hibernateTimer: null, // setTimeout handle for pending hibernation
    };
    this.tabs.push(tab);

    // Update tab title when the page title changes
    view.webContents.on('page-title-updated', (e, title) => {
      if (tab.hibernated) return; // ignore about:blank title during hibernation
      tab.title = title.replace(/\s*[–-]\s*Figma\s*$/, '').trim() || 'Figma';
      this._sendUpdate();
    });

    view.webContents.on('did-navigate', (e, navUrl) => {
      if (tab.hibernated) return; // ignore about:blank navigation during hibernation
      tab.url = navUrl;
      this._sendUpdate(); // refresh canGoBack / canGoForward
    });

    view.webContents.on('page-favicon-updated', (_e, favicons) => {
      if (tab.hibernated) return;
      tab.favicon = favicons[0] || null;
      this._sendUpdate();
    });

    view.webContents.on('did-start-loading', () => {
      if (tab.hibernated) return;
      tab.loading = true;
      this._sendUpdate();
    });

    view.webContents.on('did-stop-loading', () => {
      if (tab.hibernated) return;
      tab.loading = false;
      this._sendUpdate();
    });

    // Open Figma links in a new tab; everything else in the system browser
    view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
      if (isFigmaUrl(newUrl)) {
        this.createTab(newUrl);
      } else {
        shell.openExternal(newUrl);
      }
      return { action: 'deny' };
    });

    // Block navigation to non-allowed domains
    view.webContents.on('will-navigate', (event, navUrl) => {
      if (!isAllowedUrl(navUrl)) {
        event.preventDefault();
        shell.openExternal(navUrl);
      }
    });

    // Intercept app-level shortcuts before Figma's canvas sees them.
    // Ctrl+Tab cannot be caught by menu accelerators on all platforms,
    // so before-input-event is the primary handler for navigation shortcuts.
    view.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const sc = this.shortcuts;
      const ctrl = input.control || input.meta;

      if      (matchesInput(sc['next-tab'],   input)) { this.nextTab();                         event.preventDefault(); }
      else if (matchesInput(sc['prev-tab'],   input)) { this.previousTab();                     event.preventDefault(); }
      else if (matchesInput(sc['new-tab'],    input)) { this.createTab();                       event.preventDefault(); }
      else if (matchesInput(sc['close-tab'],  input)) { this.closeTab(this.activeIndex);        event.preventDefault(); }
      else if (matchesInput(sc['go-back'],    input)) { this.goBack(this.activeIndex);          event.preventDefault(); }
      else if (matchesInput(sc['go-forward'], input)) { this.goForward(this.activeIndex);       event.preventDefault(); }
      else if (matchesInput(sc['reload'],     input)) { this.reloadActive();                    event.preventDefault(); }
      else if (matchesInput(sc['zoom-in'],    input)) { this.zoomIn();                          event.preventDefault(); }
      else if (matchesInput(sc['zoom-out'],   input)) { this.zoomOut();                         event.preventDefault(); }
      else if (matchesInput(sc['zoom-reset'], input)) { this.resetZoom();                       event.preventDefault(); }
      // Ctrl+1–9: switch tab by position — hardcoded, cannot be rebound
      else if (ctrl && !input.shift && !input.alt && /^[1-9]$/.test(input.key)) {
        this.setActive(parseInt(input.key, 10) - 1);
        event.preventDefault();
      }
    });

    this.setActive(this.tabs.length - 1);
    return tab;
  }

  setActive(index) {
    if (index < 0 || index >= this.tabs.length) return;

    const tab = this.tabs[index];

    // Cancel any pending hibernation for the tab being activated
    clearTimeout(tab._hibernateTimer);
    tab._hibernateTimer = null;

    // Wake a hibernated tab — navigate back to its stored URL
    if (tab.hibernated) {
      tab.hibernated = false;
      tab.loading = true;
      tab.view.webContents.loadURL(tab.url);
    }

    this.activeIndex = index;
    this.updateActiveBounds();
    // Transfer keyboard focus to the new active view so before-input-event
    // shortcuts keep firing. Without this, the old (now hidden/0×0) view
    // retains focus and stops receiving input on Linux.
    tab.view.webContents.focus();
    this._sendUpdate();
  }

  closeTab(index) {
    if (index < 0 || index >= this.tabs.length) return;
    if (this.tabs[index].home) return; // home tab cannot be closed

    const tab = this.tabs[index];
    clearTimeout(tab._hibernateTimer); // cancel any pending hibernation
    const { view } = tab;
    this.win.contentView.removeChildView(view);
    view.webContents.close();
    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      app.quit();
      return;
    }

    this.setActive(Math.min(this.activeIndex, this.tabs.length - 1));
  }

  nextTab() {
    if (this.tabs.length < 2) return;
    this.setActive((this.activeIndex + 1) % this.tabs.length);
  }

  previousTab() {
    if (this.tabs.length < 2) return;
    this.setActive((this.activeIndex - 1 + this.tabs.length) % this.tabs.length);
  }

  reloadActive() {
    const tab = this.tabs[this.activeIndex];
    if (tab) tab.view.webContents.reload();
  }

  zoomIn() {
    const tab = this.tabs[this.activeIndex];
    if (!tab) return;
    const f = tab.view.webContents.getZoomFactor();
    tab.view.webContents.setZoomFactor(Math.min(Math.round((f + 0.1) * 10) / 10, 3.0));
    this._sendUpdate();
  }

  zoomOut() {
    const tab = this.tabs[this.activeIndex];
    if (!tab) return;
    const f = tab.view.webContents.getZoomFactor();
    tab.view.webContents.setZoomFactor(Math.max(Math.round((f - 0.1) * 10) / 10, 0.3));
    this._sendUpdate();
  }

  resetZoom() {
    const tab = this.tabs[this.activeIndex];
    if (!tab) return;
    tab.view.webContents.setZoomFactor(1.0);
    this._sendUpdate();
  }

  toggleDevTools() {
    const tab = this.tabs[this.activeIndex];
    if (!tab) return;
    const wc = tab.view.webContents;
    wc.isDevToolsOpened() ? wc.closeDevTools() : wc.openDevTools({ mode: 'detach' });
  }

  updateActiveBounds() {
    const [w, h] = this.win.getContentSize();
    this.tabs.forEach((tab, i) => {
      if (i === this.activeIndex) {
        tab.view.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width: w, height: h - TAB_BAR_HEIGHT });
      } else {
        // Tuck inactive views out of sight (keeps them alive / pre-loaded)
        tab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

        // Schedule hibernation for idle non-critical tabs (frees GPU/memory for big files)
        if (!tab.hibernated && !tab._hibernateTimer && !tab.home && !tab.pinned) {
          tab._hibernateTimer = setTimeout(() => {
            tab._hibernateTimer = null;
            const idx = this.tabs.indexOf(tab);
            if (idx !== -1 && idx !== this.activeIndex && !tab.loading) {
              tab.hibernated = true;
              tab.view.webContents.loadURL('about:blank');
              this._sendUpdate();
            }
          }, HIBERNATE_DELAY_MS);
        }
      }
    });
  }

  pinTab(index) {
    const tab = this.tabs[index];
    if (!tab) return;
    tab.pinned = !tab.pinned;
    this._sendUpdate();
  }

  duplicateTab(index) {
    const tab = this.tabs[index];
    if (tab) this.createTab(tab.url);
  }

  closeOtherTabs(index) {
    // Collect views to close (skip pinned/home tabs and the target tab)
    const toClose = this.tabs
      .filter((t, i) => i !== index && !t.pinned && !t.home)
      .map(t => t.view);

    for (const view of toClose) {
      const i = this.tabs.findIndex(t => t.view === view);
      if (i !== -1) this.closeTab(i);
    }
  }

  goBack(index) {
    const tab = this.tabs[index];
    if (tab && tab.view.webContents.navigationHistory.canGoBack())
      tab.view.webContents.navigationHistory.goBack();
  }

  goForward(index) {
    const tab = this.tabs[index];
    if (tab && tab.view.webContents.navigationHistory.canGoForward())
      tab.view.webContents.navigationHistory.goForward();
  }

  reorderTab(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.tabs.length) return;
    if (toIndex < 0 || toIndex >= this.tabs.length) return;
    if (this.tabs[fromIndex].home || this.tabs[toIndex].home) return;

    const [tab] = this.tabs.splice(fromIndex, 1);
    this.tabs.splice(toIndex, 0, tab);

    // Keep activeIndex pointing at the same tab after the move
    if (this.activeIndex === fromIndex) {
      this.activeIndex = toIndex;
    } else if (fromIndex < toIndex) {
      if (this.activeIndex > fromIndex && this.activeIndex <= toIndex) this.activeIndex--;
    } else {
      if (this.activeIndex >= toIndex && this.activeIndex < fromIndex) this.activeIndex++;
    }

    this._sendUpdate();
  }

  // Debounced: batches rapid events (loading, navigation, title) into one IPC message per frame
  _sendUpdate() {
    clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => {
      this._updateTimer = null;
      const data = this.tabs.map((tab, i) => ({
        index: i,
        title: tab.title,
        active: i === this.activeIndex,
        favicon: tab.favicon,
        loading: tab.loading,
        pinned: tab.pinned,
        home: tab.home,
        hibernated: tab.hibernated,
        canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
        canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
        zoom: Math.round(tab.view.webContents.getZoomFactor() * 100),
      }));
      this.win.webContents.send('tabs-updated', data);
      this.onTabsChange?.(this.tabs);
    }, 16); // one frame — imperceptible delay, prevents redundant IPC floods
  }
}

module.exports = { TabManager };
