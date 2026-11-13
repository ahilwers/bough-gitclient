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

package main

import (
	gitpkg "gitmorrow/git"
)

// PullForUI preserves configured pull behavior and returns a typed decision only
// when Git explicitly requires one. Legacy Pull remains available unchanged.
func (a *App) PullForUI(expectedRepo, expectedBranch string) (gitpkg.PullResult, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.PullResult{}, gitpkg.ErrNotARepo
	}
	result, err := a.repo.PullForUI(expectedRepo, expectedBranch)
	return a.surfacePullResult(result), err
}

// surfacePullResult handles conflicts returned as successful IPC results rather
// than errors. Strategy-choice probes never enter this path.
func (a *App) surfacePullResult(result gitpkg.PullResult) gitpkg.PullResult {
	if result.Outcome == "conflict" && result.Failure != nil {
		// Carry Git's message with the result; the toast shows it as it is.
		result.Detail = result.Failure.Error()
	}
	result.Failure = nil
	return result
}

func (a *App) ResolvePull(snapshot gitpkg.PullSnapshot, strategy string) (gitpkg.PullResult, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.PullResult{}, gitpkg.ErrNotARepo
	}
	result, err := a.repo.ResolvePull(snapshot, strategy)
	return a.surfacePullResult(result), err
}
