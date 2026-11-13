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

package git_test

import (
	"os"
	"path/filepath"
	"testing"

	"gitmorrow/git"
)

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func fileExists(t *testing.T, dir, name string) bool {
	t.Helper()
	_, err := os.Stat(filepath.Join(dir, name))
	return err == nil
}

// Discarding several files at once must leave unrelated files untouched.
func TestDiscardFilesRestoresOnlyTheGivenFiles(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	addCommit(t, dir, "keep.txt", "keep\n", "keep")
	addCommit(t, dir, "drop.txt", "drop\n", "drop")
	addCommit(t, dir, "drop2.txt", "drop2\n", "drop2")
	addCommit(t, dir, "other.txt", "other\n", "other")

	writeFile(t, dir, "drop.txt", "changed\n")
	writeFile(t, dir, "drop2.txt", "changed\n")
	writeFile(t, dir, "other.txt", "changed\n")

	if err := repo.DiscardFiles([]string{"drop.txt", "drop2.txt"}); err != nil {
		t.Fatalf("DiscardFiles: %v", err)
	}

	if got := statusGit(t, dir, "status", "--porcelain"); got != "M other.txt" {
		t.Fatalf("status after discard = %q, want only other.txt modified", got)
	}
	if got := statusGit(t, dir, "show", "HEAD:drop.txt"); got != "drop" {
		t.Errorf("drop.txt content = %q, want the committed content", got)
	}
	if got := statusGit(t, dir, "show", "HEAD:drop2.txt"); got != "drop2" {
		t.Errorf("drop2.txt content = %q, want the committed content", got)
	}
}

// Untracked files are not changes that can be discarded, so a bulk discard must
// refuse them instead of deleting them from disk.
func TestDiscardFilesRejectsUntrackedFiles(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	addCommit(t, dir, "tracked.txt", "tracked\n", "tracked")
	writeFile(t, dir, "tracked.txt", "changed\n")
	writeFile(t, dir, "untracked.txt", "new\n")

	if err := repo.DiscardFiles([]string{"tracked.txt", "untracked.txt"}); err == nil {
		t.Fatal("accepted an untracked file")
	}
	if !fileExists(t, dir, "untracked.txt") {
		t.Error("untracked file was deleted from disk")
	}
	// The rejected batch must not have discarded anything either.
	if got := statusGit(t, dir, "status", "--porcelain"); got != "M tracked.txt\n?? untracked.txt" {
		t.Fatalf("status after rejected discard = %q, want only tracked.txt modified", got)
	}
}

// A file name containing glob characters must not match other files.
func TestDiscardFilesTreatsPathsLiterally(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	addCommit(t, dir, "a*b.txt", "star\n", "star file")
	addCommit(t, dir, "axxb.txt", "other\n", "other file")

	writeFile(t, dir, "a*b.txt", "changed\n")
	writeFile(t, dir, "axxb.txt", "changed\n")

	if err := repo.DiscardFiles([]string{"a*b.txt"}); err != nil {
		t.Fatalf("DiscardFiles: %v", err)
	}

	if got := statusGit(t, dir, "status", "--porcelain"); got != "M axxb.txt" {
		t.Fatalf("status after discard = %q, want only axxb.txt modified", got)
	}
}

// Discarding staged files resets them to HEAD, including files that were only
// added (which are removed from the index and from disk).
func TestDiscardStagedFilesResetsToHead(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	addCommit(t, dir, "tracked.txt", "tracked\n", "tracked")

	writeFile(t, dir, "tracked.txt", "staged\n")
	writeFile(t, dir, "added.txt", "added\n")
	if err := repo.StageFiles([]string{"tracked.txt", "added.txt"}); err != nil {
		t.Fatal(err)
	}
	writeFile(t, dir, "added.txt", "added and modified\n")

	if err := repo.DiscardStagedFiles([]string{"tracked.txt", "added.txt"}); err != nil {
		t.Fatalf("DiscardStagedFiles: %v", err)
	}

	if got := statusGit(t, dir, "status", "--porcelain"); got != "" {
		t.Fatalf("status after discard = %q, want a clean tree", got)
	}
	if got := statusGit(t, dir, "show", "HEAD:tracked.txt"); got != "tracked" {
		t.Errorf("tracked.txt content = %q, want the committed content", got)
	}
	if fileExists(t, dir, "added.txt") {
		t.Error("added file was not deleted from disk")
	}
}

// Discarding staged files must not touch files that were not selected.
func TestDiscardStagedFilesKeepsOtherStagedFiles(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	addCommit(t, dir, "one.txt", "one\n", "one")
	addCommit(t, dir, "two.txt", "two\n", "two")

	writeFile(t, dir, "one.txt", "changed\n")
	writeFile(t, dir, "two.txt", "changed\n")
	if err := repo.StageFiles([]string{"one.txt", "two.txt"}); err != nil {
		t.Fatal(err)
	}

	if err := repo.DiscardStagedFiles([]string{"one.txt"}); err != nil {
		t.Fatalf("DiscardStagedFiles: %v", err)
	}

	if got := statusGit(t, dir, "status", "--porcelain"); got != "M  two.txt" {
		t.Fatalf("status after discard = %q, want only two.txt staged", got)
	}
}

// Bulk discard works on a repository without any commit.
func TestDiscardFilesWithoutCommits(t *testing.T) {
	dir := t.TempDir()
	statusGit(t, dir, "init")
	statusGit(t, dir, "config", "user.email", "test@example.com")
	statusGit(t, dir, "config", "user.name", "Test User")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, dir, "only.txt", "content\n")

	// Without a commit there is nothing to restore, so only untracked files
	// exist — and those are rejected rather than deleted.
	if err := repo.DiscardFiles([]string{"only.txt"}); err == nil {
		t.Fatal("accepted an untracked file in a repository without commits")
	}
	if !fileExists(t, dir, "only.txt") {
		t.Error("untracked file was deleted in a repository without commits")
	}
}
