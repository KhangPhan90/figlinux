#!/bin/bash
set -e

echo "=== Figma Desktop (Electron) — Setup ==="
echo ""

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is required. Install it first."
  exit 1
fi

echo "Node: $(node --version)  npm: $(npm --version)"
echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "=== Done! ==="
echo ""
echo "Run:   npm start"
echo "Build: npm run build   →  dist/"
