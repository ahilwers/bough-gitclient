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

// CreateStash saves the current worktree changes in a new stash.
func (a *App) CreateStash(message string, includeUntracked bool) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CreateStash(message, includeUntracked); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

// CreateTag creates a lightweight tag at target.
func (a *App) CreateTag(name string, target string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CreateTag(name, target); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}
