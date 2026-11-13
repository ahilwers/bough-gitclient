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
	"os"
	"path/filepath"
	"strings"
)

// literalEnv disables pathspec globbing and character ranges for every pathspec
// of one Git call. File names come from the working tree and may contain
// characters that Git would otherwise interpret as wildcards, so a selected
// file named "a*b.txt" must not match every file whose name starts with "a".
var literalEnv = []string{"GIT_LITERAL_PATHSPECS=1"}

// trackedPaths returns the subset of filePaths that Git knows in the index.
// Paths are matched literally and relative to the worktree root, exactly like
// the paths Git reports in the status output.
func (r *Repository) trackedPaths(filePaths []string) (map[string]bool, error) {
	tracked := map[string]bool{}
	if len(filePaths) == 0 {
		return tracked, nil
	}
	out, err := cliWithEnv(r.Path, literalEnv, append([]string{"ls-files", "-z", "--"}, filePaths...)...)
	if err != nil {
		return nil, err
	}
	for _, path := range strings.Split(out, "\x00") {
		if path != "" {
			tracked[path] = true
		}
	}
	return tracked, nil
}

// unmergedPaths returns the subset of filePaths that has unresolved merge
// conflicts. Git refuses to restore the working tree of such a path, and the
// refusal applies to the whole batch, so they are detected up front.
func (r *Repository) unmergedPaths(filePaths []string) (map[string]bool, error) {
	unmerged := map[string]bool{}
	if len(filePaths) == 0 {
		return unmerged, nil
	}
	out, err := cliWithEnv(r.Path, literalEnv, append([]string{"ls-files", "-u", "-z", "--"}, filePaths...)...)
	if err != nil {
		return nil, err
	}
	for _, entry := range strings.Split(out, "\x00") {
		if entry == "" {
			continue
		}
		// Entries look like "<mode> <sha> <stage>\t<path>".
		if tab := strings.IndexByte(entry, '\t'); tab >= 0 {
			unmerged[entry[tab+1:]] = true
		}
	}
	return unmerged, nil
}

// headPaths returns the subset of filePaths that exists in the HEAD commit.
// An unborn HEAD (a repository without commits) yields an empty set.
func (r *Repository) headPaths(filePaths []string) (map[string]bool, error) {
	inHead := map[string]bool{}
	if len(filePaths) == 0 {
		return inHead, nil
	}
	if _, err := CLI(r.Path, "rev-parse", "--verify", "--quiet", "HEAD"); err != nil {
		// No commit yet: nothing is in HEAD.
		return inHead, nil
	}
	out, err := cliWithEnv(r.Path, literalEnv, append([]string{"ls-tree", "-r", "--name-only", "-z", "HEAD", "--"}, filePaths...)...)
	if err != nil {
		return nil, err
	}
	for _, path := range strings.Split(out, "\x00") {
		if path != "" {
			inHead[path] = true
		}
	}
	return inHead, nil
}

// removeFilesFromDisk deletes the given paths from the working tree. Files
// that are already gone are not an error.
func (r *Repository) removeFilesFromDisk(filePaths []string) error {
	for _, path := range filePaths {
		if err := os.Remove(filepath.Join(r.Path, path)); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("could not delete %q: %w", path, err)
		}
	}
	return nil
}

// DiscardFiles discards the unstaged changes of several files at once.
// Tracked files are restored from the index in a single Git call, mirroring
// DiscardFile. Untracked files are rejected instead of being deleted from
// disk: deleting files is not part of discarding a change, and the single-file
// path never offered it either.
func (r *Repository) DiscardFiles(filePaths []string) error {
	if len(filePaths) == 0 {
		return nil
	}
	tracked, err := r.trackedPaths(filePaths)
	if err != nil {
		return err
	}
	var restore []string
	for _, path := range filePaths {
		if !tracked[path] {
			return fmt.Errorf("%q is not tracked by Git", path)
		}
		restore = append(restore, path)
	}
	unmerged, err := r.unmergedPaths(filePaths)
	if err != nil {
		return err
	}
	for _, path := range filePaths {
		if unmerged[path] {
			return fmt.Errorf("%q has unresolved conflicts", path)
		}
	}
	args := append([]string{"restore", "--"}, restore...)
	_, err = cliWithEnv(r.Path, literalEnv, args...)
	return err
}

// DiscardStagedFiles reverts several staged files to their HEAD state at
// once, discarding staged and unstaged changes alike. Files that exist in HEAD
// are restored from it; files that were only added are removed from the index
// and deleted from disk, mirroring DiscardStagedFile.
func (r *Repository) DiscardStagedFiles(filePaths []string) error {
	if len(filePaths) == 0 {
		return nil
	}
	inHead, err := r.headPaths(filePaths)
	if err != nil {
		return err
	}
	tracked, err := r.trackedPaths(filePaths)
	if err != nil {
		return err
	}
	var restore []string
	var unstage []string
	var remove []string
	for _, path := range filePaths {
		switch {
		case inHead[path]:
			restore = append(restore, path)
		case tracked[path]:
			unstage = append(unstage, path)
		default:
			remove = append(remove, path)
		}
	}
	if len(restore) > 0 {
		args := append([]string{"restore", "--staged", "--worktree", "--"}, restore...)
		if _, err := cliWithEnv(r.Path, literalEnv, args...); err != nil {
			return err
		}
	}
	if len(unstage) > 0 {
		args := append([]string{"rm", "--cached", "-f", "--"}, unstage...)
		if _, err := cliWithEnv(r.Path, literalEnv, args...); err != nil {
			return err
		}
	}
	// Files that were only added to the index are removed from disk as well,
	// mirroring DiscardStagedFile.
	return r.removeFilesFromDisk(append(unstage, remove...))
}
