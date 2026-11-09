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

# generate_keys.sh — Generate an EdDSA keypair for signing Sparkle update artifacts.
#
# Usage:
#   ./scripts/generate_keys.sh [output-directory]
#
# Output files:
#   sparkle_key      — Ed25519 private key (KEEP SECRET, store in GitHub Secrets)
#   sparkle_key.pub  — Ed25519 public key  (embed in app Info.plist as SUPublicEDKey)
#
# The public key in base64 form should replace REPLACE_WITH_EDDSA_PUBLIC_KEY in
# app/build/darwin/Info.plist and be added to .github/workflows/release.yml as the
# SPARKLE_PUBLIC_KEY secret.
set -euo pipefail

KEYS_DIR="${1:-.}"
PRIVATE_KEY="$KEYS_DIR/sparkle_key"
PUBLIC_KEY="$KEYS_DIR/sparkle_key.pub"

if [ -f "$PRIVATE_KEY" ]; then
    echo "Error: $PRIVATE_KEY already exists. Remove it first to regenerate." >&2
    exit 1
fi

echo "Generating EdDSA keypair in $KEYS_DIR ..."
openssl genpkey -algorithm ed25519 -out "$PRIVATE_KEY"
openssl pkey -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"

# Extract the raw 32-byte public key and encode as base64 for the plist.
# openssl outputs the DER-encoded SubjectPublicKeyInfo; the last 32 bytes are
# the raw Ed25519 public key.  We use a Python one-liner that is available on
# every macOS system without additional dependencies.
RAW_PUBKEY=$(python3 -c "
import base64, sys
data = open('$PUBLIC_KEY', 'rb').read()
# Strip PEM header/footer and decode DER
b64 = ''.join(data.decode().strip().splitlines()[1:-1])
der = base64.b64decode(b64)
# Last 32 bytes are the raw Ed25519 key
print(base64.b64encode(der[-32:]).decode())
")

echo ""
echo "Done."
echo ""
echo "Public key (base64 — put this in Info.plist SUPublicEDKey and SPARKLE_PUBLIC_KEY secret):"
echo "$RAW_PUBKEY"
echo ""
echo "Private key file: $PRIVATE_KEY"
echo "  → Add its contents as the SPARKLE_PRIVATE_KEY GitHub Actions secret."
echo "  → Add $PRIVATE_KEY to .gitignore NOW."
