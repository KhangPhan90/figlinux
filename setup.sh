#!/bin/bash
set -e

APP_NAME="Figlinux"
INSTALL_DIR="$HOME/.local/share/figlinux"
DESKTOP_FILE="$HOME/.local/share/applications/figlinux.desktop"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"

echo "=== $APP_NAME — Install ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js 20+ is required."
  echo "Install: sudo dnf install nodejs"
  exit 1
fi

echo "Node: $(node --version)  npm: $(npm --version)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install --production
echo ""

# Copy app to install directory
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r src package.json package-lock.json node_modules assets "$INSTALL_DIR/"

# Install icon at multiple sizes for best display
for size in 48 64 128 256 512; do
  dir="$HOME/.local/share/icons/hicolor/${size}x${size}/apps"
  mkdir -p "$dir"
  if command -v magick &> /dev/null; then
    magick assets/icon.png -resize "${size}x${size}" "$dir/figlinux.png"
  elif command -v convert &> /dev/null; then
    convert assets/icon.png -resize "${size}x${size}" "$dir/figlinux.png"
  else
    cp assets/icon.png "$dir/figlinux.png"
  fi
done

# Create desktop entry
mkdir -p "$(dirname "$DESKTOP_FILE")"
cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Name=Figlinux
GenericName=Design Tool
Comment=Unofficial Figma desktop client for Linux
Exec=npx --prefix $INSTALL_DIR electron $INSTALL_DIR
Icon=figlinux
Type=Application
Categories=Graphics;2DGraphics;VectorGraphics;
Keywords=figma;design;ui;ux;prototype;
StartupWMClass=figlinux
DESKTOP

# Update desktop and icon caches
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo ""
echo "=== Installed! ==="
echo ""
echo "Launch from your app menu, or run:"
echo "  npx --prefix $INSTALL_DIR electron $INSTALL_DIR"
echo ""
echo "To uninstall:"
echo "  rm -rf $INSTALL_DIR $DESKTOP_FILE"
echo "  rm -f ~/.local/share/icons/hicolor/*/apps/figlinux.png"
