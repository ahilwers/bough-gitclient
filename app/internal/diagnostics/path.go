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

package diagnostics

import "path/filepath"

// Directory never falls back to a different Windows directory when LOCALAPPDATA
// is unavailable. An empty result disables logging without stopping the app.
func Directory(platform, home, state, local string) string {
	switch platform {
	case "windows":
		if !filepath.IsAbs(local) {
			return ""
		}
		return filepath.Join(local, "GitMorrow", "Logs")
	case "darwin":
		if !filepath.IsAbs(home) {
			return ""
		}
		return filepath.Join(home, "Library", "Logs", "GitMorrow")
	default:
		if !filepath.IsAbs(state) {
			if !filepath.IsAbs(home) {
				return ""
			}
			state = filepath.Join(home, ".local", "state")
		}
		return filepath.Join(state, "gitmorrow", "logs")
	}
}
