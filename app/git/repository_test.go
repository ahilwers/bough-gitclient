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

package git_test

import (
	"os"
	"path/filepath"
	"testing"

	"bough/git"
)

func TestOpen(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if repo.Path == "" {
		t.Fatal("repo.Path is empty")
	}
}

func TestOpen_DetectsDotGit(t *testing.T) {
	// Open should walk up and find the repo when given a subdirectory
	dir := initRepo(t)
	sub := filepath.Join(dir, "sub")
	if err := os.MkdirAll(sub, 0755); err != nil {
		t.Fatal(err)
	}
	repo, err := git.Open(sub)
	if err != nil {
		t.Fatalf("Open from subdirectory: %v", err)
	}
	// go-git resolves symlinks in the worktree root (e.g. /var -> /private/var
	// on macOS). Compare directory identity rather than path spelling.
	want, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.Stat(repo.Path)
	if err != nil {
		t.Fatal(err)
	}
	if !os.SameFile(got, want) {
		t.Errorf("Path = %q, want the repository at %q", repo.Path, dir)
	}
}

func TestOpen_NotARepo(t *testing.T) {
	_, err := git.Open(t.TempDir())
	if err != git.ErrNotARepo {
		t.Errorf("expected ErrNotARepo, got %v", err)
	}
}

func TestCurrentBranch(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	branch, err := repo.CurrentBranch()
	if err != nil {
		t.Fatalf("CurrentBranch: %v", err)
	}
	if branch == "" {
		t.Error("branch name is empty")
	}
}

func TestStatus_CleanRepo(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	status, err := repo.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if status.Branch == "" {
		t.Error("branch is empty")
	}
	if len(status.Files) != 0 {
		t.Errorf("expected clean working tree, got %d file(s)", len(status.Files))
	}
}

func TestStatus_UntrackedFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	status, err := repo.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if len(status.Files) == 0 {
		t.Fatal("expected at least one file in dirty status")
	}
}
