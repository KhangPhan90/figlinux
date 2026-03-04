#!/bin/bash
set -e

APP_NAME="Figlinux"
INSTALL_DIR="$HOME/.local/share/figlinux"
DESKTOP_FILE="$HOME/.local/share/applications/io.github.KhangPhan90.Figlinux.desktop"

# Clean up partial install on failure
cleanup() { [ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"; }
trap 'echo ""; echo "ERROR: Install failed. Cleaned up partial install."; cleanup' ERR

echo "=== $APP_NAME — Install ==="
echo ""

# Check Node.js exists and is v20+
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js 20+ is required."
  echo "Install: sudo dnf install nodejs"
  exit 1
fi

NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node.js 20+ is required (found v$(node --version))."
  echo "Update: sudo dnf install nodejs"
  exit 1
fi

echo "Node: $(node --version)  npm: $(npm --version)"
echo ""

# Check icon exists
if [ ! -f assets/icon.png ]; then
  echo "ERROR: assets/icon.png not found. Are you running this from the project root?"
  exit 1
fi

# Install dependencies (electron is a devDependency, so we need the full install)
echo "Installing dependencies..."
npm install
echo ""

# Copy app to install directory
echo "Installing to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
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
Exec=$INSTALL_DIR/node_modules/.bin/electron $INSTALL_DIR
Icon=figlinux
Type=Application
Categories=Graphics;2DGraphics;VectorGraphics;
Keywords=figma;design;ui;ux;prototype;
StartupWMClass=io.github.KhangPhan90.Figlinux
DESKTOP

# Update desktop and icon caches
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo ""
echo "=== Installed! ==="
echo ""
echo "Launch from your app menu, or run:"
echo "  $INSTALL_DIR/node_modules/.bin/electron $INSTALL_DIR"
echo ""
echo "To uninstall:"
echo "  rm -rf $INSTALL_DIR $DESKTOP_FILE"
echo "  rm -f ~/.local/share/icons/hicolor/*/apps/figlinux.png"
