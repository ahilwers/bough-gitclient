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

type stashTreeEntry struct {
	mode string
	kind string
	hash string
}

// stashFileEntry resolves one literal path, without allowing a directory
// pathspec to select its descendants.
func (r *Repository) stashFileEntry(tree, filePath, pathspec string) (stashTreeEntry, bool, error) {
	out, err := CLI(r.Path, "ls-tree", "-r", "-z", "--full-tree", tree, "--", pathspec)
	if err != nil {
		return stashTreeEntry{}, false, err
	}
	for _, line := range strings.Split(out, "\x00") {
		metadata, name, ok := strings.Cut(line, "\t")
		if !ok || name != filePath {
			continue
		}
		fields := strings.Fields(metadata)
		if len(fields) != 3 {
			return stashTreeEntry{}, false, fmt.Errorf("invalid stash tree entry for %q", filePath)
		}
		return stashTreeEntry{mode: fields[0], kind: fields[1], hash: fields[2]}, true, nil
	}
	return stashTreeEntry{}, false, nil
}

// restoreUntrackedStashFile is called only when the path is absent from the
// stash's tracked tree. Never overwrite or stage a current file: an exclusive
// create also protects against a concurrent writer.
func (r *Repository) restoreUntrackedStashFile(ref, filePath, pathspec string) error {
	notFound := fmt.Errorf("file %q not found in stash", filePath)
	parents, err := CLI(r.Path, "rev-list", "--parents", "-n", "1", ref)
	if err != nil {
		return err
	}
	fields := strings.Fields(parents)
	if len(fields) < 4 {
		return notFound // This stash has no untracked-files parent.
	}
	entry, found, err := r.stashFileEntry(fields[3], filePath, pathspec)
	if err != nil {
		return err
	}
	if !found || entry.kind != "blob" {
		return notFound
	}
	if entry.mode != "100644" && entry.mode != "100755" && entry.mode != "120000" {
		return fmt.Errorf("unsupported untracked stash file mode %q", entry.mode)
	}
	indexed, err := CLI(r.Path, "ls-files", "-z", "--", pathspec)
	if err != nil {
		return err
	}
	if indexed != "" {
		return fmt.Errorf("cannot restore untracked stash file %q: path is tracked in the index", filePath)
	}
	content, err := CLI(r.Path, "cat-file", "blob", entry.hash)
	if err != nil {
		return err
	}
	root, err := os.OpenRoot(r.Path)
	if err != nil {
		return err
	}
	defer root.Close()

	localPath := filepath.FromSlash(filePath)
	// Do not write through existing symlink directories. Root also prevents
	// traversal outside the repository if a directory is changed concurrently.
	parent := filepath.Dir(localPath)
	part := ""
	if parent != "." {
		for _, component := range strings.Split(parent, string(filepath.Separator)) {
			part = filepath.Join(part, component)
			info, statErr := root.Lstat(part)
			if os.IsNotExist(statErr) {
				break
			}
			if statErr != nil {
				return statErr
			}
			if info.Mode()&os.ModeSymlink != 0 {
				return fmt.Errorf("cannot restore %q through symlink directory %q", filePath, part)
			}
		}
	}
	if err := root.MkdirAll(parent, 0755); err != nil {
		return err
	}
	if entry.mode == "120000" {
		return root.Symlink(content, localPath)
	}
	mode := os.FileMode(0644)
	if entry.mode == "100755" {
		mode = 0755
	}
	file, err := root.OpenFile(localPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if err != nil {
		return fmt.Errorf("cannot restore untracked stash file %q: %w", filePath, err)
	}
	_, writeErr := file.WriteString(content)
	closeErr := file.Close()
	if writeErr != nil || closeErr != nil {
		_ = root.Remove(localPath)
		if writeErr != nil {
			return writeErr
		}
		return closeErr
	}
	return nil
}
