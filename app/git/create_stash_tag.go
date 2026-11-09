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
	"encoding/hex"
	"fmt"
	"strings"
)

// CreateStash saves the working tree and index, optionally including untracked files.
func (r *Repository) CreateStash(message string, includeUntracked bool) error {
	args := []string{"stash", "push"}
	if includeUntracked {
		args = append(args, "--include-untracked")
	}
	if message != "" {
		// Keep messages beginning with '-' as option values, not options.
		args = append(args, "--message="+message)
	}
	// Compare the visible stash reflog, not just Git's exit status: Git exits
	// successfully both for no changes and when no new entry is recorded.
	before, err := CLI(r.Path, "stash", "list", "--format=%H")
	if err != nil {
		return err
	}
	// Git returns success for a no-op. Force its diagnostic to English so we
	// can detect that case even if another process changes the stash reflog.
	out, err := cliWithEnv(r.Path, []string{"LC_ALL=C", "LANG=C", "LANGUAGE=C"}, args...)
	if err != nil {
		return err
	}
	if strings.TrimSpace(out) == "No local changes to save" {
		return fmt.Errorf("no new stash entry created (no changes to stash)")
	}
	after, err := CLI(r.Path, "stash", "list", "--format=%H")
	if err != nil {
		return err
	}
	if before == after {
		return fmt.Errorf("no new stash entry created (no changes, or an identical stash already exists)")
	}
	return nil
}

// CreateTag creates a lightweight tag at the explicitly supplied target.
func (r *Repository) CreateTag(name, target string) error {
	// CLI omits empty arguments, so reject them rather than letting git default
	// the target to HEAD or interpret the target as the tag name.
	if name == "" || target == "" {
		return fmt.Errorf("tag name and target are required")
	}
	format, err := CLI(r.Path, "rev-parse", "--show-object-format")
	if err != nil {
		return err
	}
	var hashLength int
	switch strings.TrimSpace(format) {
	case "sha1":
		hashLength = 40
	case "sha256":
		hashLength = 64
	default:
		return fmt.Errorf("unsupported repository object format %q", strings.TrimSpace(format))
	}
	if len(target) != hashLength {
		return fmt.Errorf("tag target must be a full commit hash")
	}
	if _, err := hex.DecodeString(target); err != nil {
		return fmt.Errorf("tag target must be a full commit hash")
	}
	kind, err := CLI(r.Path, "--no-replace-objects", "cat-file", "-t", target)
	if err != nil {
		return err
	}
	if strings.TrimSpace(kind) != "commit" {
		return fmt.Errorf("tag target must be a commit, got %s", strings.TrimSpace(kind))
	}
	// Ignore tag.gpgSign to guarantee a lightweight tag; -- prevents either
	// user-supplied argument from being interpreted as a git option.
	_, err = CLI(r.Path, "-c", "tag.gpgSign=false", "tag", "--", name, target)
	return err
}
