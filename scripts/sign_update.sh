#!/usr/bin/env bash
# Copyright (C) 2026 Achim Hilwers
#
# This file is part of GitMorrow.
#
# GitMorrow is free software: you can redistribute it and/or modify it under the
# terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version. See the LICENSE file in the repository root for details.
#
# SPDX-License-Identifier: GPL-3.0-or-later

# sign_update.sh — Sign a release artifact with the EdDSA private key.
#
# Usage:
#   ./scripts/sign_update.sh <artifact-path> [keys-directory]
#
# Prints the base64-encoded EdDSA signature to stdout.
# Intended to be called by generate_appcast.sh and the GitHub Actions release workflow.
#
# The private key is read from:
#   1. $SPARKLE_PRIVATE_KEY environment variable (GitHub Actions secret)
#   2. <keys-directory>/sparkle_key file (local development)
set -euo pipefail

ARTIFACT="${1:?Usage: sign_update.sh <artifact-path> [keys-directory]}"
KEYS_DIR="${2:-.}"
PRIVATE_KEY_FILE="$KEYS_DIR/sparkle_key"
TMP_KEY=""

# Prefer the environment variable (CI) over a key file (local dev).
if [ -n "${SPARKLE_PRIVATE_KEY:-}" ]; then
    TMP_KEY="$(mktemp)"
    echo "$SPARKLE_PRIVATE_KEY" > "$TMP_KEY"
    PRIVATE_KEY_FILE="$TMP_KEY"
fi

cleanup() {
    [ -n "$TMP_KEY" ] && rm -f "$TMP_KEY"
}
trap cleanup EXIT

if [ ! -f "$PRIVATE_KEY_FILE" ]; then
    echo "Error: private key not found at $PRIVATE_KEY_FILE" >&2
    echo "  Set SPARKLE_PRIVATE_KEY env var or provide a keys directory." >&2
    exit 1
fi

if [ ! -f "$ARTIFACT" ]; then
    echo "Error: artifact not found: $ARTIFACT" >&2
    exit 1
fi

# Compute the Ed25519 signature and encode it as base64.
openssl dgst -sign "$PRIVATE_KEY_FILE" -binary "$ARTIFACT" | base64 | tr -d '\n'
