// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

//go:build !darwin || !liquidglass || !private_mac_apis

package main

import "github.com/wailsapp/wails/v3/pkg/application"

// applyLiquidGlassWindow is a no-op in builds that do not opt into the native
// macOS Liquid Glass backdrop (`-tags liquidglass` on darwin).
func applyLiquidGlassWindow(_ *application.WebviewWindowOptions) {}
