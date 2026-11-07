// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

package main

import (
	gitpkg "bough/git"
	"testing"
)

func TestPullIPCRejectsMissingRepository(t *testing.T) {
	app := NewApp()
	if _, err := app.PullForUI("/missing", "main"); err == nil {
		t.Fatal("accepted missing repo")
	}
	if _, err := app.ResolvePull(gitpkg.PullSnapshot{}, "merge"); err == nil {
		t.Fatal("accepted missing repo")
	}
}
