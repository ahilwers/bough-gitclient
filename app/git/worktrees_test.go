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
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	git "gitmorrow/git"
)

// --- parseWorktrees ---

func TestParseWorktrees_MainOnly(t *testing.T) {
	input := `worktree /home/user/myrepo
HEAD abc1234defabc1234defabc1234defabc1234def0
branch refs/heads/main

`
	wts := git.ParseWorktreesForTest(input)
	if len(wts) != 1 {
		t.Fatalf("expected 1 worktree, got %d", len(wts))
	}
	wt := wts[0]
	if wt.Path != "/home/user/myrepo" {
		t.Errorf("Path = %q, want /home/user/myrepo", wt.Path)
	}
	if wt.Branch != "main" {
		t.Errorf("Branch = %q, want main", wt.Branch)
	}
	if wt.Head != "abc1234" {
		t.Errorf("Head = %q, want abc1234", wt.Head)
	}
	if !wt.IsMain {
		t.Error("IsMain should be true for first entry")
	}
}

func TestParseWorktrees_LinkedWorktree(t *testing.T) {
	input := `worktree /home/user/myrepo
HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
branch refs/heads/main

worktree /home/user/myrepo-feature
HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
branch refs/heads/feature/awesome

`
	wts := git.ParseWorktreesForTest(input)
	if len(wts) != 2 {
		t.Fatalf("expected 2 worktrees, got %d", len(wts))
	}
	if !wts[0].IsMain {
		t.Error("first entry should be main")
	}
	if wts[1].IsMain {
		t.Error("second entry should not be main")
	}
	if wts[1].Branch != "feature/awesome" {
		t.Errorf("linked branch = %q, want feature/awesome", wts[1].Branch)
	}
}

func TestParseWorktrees_DetachedHead(t *testing.T) {
	input := `worktree /home/user/myrepo
HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
branch refs/heads/main

worktree /home/user/myrepo-detached
HEAD cccccccccccccccccccccccccccccccccccccccc
detached

`
	wts := git.ParseWorktreesForTest(input)
	if len(wts) != 2 {
		t.Fatalf("expected 2, got %d", len(wts))
	}
	if wts[1].Branch != "(detached)" {
		t.Errorf("Branch = %q, want (detached)", wts[1].Branch)
	}
}

func TestParseWorktrees_HeadTruncated(t *testing.T) {
	input := `worktree /repo
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

`
	wts := git.ParseWorktreesForTest(input)
	if len(wts) == 0 {
		t.Fatal("expected worktree")
	}
	if len(wts[0].Head) != 7 {
		t.Errorf("Head length = %d, want 7", len(wts[0].Head))
	}
	if !strings.HasPrefix("1234567890abcdef", wts[0].Head) {
		t.Errorf("Head = %q, want prefix of hash", wts[0].Head)
	}
}

// --- ListWorktrees integration ---

func TestListWorktrees_MainWorktree(t *testing.T) {
	dir := initRepo(t)
	repo := openRepo(t, dir)

	wts, err := repo.ListWorktrees()
	if err != nil {
		t.Fatalf("ListWorktrees: %v", err)
	}
	if len(wts) == 0 {
		t.Fatal("expected at least one worktree")
	}
	if !wts[0].IsMain {
		t.Error("first worktree should be main")
	}
	if wts[0].Branch == "" {
		t.Error("Branch should not be empty")
	}
}

func TestListWorktrees_IsDirty(t *testing.T) {
	dir := initRepo(t)
	repo := openRepo(t, dir)

	// Initially clean
	wts, err := repo.ListWorktrees()
	if err != nil {
		t.Fatalf("ListWorktrees: %v", err)
	}
	if wts[0].IsDirty {
		t.Error("fresh repo should not be dirty")
	}

	// Write an untracked file → dirty
	if err := os.WriteFile(filepath.Join(dir, "dirty.txt"), []byte("change"), 0644); err != nil {
		t.Fatal(err)
	}

	wts, err = repo.ListWorktrees()
	if err != nil {
		t.Fatalf("ListWorktrees after dirty: %v", err)
	}
	if !wts[0].IsDirty {
		t.Error("repo with untracked file should be dirty")
	}
}

// --- AddWorktree integration ---

func TestAddWorktree(t *testing.T) {
	dir := initRepo(t)
	// Create a feature branch to use for the linked worktree.
	// git worktree add refuses to check out a branch that is already checked out.
	addBranch(t, dir, "feature/wt-test")
	repo := openRepo(t, dir)

	wtPath := filepath.Join(t.TempDir(), "linked-wt")
	if err := repo.AddWorktree(wtPath, "feature/wt-test"); err != nil {
		t.Fatalf("AddWorktree: %v", err)
	}

	// Verify the directory was created
	if _, err := os.Stat(wtPath); err != nil {
		t.Errorf("worktree directory not created: %v", err)
	}

	// Verify it appears in ListWorktrees.
	// Resolve symlinks because macOS /var is a symlink to /private/var and
	// git returns the resolved path while t.TempDir() may return the unresolved one.
	wtPathResolved, _ := filepath.EvalSymlinks(wtPath)
	wts, err := repo.ListWorktrees()
	if err != nil {
		t.Fatalf("ListWorktrees after add: %v", err)
	}
	found := false
	for _, wt := range wts {
		if wt.Path == wtPathResolved || wt.Path == wtPath {
			found = true
		}
	}
	if !found {
		t.Errorf("new worktree %q not found in list %v", wtPath, wts)
	}
}

// --- RemoveWorktree integration ---

func TestRemoveWorktree(t *testing.T) {
	dir := initRepo(t)
	addBranch(t, dir, "feature/to-remove")
	repo := openRepo(t, dir)

	wtPath := filepath.Join(t.TempDir(), "to-remove")
	if err := repo.AddWorktree(wtPath, "feature/to-remove"); err != nil {
		t.Fatalf("AddWorktree: %v", err)
	}

	if err := repo.RemoveWorktree(wtPath); err != nil {
		t.Fatalf("RemoveWorktree: %v", err)
	}

	// Directory should be gone
	if _, err := os.Stat(wtPath); !os.IsNotExist(err) {
		t.Errorf("expected worktree directory to be removed, got: %v", err)
	}
}

func TestRemoveWorktree_MainRefused(t *testing.T) {
	dir := initRepo(t)
	repo := openRepo(t, dir)

	err := repo.RemoveWorktree(dir)
	if err == nil {
		t.Fatal("expected error when removing main worktree")
	}
}

// --- PruneWorktrees integration ---

func TestPruneWorktrees(t *testing.T) {
	dir := initRepo(t)
	addBranch(t, dir, "feature/prunable")
	repo := openRepo(t, dir)

	// Add a worktree then delete its directory manually (simulate dangling ref)
	wtPath := filepath.Join(t.TempDir(), "prunable")
	if err := repo.AddWorktree(wtPath, "feature/prunable"); err != nil {
		t.Fatalf("AddWorktree: %v", err)
	}
	if err := os.RemoveAll(wtPath); err != nil {
		t.Fatal(err)
	}

	// Prune should succeed
	if err := repo.PruneWorktrees(); err != nil {
		t.Fatalf("PruneWorktrees: %v", err)
	}

	// The dangling entry should be gone
	wts, err := repo.ListWorktrees()
	if err != nil {
		t.Fatalf("ListWorktrees after prune: %v", err)
	}
	for _, wt := range wts {
		if wt.Path == wtPath {
			t.Errorf("pruned worktree still appears in list: %q", wtPath)
		}
	}
}

// --- helpers ---

// openRepo opens the repository at dir using the git package under test.
func openRepo(t *testing.T, dir string) *git.Repository {
	t.Helper()
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return repo
}

// addBranch creates a local branch in dir (branching from current HEAD).
func addBranch(t *testing.T, dir, name string) {
	t.Helper()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("branch", name)
}
