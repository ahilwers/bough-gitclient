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

# generate_appcast.sh — Build the Sparkle-compatible appcast.xml for a release.
#
# Usage:
#   ./scripts/generate_appcast.sh <version-tag>
#
# Environment variables:
#   GITHUB_REPOSITORY  — owner/repo (e.g. achim/bough) — set automatically in Actions
#   SPARKLE_PRIVATE_KEY — Ed25519 private key PEM (required for macOS signatures)
#
# Output:
#   appcast/appcast.xml  — deploy this to https://updates.bough.app/
#
# The script fetches release metadata from the GitHub API and computes file
# sizes + signatures for each artifact.
set -euo pipefail

VERSION="${1:?Usage: generate_appcast.sh <version-tag>}"
REPO="${GITHUB_REPOSITORY:-achim/bough}"
REPO_OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
RELEASE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Generating appcast for $VERSION (repo: $REPO) ..."

mkdir -p appcast

# ── Fetch release metadata ────────────────────────────────────────────────────
RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${VERSION}")
PUB_DATE=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json, email.utils, datetime
d = json.load(sys.stdin)
dt = datetime.datetime.fromisoformat(d['published_at'].replace('Z', '+00:00'))
print(email.utils.format_datetime(dt))
")
RELEASE_NOTES=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json, html
d = json.load(sys.stdin)
print(html.escape(d.get('body', '') or ''))
" | head -100)

# ── Helper: get remote file size ──────────────────────────────────────────────
artifact_size() {
    local url="$1"
    curl -fsI "$url" | grep -i content-length | awk '{print $2}' | tr -d '\r' || echo "0"
}

# ── Helper: sign an artifact (returns base64 signature or empty) ──────────────
sign_artifact() {
    local name="$1"
    if [ -n "${SPARKLE_PRIVATE_KEY:-}" ]; then
        bash "$SCRIPT_DIR/sign_update.sh" "$name" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# ── macOS Intel ───────────────────────────────────────────────────────────────
MAC_INTEL_NAME="Bough-${VERSION}-macos-intel.dmg"
MAC_INTEL_URL="${RELEASE_URL}/${MAC_INTEL_NAME}"
MAC_INTEL_SIZE=$(artifact_size "$MAC_INTEL_URL")
MAC_INTEL_SIG=$(sign_artifact "$MAC_INTEL_NAME")

# ── macOS ARM64 ───────────────────────────────────────────────────────────────
MAC_ARM_NAME="Bough-${VERSION}-macos-arm64.dmg"
MAC_ARM_URL="${RELEASE_URL}/${MAC_ARM_NAME}"
MAC_ARM_SIZE=$(artifact_size "$MAC_ARM_URL")
MAC_ARM_SIG=$(sign_artifact "$MAC_ARM_NAME")

# ── Windows ───────────────────────────────────────────────────────────────────
WIN_NAME="Bough-${VERSION}-windows-x64.exe"
WIN_URL="${RELEASE_URL}/${WIN_NAME}"
WIN_SIZE=$(artifact_size "$WIN_URL")

# ── Linux AppImage ────────────────────────────────────────────────────────────
LINUX_NAME="Bough-${VERSION}-linux-x86_64.AppImage"
LINUX_URL="${RELEASE_URL}/${LINUX_NAME}"
LINUX_SIZE=$(artifact_size "$LINUX_URL")

# ── Write appcast.xml ─────────────────────────────────────────────────────────
cat > appcast/appcast.xml << APPCAST_EOF
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Bough Updates</title>
    <link>https://github.com/${REPO_OWNER}/${REPO_NAME}</link>
    <description>Bough Git GUI client release notes</description>
    <language>en</language>

    <!-- macOS Intel (x86_64) -->
    <item>
      <title>Version ${VERSION}</title>
      <description><![CDATA[${RELEASE_NOTES}]]></description>
      <pubDate>${PUB_DATE}</pubDate>
      <enclosure
        url="${MAC_INTEL_URL}"
        sparkle:version="${VERSION#v}"
        sparkle:shortVersionString="${VERSION#v}"
        sparkle:edSignature="${MAC_INTEL_SIG}"
        length="${MAC_INTEL_SIZE}"
        type="application/x-apple-diskimage" />
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
      <sparkle:tags><sparkle:criticalUpdate/></sparkle:tags>
    </item>

    <!-- macOS Apple Silicon (arm64) -->
    <item>
      <title>Version ${VERSION} (Apple Silicon)</title>
      <description><![CDATA[${RELEASE_NOTES}]]></description>
      <pubDate>${PUB_DATE}</pubDate>
      <enclosure
        url="${MAC_ARM_URL}"
        sparkle:version="${VERSION#v}"
        sparkle:shortVersionString="${VERSION#v}"
        sparkle:edSignature="${MAC_ARM_SIG}"
        length="${MAC_ARM_SIZE}"
        type="application/x-apple-diskimage" />
      <sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
    </item>

    <!-- Windows (x64 NSIS installer) -->
    <item>
      <title>Version ${VERSION}</title>
      <pubDate>${PUB_DATE}</pubDate>
      <enclosure
        url="${WIN_URL}"
        sparkle:version="${VERSION#v}"
        sparkle:shortVersionString="${VERSION#v}"
        length="${WIN_SIZE}"
        type="application/octet-stream" />
    </item>

    <!-- Linux (AppImage) -->
    <item>
      <title>Version ${VERSION}</title>
      <pubDate>${PUB_DATE}</pubDate>
      <enclosure
        url="${LINUX_URL}"
        sparkle:version="${VERSION#v}"
        sparkle:shortVersionString="${VERSION#v}"
        length="${LINUX_SIZE}"
        type="application/octet-stream" />
    </item>

  </channel>
</rss>
APPCAST_EOF

echo "Generated appcast/appcast.xml"
echo "  Deploy to https://updates.bough.app/"
