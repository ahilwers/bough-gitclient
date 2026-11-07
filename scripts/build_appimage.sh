#!/usr/bin/env bash
# Copyright (C) 2026 Achim Hilwers
#
# This file is part of Bough.
#
# Bough is free software: you can redistribute it and/or modify it under the
# terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version. See the LICENSE file in the repository root for details.
#
# SPDX-License-Identifier: GPL-3.0-or-later

# build_appimage.sh — Build a self-contained AppImage for Linux.
#
# Usage:
#   ./scripts/build_appimage.sh <version> [binary-path]
#
# Requires:
#   - appimagetool (https://github.com/AppImage/AppImageKit/releases)
#     available on PATH or at /usr/local/bin/appimagetool
#   - The compiled Bough binary (default: app/build/bin/Bough)
#   - An icon at app/build/appicon.png
#
# Output:
#   Bough-<version>-linux-x86_64.AppImage  (current directory)
set -euo pipefail

VERSION="${1:?Usage: build_appimage.sh <version> [binary-path]}"
BINARY="${2:-app/build/bin/Bough}"
APPDIR="Bough.AppDir"
OUTPUT="Bough-${VERSION}-linux-x86_64.AppImage"

if [ ! -f "$BINARY" ]; then
    echo "Error: binary not found at $BINARY" >&2
    exit 1
fi

# Locate appimagetool.
APPIMAGETOOL="$(command -v appimagetool 2>/dev/null || echo /usr/local/bin/appimagetool)"
if [ ! -x "$APPIMAGETOOL" ]; then
    echo "Error: appimagetool not found. Install from:" >&2
    echo "  https://github.com/AppImage/AppImageKit/releases" >&2
    exit 1
fi

echo "Building AppImage for version $VERSION ..."

# ── Create AppDir skeleton ────────────────────────────────────────────────────
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# ── Copy binary ───────────────────────────────────────────────────────────────
cp "$BINARY" "$APPDIR/usr/bin/bough"
chmod +x "$APPDIR/usr/bin/bough"

# ── AppRun entry point ────────────────────────────────────────────────────────
cat > "$APPDIR/AppRun" << 'APPRUN_EOF'
#!/usr/bin/env bash
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/bough" "$@"
APPRUN_EOF
chmod +x "$APPDIR/AppRun"

# ── Desktop file ──────────────────────────────────────────────────────────────
cat > "$APPDIR/usr/share/applications/bough.desktop" << 'DESKTOP_EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Bough
GenericName=Git Client
Comment=A beautiful, fast Git GUI client
Exec=bough %u
Icon=bough
Terminal=false
Categories=Development;RevisionControl;
Keywords=git;version control;
StartupNotify=true
DESKTOP_EOF
# The .desktop file must also live at the AppDir root for AppImage compliance.
cp "$APPDIR/usr/share/applications/bough.desktop" "$APPDIR/bough.desktop"

# ── Icon ──────────────────────────────────────────────────────────────────────
ICON_SRC="app/build/appicon.png"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$APPDIR/usr/share/icons/hicolor/256x256/apps/bough.png"
    cp "$ICON_SRC" "$APPDIR/.DirIcon"
    cp "$ICON_SRC" "$APPDIR/bough.png"
else
    echo "Warning: icon not found at $ICON_SRC — AppImage will have no icon." >&2
fi

# ── Build AppImage ────────────────────────────────────────────────────────────
ARCH=x86_64 "$APPIMAGETOOL" "$APPDIR" "$OUTPUT"

echo ""
echo "Built: $OUTPUT"

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$APPDIR"
