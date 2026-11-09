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

package git

import (
	"fmt"
	"strings"
)

// CherryPickCommits applies the given commits onto the current branch without
// creating a commit (--no-commit). All changes are staged and ready to commit.
// Hashes are applied in the order given.
func (r *Repository) CherryPickCommits(hashes []string) error {
	if len(hashes) == 0 {
		return fmt.Errorf("no commits to cherry-pick")
	}
	args := append([]string{"cherry-pick", "--no-commit"}, hashes...)
	_, err := CLI(r.Path, args...)
	return err
}

// AbortCherryPick undoes a cherry-pick that was stopped due to conflicts.
// With --no-commit, git does not create CHERRY_PICK_HEAD, so the standard
// "cherry-pick --abort" is unavailable. We try it first (covers the case
// where CHERRY_PICK_HEAD does exist), then fall back to "reset --merge"
// which discards all staged/conflicted changes and restores the working tree
// to the pre-pick state without touching unrelated uncommitted changes.
func (r *Repository) AbortCherryPick() error {
	_, err := CLI(r.Path, "cherry-pick", "--abort")
	if err != nil {
		_, err = CLI(r.Path, "reset", "--merge")
	}
	return err
}

// DetectCherryPickState checks for an in-progress cherry-pick that was halted
// by conflicts. Uses "git rev-parse --verify CHERRY_PICK_HEAD" which is reliable
// across all git versions, worktree layouts, and conflict styles.
// Returns nil when no cherry-pick conflict is in progress.
func (r *Repository) DetectCherryPickState(conflictCount int) *CherryPickState {
	// git rev-parse exits 0 and prints the hash if CHERRY_PICK_HEAD exists.
	out, err := CLI(r.Path, "rev-parse", "--verify", "CHERRY_PICK_HEAD")
	if err != nil {
		return nil
	}
	hash := strings.TrimSpace(out)
	msg := ""
	if out2, err2 := CLI(r.Path, "log", "-1", "--format=%B", hash); err2 == nil {
		msg = strings.TrimRight(out2, "\n")
	}
	return &CherryPickState{ConflictCount: conflictCount, PickedMessage: msg}
}
