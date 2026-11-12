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

import (
	"path/filepath"
	"testing"
)

func TestPlatformLogDirectories(t *testing.T) {
	home := t.TempDir()
	state := filepath.Join(home, "state")
	local := filepath.Join(home, "local")
	for _, test := range []struct{ platform, state, local, want string }{
		{"linux", "relative", "", filepath.Join(home, ".local", "state", "gitmorrow", "logs")},
		{"linux", state, "", filepath.Join(state, "gitmorrow", "logs")},
		{"darwin", "/state", "", filepath.Join(home, "Library", "Logs", "GitMorrow")},
		{"windows", "", local, filepath.Join(local, "GitMorrow", "Logs")},
		{"windows", "", "", ""},
	} {
		if got := Directory(test.platform, home, test.state, test.local); got != test.want {
			t.Errorf("%+v: %s", test, got)
		}
	}
}
