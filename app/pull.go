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
)

// PullForUI preserves configured pull behavior and returns a typed decision only
// when Git explicitly requires one. Legacy Pull remains available unchanged.
func (a *App) PullForUI(expectedRepo, expectedBranch string) (gitpkg.PullResult, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.PullResult{}, gitpkg.ErrNotARepo
	}
	return a.repo.PullForUI(expectedRepo, expectedBranch)
}

func (a *App) ResolvePull(snapshot gitpkg.PullSnapshot, strategy string) (gitpkg.PullResult, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.PullResult{}, gitpkg.ErrNotARepo
	}
	return a.repo.ResolvePull(snapshot, strategy)
}
