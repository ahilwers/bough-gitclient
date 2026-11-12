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
	"runtime"
	"strings"
	"testing"

	"gitmorrow/git"
)

func TestStageFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	// Write an untracked file
	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Before staging: file is untracked (staged="?")
	before, _ := repo.Status()
	untracked := filesByPath(before.Files, "new.txt")
	if len(untracked) == 0 {
		t.Fatal("new.txt not in status before staging")
	}

	if err := repo.StageFile("new.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	// After staging: file should have a non-empty Staged code
	after, _ := repo.Status()
	staged := filesByPath(after.Files, "new.txt")
	if len(staged) == 0 {
		t.Fatal("new.txt not in status after staging")
	}
	if staged[0].Staged == "" || staged[0].Staged == "?" {
		t.Errorf("Staged = %q after StageFile, expected A or M", staged[0].Staged)
	}
}

func TestUnstageFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("f.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	// Confirm it's staged
	status, _ := repo.Status()
	if files := filesByPath(status.Files, "f.txt"); len(files) == 0 || files[0].Staged == "?" {
		t.Fatal("expected f.txt to be staged")
	}

	if err := repo.UnstageFile("f.txt"); err != nil {
		t.Fatalf("UnstageFile: %v", err)
	}

	status, _ = repo.Status()
	unstaged := filesByPath(status.Files, "f.txt")
	if len(unstaged) > 0 && unstaged[0].Staged != "" && unstaged[0].Staged != "?" {
		t.Errorf("file still has Staged=%q after UnstageFile", unstaged[0].Staged)
	}
}

func TestCreateCommit(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	if err := os.WriteFile(filepath.Join(dir, "commit.txt"), []byte("content"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("commit.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	hash, err := repo.CreateCommit("test commit message")
	if err != nil {
		t.Fatalf("CreateCommit: %v", err)
	}
	if len(hash) != 40 {
		t.Errorf("hash length = %d, want 40", len(hash))
	}

	// Verify the commit appears in the log
	commits, _ := repo.GetCommits(10, true)
	if commits[0].Message != "test commit message" {
		t.Errorf("top commit message = %q, want %q", commits[0].Message, "test commit message")
	}
}

func TestCreateCommitInLinkedWorktree(t *testing.T) {
	for _, mode := range []string{"switch", "open"} {
		t.Run(mode, func(t *testing.T) {
			dir := initRepo(t)
			linked := filepath.Join(t.TempDir(), "linked")
			statusGit(t, dir, "worktree", "add", "-b", "linked", linked)
			mainHead := statusGit(t, dir, "rev-parse", "HEAD")
			linkedHead := statusGit(t, linked, "rev-parse", "HEAD")

			openPath := dir
			if mode == "open" {
				openPath = linked
			}
			repo, err := git.Open(openPath)
			if err != nil {
				t.Fatal(err)
			}
			if mode == "switch" {
				repo.SwitchPath(linked)
			}
			if err := os.WriteFile(filepath.Join(linked, "linked.txt"), []byte("linked content\n"), 0644); err != nil {
				t.Fatal(err)
			}
			if err := repo.StageFile("linked.txt"); err != nil {
				t.Fatal(err)
			}
			status, err := repo.Status()
			if err != nil || len(filesByPath(status.Files, "linked.txt")) != 1 || filesByPath(status.Files, "linked.txt")[0].Staged != "A" {
				t.Fatalf("linked status before commit: %+v, %v", status, err)
			}

			hash, err := repo.CreateCommit("linked commit")
			if err != nil {
				t.Fatalf("CreateCommit with linked staged changes: %v", err)
			}
			if len(hash) != 40 || hash != statusGit(t, linked, "rev-parse", "HEAD") {
				t.Fatalf("returned hash %q is not full linked HEAD", hash)
			}
			if got := statusGit(t, linked, "rev-parse", "HEAD^"); got != linkedHead {
				t.Fatalf("linked parent = %s, want %s", got, linkedHead)
			}
			if got := statusGit(t, linked, "show", "HEAD:linked.txt"); got != "linked content" {
				t.Fatalf("committed content = %q", got)
			}
			if got := statusGit(t, dir, "rev-parse", "HEAD"); got != mainHead {
				t.Fatalf("main HEAD changed from %s to %s", mainHead, got)
			}
			if got := statusGit(t, linked, "status", "--porcelain"); got != "" {
				t.Fatalf("linked worktree not clean after commit: %s", got)
			}
		})
	}
}

func TestCreateCommitKeepsOtherWorktreeIndex(t *testing.T) {
	dir := initRepo(t)
	linked := filepath.Join(t.TempDir(), "linked")
	statusGit(t, dir, "worktree", "add", "-b", "linked", linked)
	repo := openRepo(t, dir)
	if err := os.WriteFile(filepath.Join(dir, "main.txt"), []byte("main\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("main.txt"); err != nil {
		t.Fatal(err)
	}
	mainHead := statusGit(t, dir, "rev-parse", "HEAD")
	repo.SwitchPath(linked)
	if err := os.WriteFile(filepath.Join(linked, "linked.txt"), []byte("linked\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("linked.txt"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.CreateCommit("linked only"); err != nil {
		t.Fatal(err)
	}
	if got := statusGit(t, dir, "rev-parse", "HEAD"); got != mainHead {
		t.Fatalf("main HEAD changed from %s to %s", mainHead, got)
	}
	if got := statusGit(t, dir, "diff", "--cached", "--name-only"); got != "main.txt" {
		t.Fatalf("main staged files = %q", got)
	}
	if got := statusGit(t, linked, "show", "--format=", "--name-only", "HEAD"); got != "linked.txt" {
		t.Fatalf("linked committed files = %q", got)
	}
	repo.SwitchPath(dir)
	if _, err := repo.CreateCommit("main only"); err != nil {
		t.Fatal(err)
	}
	if got := statusGit(t, dir, "show", "--format=", "--name-only", "HEAD"); got != "main.txt" {
		t.Fatalf("main committed files = %q", got)
	}
}

func TestCreateMergeCommitInLinkedWorktree(t *testing.T) {
	dir := initRepo(t)
	linked := filepath.Join(t.TempDir(), "linked")
	statusGit(t, dir, "worktree", "add", "-b", "linked", linked)
	linkedHead := statusGit(t, linked, "rev-parse", "HEAD")
	addCommit(t, dir, "main.txt", "main\n", "main change")
	mainHead := statusGit(t, dir, "rev-parse", "HEAD")
	statusGit(t, linked, "merge", "--no-ff", "--no-commit", mainHead)
	repo := openRepo(t, dir)
	repo.SwitchPath(linked)
	hash, err := repo.CreateCommit("merge commit")
	if err != nil {
		t.Fatal(err)
	}
	fullHash := statusGit(t, linked, "rev-parse", "HEAD")
	if hash == "" || !strings.HasPrefix(fullHash, hash) {
		t.Fatalf("unexpected hash %q", hash)
	}
	if got := statusGit(t, linked, "rev-list", "--parents", "-n", "1", "HEAD"); got != fullHash+" "+linkedHead+" "+mainHead {
		t.Fatalf("merge parents = %q", got)
	}
	if got := statusGit(t, dir, "rev-parse", "HEAD"); got != mainHead {
		t.Fatalf("main HEAD changed to %s", got)
	}
}

func TestCreateCommitCleanWorktree(t *testing.T) {
	dir := initRepo(t)
	repo := openRepo(t, dir)
	head := statusGit(t, dir, "rev-parse", "HEAD")
	if _, err := repo.CreateCommit("no changes"); err == nil {
		t.Fatal("expected an error for a clean worktree")
	}
	if got := statusGit(t, dir, "rev-parse", "HEAD"); got != head {
		t.Fatalf("clean commit changed HEAD from %s to %s", head, got)
	}
}

func TestCreateCommitDoesNotRunHook(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell hook fixture requires Unix")
	}
	dir := initRepo(t)
	repo := openRepo(t, dir)
	head := statusGit(t, dir, "rev-parse", "HEAD")
	if err := os.WriteFile(filepath.Join(dir, "staged.txt"), []byte("staged\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("staged.txt"); err != nil {
		t.Fatal(err)
	}
	hook := filepath.Join(dir, ".git", "hooks", "pre-commit")
	if err := os.WriteFile(hook, []byte("#!/bin/sh\necho rejected-by-hook >&2\nexit 1\n"), 0755); err != nil {
		t.Fatal(err)
	}
	statusGit(t, dir, "config", "commit.gpgsign", "true")
	hash, err := repo.CreateCommit("normal commit")
	if err != nil {
		t.Fatalf("normal commit should ignore hooks and signing config: %v", err)
	}
	if hash == head || hash != statusGit(t, dir, "rev-parse", "HEAD") {
		t.Fatalf("unexpected commit hash %q", hash)
	}
}

func TestStageHunk(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "hunk.txt", "line1\nline2\nline3\n", "initial")
	repo, _ := git.Open(dir)

	// Modify the file
	if err := os.WriteFile(filepath.Join(dir, "hunk.txt"), []byte("line1\nLINE2_CHANGED\nline3\n"), 0644); err != nil {
		t.Fatal(err)
	}

	diff, err := repo.GetFileDiff("hunk.txt", false)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected hunks for modified file")
	}

	// Build a minimal patch for the hunk
	patch := buildPatch("hunk.txt", diff.Hunks[0])
	if err := repo.StageHunkViaApply(patch); err != nil {
		t.Fatalf("StageHunkViaApply: %v", err)
	}

	// The file should now have staged changes
	status, _ := repo.Status()
	f := filesByPath(status.Files, "hunk.txt")
	if len(f) == 0 {
		t.Fatal("hunk.txt not in status after hunk staging")
	}
	if f[0].Staged == "" {
		t.Error("expected Staged to be set after StageHunkViaApply")
	}
}

func TestUnstageHunk(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "unstage.txt", "line1\nline2\nline3\n", "initial")
	repo, _ := git.Open(dir)

	// Modify and stage the file
	if err := os.WriteFile(filepath.Join(dir, "unstage.txt"), []byte("line1\nLINE2_CHANGED\nline3\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("unstage.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	// Confirm it's staged
	status, _ := repo.Status()
	f := filesByPath(status.Files, "unstage.txt")
	if len(f) == 0 || f[0].Staged == "" {
		t.Fatal("expected unstage.txt to be staged")
	}

	// Build patch from the staged diff and unstage the hunk
	diff, err := repo.GetFileDiff("unstage.txt", true)
	if err != nil {
		t.Fatalf("GetFileDiff (staged): %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected staged hunks")
	}
	patch := buildPatch("unstage.txt", diff.Hunks[0])
	if err := repo.UnstageHunkViaApply(patch); err != nil {
		t.Fatalf("UnstageHunkViaApply: %v", err)
	}

	// After unstaging, staged code should be empty, "?" or " " (unmodified)
	status, _ = repo.Status()
	f = filesByPath(status.Files, "unstage.txt")
	notStaged := map[string]bool{"": true, "?": true, " ": true}
	if len(f) > 0 && !notStaged[f[0].Staged] {
		t.Errorf("expected Staged to be empty/unmodified after UnstageHunkViaApply, got %q", f[0].Staged)
	}
}

func TestDiscardHunk(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "discard.txt", "line1\nline2\nline3\n", "initial")
	repo, _ := git.Open(dir)

	// Modify the file without staging
	if err := os.WriteFile(filepath.Join(dir, "discard.txt"), []byte("line1\nLINE2_CHANGED\nline3\n"), 0644); err != nil {
		t.Fatal(err)
	}

	diff, err := repo.GetFileDiff("discard.txt", false)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected hunks for modified file")
	}

	patch := buildPatch("discard.txt", diff.Hunks[0])
	if err := repo.DiscardHunk(patch); err != nil {
		t.Fatalf("DiscardHunk: %v", err)
	}

	// After discarding, the file should be back to original (no unstaged changes)
	after, _ := repo.GetFileDiff("discard.txt", false)
	if len(after.Hunks) > 0 {
		t.Error("expected no hunks after DiscardHunk")
	}
}

func TestAmendCommit(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "a.txt", "hello", "original message")

	repo, _ := git.Open(dir)
	if err := repo.AmendCommit("amended message"); err != nil {
		t.Fatalf("AmendCommit: %v", err)
	}

	commits, _ := repo.GetCommits(10, true)
	if commits[0].Message != "amended message" {
		t.Errorf("after amend: message = %q, want %q", commits[0].Message, "amended message")
	}
}

// --- helpers ---

func filesByPath(files []git.FileStatus, path string) []git.FileStatus {
	var out []git.FileStatus
	for _, f := range files {
		if f.Path == path {
			out = append(out, f)
		}
	}
	return out
}

// buildPatch constructs a minimal unified diff patch string for a single hunk.
func buildPatch(filePath string, hunk git.DiffHunk) string {
	var sb strings.Builder
	sb.WriteString("--- a/" + filePath + "\n")
	sb.WriteString("+++ b/" + filePath + "\n")
	sb.WriteString(hunk.Header + "\n")
	for _, line := range hunk.Lines {
		switch line.Type {
		case "add":
			sb.WriteString("+" + line.Content + "\n")
		case "del":
			sb.WriteString("-" + line.Content + "\n")
		default:
			sb.WriteString(" " + line.Content + "\n")
		}
	}
	return sb.String()
}
