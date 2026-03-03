# Figlinux

An unofficial Figma desktop client for Linux, built with Electron.

Figma has no official Linux app. This wrapper delivers the full Figma experience as a native desktop application — with features the browser tab can't offer.

## Features

- **Multi-tab** — open multiple Figma files side by side (Ctrl+T / Ctrl+W / Ctrl+Tab)
- **Local font support** — system fonts appear in Figma's font picker via a built-in font server
- **Google sign-in** — opens your default browser for OAuth (per RFC 8252), then syncs the session back
- **Customisable keyboard shortcuts** — rebind any shortcut via the built-in editor (Ctrl+,)
- **Tab hibernation** — idle tabs sleep after 5 min, freeing GPU memory for active work
- **Session restore** — reopen your last tabs on startup (opt-in)
- **Drag to reorder tabs**
- **Back / Forward navigation** — Ctrl+[ / Ctrl+]
- **Zoom controls** — Ctrl+Shift+= / - / 0 with percentage display
- **Download handling** — files save to ~/Downloads and reveal in the file manager

## Performance

Figlinux is tuned for large Figma files and GPU-heavy workflows:

- **GPU hardware acceleration** — `enable-gpu-rasterization`, `enable-zero-copy`, `ignore-gpu-blocklist` (critical on Linux where GPUs are often blocklisted by Chromium)
- **4 GB V8 heap** — `--max-old-space-size=4096` prevents out-of-memory crashes on complex files
- **No background throttling** — inactive tabs stay responsive (`disable-renderer-backgrounding`, `disable-background-timer-throttling`)
- **Tab hibernation** — tabs idle for 5+ minutes navigate to `about:blank`, releasing GPU/memory. They wake instantly on activation.
- **Debounced IPC** — tab state updates (title, favicon, loading) are coalesced to one message per frame (16 ms), preventing IPC floods
- **Font content caching** — font file bytes are cached in memory after first read, avoiding repeated disk I/O

## Install

### Quick install (adds to your app menu)

```bash
git clone https://github.com/KhangPhan90/figlinux.git
cd figlinux
bash setup.sh
```

This installs Figlinux to `~/.local/share/figlinux` and adds a desktop entry so you can launch it from your app menu.

### Requirements

- Node.js 20+
- `fontconfig` (`fc-list`) for local font discovery
- Firefox or Chrome/Chromium (for Google sign-in only)
- Linux (tested on Fedora 43 / Wayland + X11)

### Run from source (without installing)

```bash
git clone https://github.com/KhangPhan90/figlinux.git
cd figlinux
npm install
npm start
```

### Build a portable AppImage

```bash
npm run build   # produces AppImage + deb in dist/
```

### Uninstall

```bash
rm -rf ~/.local/share/figlinux
rm -f ~/.local/share/applications/io.github.KhangPhan90.Figlinux.desktop
rm -f ~/.local/share/icons/hicolor/*/apps/figlinux.png
```

## Keyboard shortcuts

| Action | Default |
|--------|---------|
| New tab | Ctrl+T |
| Close tab | Ctrl+W |
| Next tab | Ctrl+Tab |
| Previous tab | Ctrl+Shift+Tab |
| Switch to tab 1-9 | Ctrl+1-9 |
| Go back | Ctrl+[ |
| Go forward | Ctrl+] |
| Reload | Ctrl+Shift+R |
| Zoom in/out/reset | Ctrl+Shift+= / - / 0 |
| Open shortcuts editor | Ctrl+, |

All shortcuts (except Ctrl+1-9) are rebindable via the shortcuts editor.

## Disclaimer

This is an **unofficial** third-party client. It is not affiliated with, endorsed by, or supported by Figma, Inc. Use it at your own risk and in accordance with [Figma's Terms of Service](https://www.figma.com/tos/).

## License

MIT
