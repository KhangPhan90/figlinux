#!/bin/bash

# Let the user override the Ozone platform; default to auto-detect.
# "auto" makes Electron pick Wayland when available and fall back to X11.
export ELECTRON_OZONE_PLATFORM_HINT=${ELECTRON_OZONE_PLATFORM_HINT:-auto}

# zypak-wrapper is provided by org.electronjs.Electron2.BaseApp.
# It re-implements the Chromium sandbox using bubblewrap so Electron works
# inside the Flatpak sandbox without --no-sandbox.
exec zypak-wrapper /app/main/figma-on-linux "$@"
