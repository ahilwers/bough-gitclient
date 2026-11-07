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

package git

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// StageFiles stages multiple files in a single `git add` invocation, avoiding
// concurrent index.lock contention that occurs when staging files individually.
func (r *Repository) StageFiles(filePaths []string) error {
	args := append([]string{"add", "--"}, filePaths...)
	_, err := CLI(r.Path, args...)
	return err
}

// UnstageFiles unstages multiple files in a single `git restore --staged` call.
func (r *Repository) UnstageFiles(filePaths []string) error {
	args := append([]string{"restore", "--staged", "--"}, filePaths...)
	_, err := CLI(r.Path, args...)
	return err
}

// StageFile stages an entire file or directory (equivalent to `git add <path>`).
// Uses CLI instead of go-git to avoid go-git's path.Clean panic and to support
// concurrent calls safely (each CLI call is an independent process).
func (r *Repository) StageFile(filePath string) error {
	_, err := CLI(r.Path, "add", "--", filePath)
	return err
}

// UnstageFile unstages an entire file (equivalent to `git restore --staged <file>`).
func (r *Repository) UnstageFile(filePath string) error {
	_, err := CLI(r.Path, "restore", "--staged", "--", filePath)
	return err
}

// StageHunkViaApply stages a single hunk by piping a patch to `git apply --cached`.
// hunkPatch must be a valid unified diff patch string for exactly one hunk.
func (r *Repository) StageHunkViaApply(hunkPatch string) error {
	cmd := execGit(r.Path, "apply", "--cached", "--unidiff-zero", "-")
	cmd.Stdin = strings.NewReader(hunkPatch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply: %w\n%s", err, string(out))
	}
	return nil
}

// UnstageHunkViaApply unstages a single hunk from the index by reversing the patch.
// hunkPatch must be a valid unified diff patch string for exactly one hunk (staged diff).
func (r *Repository) UnstageHunkViaApply(hunkPatch string) error {
	cmd := execGit(r.Path, "apply", "--cached", "-R", "--unidiff-zero", "-")
	cmd.Stdin = strings.NewReader(hunkPatch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply --cached -R: %w\n%s", err, string(out))
	}
	return nil
}

// DiscardFile discards all unstaged changes to a tracked file (irreversible).
// For tracked files: git restore. For files unknown to git (new, untracked):
// falls back to deleting the file from disk.
func (r *Repository) DiscardFile(filePath string) error {
	_, err := CLI(r.Path, "restore", "--", filePath)
	if err != nil {
		// File is not known to git — delete it directly.
		return os.Remove(filepath.Join(r.Path, filePath))
	}
	return nil
}

// DiscardStagedFile reverts a staged file back to its HEAD state, discarding
// both the staged changes and any unstaged changes in the working tree.
// For files that exist in HEAD: git restore --staged --worktree.
// For newly added files (not yet in HEAD): unstage via git rm --cached, then
// delete from disk.
func (r *Repository) DiscardStagedFile(filePath string) error {
	_, err := CLI(r.Path, "restore", "--staged", "--worktree", "--", filePath)
	if err != nil {
		// File is not in HEAD (newly added) — remove from index and delete.
		CLI(r.Path, "rm", "--cached", "--", filePath) //nolint:errcheck
		return os.Remove(filepath.Join(r.Path, filePath))
	}
	return nil
}

// DiscardHunk discards a hunk from the working tree (irreversible).
// Uses `git apply -R` (reverse) to undo changes in the worktree.
func (r *Repository) DiscardHunk(hunkPatch string) error {
	cmd := execGit(r.Path, "apply", "-R", "--unidiff-zero", "-")
	cmd.Stdin = strings.NewReader(hunkPatch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply -R: %w\n%s", err, string(out))
	}
	return nil
}

// CreateCommit creates a commit with the given message.
// Returns the full 40-character commit hash.
func (r *Repository) CreateCommit(message string) (string, error) {
	// When a merge is in progress (MERGE_HEAD exists), go-git's wt.Commit()
	// incorrectly reports "clean working tree" and cannot create the two-parent
	// merge commit. Use the git CLI instead, which handles MERGE_HEAD correctly.
	if _, err := os.Stat(filepath.Join(r.Path, ".git", "MERGE_HEAD")); err == nil {
		out, err := CLI(r.Path, "commit", "-m", message)
		if err != nil {
			return "", err
		}
		// Parse the commit hash from "master abc1234] …" output line
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "[") {
				// format: "[branch abc1234] message"
				if start := strings.Index(line, " "); start >= 0 {
					rest := line[start+1:]
					if end := strings.IndexAny(rest, "] "); end >= 0 {
						return rest[:end], nil
					}
				}
			}
		}
		return "", nil // hash not critical — caller only uses it for display
	}

	wt, err := r.repo.Worktree()
	if err != nil {
		return "", err
	}
	// Try local config first (covers test repos), then fall back to global.
	name, email := "", ""
	if localCfg, err := r.repo.ConfigScoped(config.LocalScope); err == nil {
		name = localCfg.User.Name
		email = localCfg.User.Email
	}
	if name == "" || email == "" {
		if globalCfg, err := r.repo.ConfigScoped(config.GlobalScope); err == nil {
			if name == "" {
				name = globalCfg.User.Name
			}
			if email == "" {
				email = globalCfg.User.Email
			}
		}
	}
	author := object.Signature{
		Name:  name,
		Email: email,
		When:  time.Now(),
	}
	hash, err := wt.Commit(message, &gogit.CommitOptions{
		Author:    &author,
		Committer: &author,
	})
	if err != nil {
		return "", err
	}
	return hash.String(), nil
}

// AmendCommit amends the last commit with the staged changes and new message.
func (r *Repository) AmendCommit(message string) error {
	args := []string{"commit", "--amend", "--no-edit"}
	if message != "" {
		args = append(args, "-m", message)
	}
	_, err := CLI(r.Path, args...)
	return err
}
