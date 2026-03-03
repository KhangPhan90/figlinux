# Figma Linux

An unofficial Figma desktop client for Linux, built with Electron.

Figma has no official Linux app. This wrapper gives you the full Figma web experience packaged as a native desktop application, with features the browser tab can't provide.

## Features

- **Multi-tab** — open multiple Figma files side by side (Ctrl+T / Ctrl+W / Ctrl+Tab)
- **Local font support** — your system fonts (fc-list) appear in Figma's font picker
- **Customisable keyboard shortcuts** — edit any shortcut via the gear button (Ctrl+,)
- **Back / Forward navigation** — Ctrl+[ / Ctrl+]
- **Drag to reorder tabs**
- **Pinned tabs** — icon-only, persistent across sessions
- **Zoom controls** — Ctrl+Shift+= / - / 0 with percentage display
- **Session restore** — reopen your last tabs on startup (opt-in)
- **Tab hibernation** — idle tabs sleep after 5 minutes to free GPU memory
- **Download handling** — files save to ~/Downloads and open in the file manager

## Requirements

- Linux (tested on Fedora 43 / Wayland + X11)
- Node.js 20+
- `fontconfig` (`fc-list`) for local font discovery

## Run from source

```bash
git clone https://github.com/KhangPhan90/figlinux.git
cd figlinux
npm install
npm start
```

## Build a distributable

```bash
npm run build   # produces AppImage + RPM in dist/
```

## Install via Flatpak (Flathub)

```bash
flatpak install flathub io.github.KhangPhan90.Figlinux
flatpak run io.github.KhangPhan90.Figlinux
```

## Keyboard shortcuts

| Action | Default |
|--------|---------|
| New tab | Ctrl+T |
| Close tab | Ctrl+W |
| Next tab | Ctrl+Tab |
| Previous tab | Ctrl+Shift+Tab |
| Switch to tab 1–9 | Ctrl+1–9 |
| Go back | Ctrl+[ |
| Go forward | Ctrl+] |
| Reload | Ctrl+Shift+R |
| Zoom in/out/reset | Ctrl+Shift+= / - / 0 |
| Open shortcuts editor | Ctrl+, |

All app shortcuts (except Ctrl+1–9) are rebindable via the shortcuts editor.

## Disclaimer

This is an **unofficial** third-party client. It is not affiliated with, endorsed by, or supported by Figma, Inc. Use it at your own risk and in accordance with [Figma's Terms of Service](https://www.figma.com/tos/).

## License

MIT
