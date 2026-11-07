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
	"testing"

	"bough/git"
)

func TestGetCommits_Order(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "a.txt", "hello", "second commit")
	addCommit(t, dir, "b.txt", "world", "third commit")

	repo, _ := git.Open(dir)
	commits, err := repo.GetCommits(100, true)
	if err != nil {
		t.Fatalf("GetCommits: %v", err)
	}
	if len(commits) != 3 { // initial + 2
		t.Errorf("len(commits) = %d, want 3", len(commits))
	}
	// Newest commit must be first
	if commits[0].Message != "third commit" {
		t.Errorf("commits[0].Message = %q, want %q", commits[0].Message, "third commit")
	}
}

func TestGetCommits_Limit(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "a.txt", "a", "commit 2")
	addCommit(t, dir, "b.txt", "b", "commit 3")
	addCommit(t, dir, "c.txt", "c", "commit 4")
	addCommit(t, dir, "d.txt", "d", "commit 5")

	repo, _ := git.Open(dir)
	commits, err := repo.GetCommits(3, true)
	if err != nil {
		t.Fatalf("GetCommits: %v", err)
	}
	if len(commits) != 3 {
		t.Errorf("len(commits) = %d, want 3 (limit respected)", len(commits))
	}
}

func TestGetCommits_GraphLayout(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "a.txt", "v1", "feature work")

	repo, _ := git.Open(dir)
	commits, err := repo.GetCommits(100, true)
	if err != nil {
		t.Fatalf("GetCommits: %v", err)
	}

	for i, c := range commits {
		if c.Hash == "" {
			t.Errorf("commits[%d].Hash is empty", i)
		}
		if len(c.ShortHash) != 7 {
			t.Errorf("commits[%d].ShortHash len = %d, want 7", i, len(c.ShortHash))
		}
		if c.Column < 0 {
			t.Errorf("commits[%d].Column < 0", i)
		}
		if c.Color < 0 || c.Color > 7 {
			t.Errorf("commits[%d].Color = %d, want 0–7", i, c.Color)
		}
		if c.Author == "" {
			t.Errorf("commits[%d].Author is empty", i)
		}
	}
}

func TestGetCommits_RefsPresent(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	commits, err := repo.GetCommits(10, true)
	if err != nil {
		t.Fatalf("GetCommits: %v", err)
	}
	if len(commits) == 0 {
		t.Fatal("no commits")
	}

	// At least one commit must have refs (HEAD branch should appear somewhere)
	found := false
	for _, c := range commits {
		if len(c.Refs) > 0 {
			found = true
			break
		}
	}
	if !found {
		t.Error("no refs found on any commit — expected at least HEAD branch")
	}
}

func TestGetCommits_ParentLinks(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "a.txt", "v1", "second")

	repo, _ := git.Open(dir)
	commits, err := repo.GetCommits(100, true)
	if err != nil {
		t.Fatalf("GetCommits: %v", err)
	}
	// Most recent commit should have a parent
	if len(commits[0].Parents) == 0 {
		t.Error("most recent commit has no parents")
	}
	// Initial commit should have no parents
	initial := commits[len(commits)-1]
	if len(initial.Parents) != 0 {
		t.Errorf("initial commit has %d parents, want 0", len(initial.Parents))
	}
}
