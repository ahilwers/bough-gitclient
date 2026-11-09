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

func TestGetCommitDiff_NewFile(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "hello.txt", "line one\nline two\n", "add hello")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	diffs, err := repo.GetCommitDiff(commits[0].Hash)
	if err != nil {
		t.Fatalf("GetCommitDiff: %v", err)
	}
	if len(diffs) == 0 {
		t.Fatal("expected at least one diff file")
	}
	if diffs[0].Path != "hello.txt" {
		t.Errorf("Path = %q, want hello.txt", diffs[0].Path)
	}
}

func TestGetCommitDiff_InitialCommit(t *testing.T) {
	// Initial commit has no parent — diff should still succeed
	dir := initRepo(t)
	addCommit(t, dir, "readme.md", "# Project\n", "add readme")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	// Find the initial commit (last one)
	initial := commits[len(commits)-1]
	_, err := repo.GetCommitDiff(initial.Hash)
	if err != nil {
		t.Fatalf("GetCommitDiff on initial commit: %v", err)
	}
}

func TestGetCommitDiff_ModifiedFile(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "file.txt", "original content\n", "original")
	addCommit(t, dir, "file.txt", "modified content\n", "modify")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	diffs, err := repo.GetCommitDiff(commits[0].Hash)
	if err != nil {
		t.Fatalf("GetCommitDiff: %v", err)
	}
	if len(diffs) == 0 {
		t.Fatal("expected a diff for the modified file")
	}
	if diffs[0].Path != "file.txt" {
		t.Errorf("Path = %q, want file.txt", diffs[0].Path)
	}
}

func TestGetFileDiff_UnstagedChanges(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "code.txt", "line 1\nline 2\nline 3\n", "initial code")

	repo, _ := git.Open(dir)

	// Modify the file without staging
	if err := os.WriteFile(filepath.Join(dir, "code.txt"), []byte("line 1\nline 2 modified\nline 3\n"), 0644); err != nil {
		t.Fatal(err)
	}

	diff, err := repo.GetFileDiff("code.txt", false)
	if err != nil {
		t.Fatalf("GetFileDiff (unstaged): %v", err)
	}
	if diff.Path != "code.txt" {
		t.Errorf("Path = %q, want code.txt", diff.Path)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected at least one hunk for modified file")
	}

	// Verify add/del lines are present
	hunk := diff.Hunks[0]
	var hasAdd, hasDel bool
	for _, line := range hunk.Lines {
		if line.Type == "add" {
			hasAdd = true
		}
		if line.Type == "del" {
			hasDel = true
		}
	}
	if !hasAdd || !hasDel {
		t.Errorf("hunk missing add/del lines: hasAdd=%v hasDel=%v", hasAdd, hasDel)
	}
}

func TestGetFileDiff_StagedChanges(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "staged.txt", "original\n", "initial")

	repo, _ := git.Open(dir)

	// Modify and stage
	if err := os.WriteFile(filepath.Join(dir, "staged.txt"), []byte("changed\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("staged.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	diff, err := repo.GetFileDiff("staged.txt", true)
	if err != nil {
		t.Fatalf("GetFileDiff (staged): %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected hunks for staged changes")
	}
}

func TestParsePatchOutput_LineNumbers(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "nums.txt", "a\nb\nc\nd\ne\n", "initial")

	repo, _ := git.Open(dir)
	if err := os.WriteFile(filepath.Join(dir, "nums.txt"), []byte("a\nb\nX\nd\ne\n"), 0644); err != nil {
		t.Fatal(err)
	}

	diff, err := repo.GetFileDiff("nums.txt", false)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected hunks")
	}

	// Verify that del and add lines have correct non-zero line numbers
	for _, line := range diff.Hunks[0].Lines {
		switch line.Type {
		case "del":
			if line.OldNo == 0 {
				t.Errorf("del line has OldNo=0 (should have old line number)")
			}
		case "add":
			if line.NewNo == 0 {
				t.Errorf("add line has NewNo=0 (should have new line number)")
			}
		case "ctx":
			if line.OldNo == 0 || line.NewNo == 0 {
				t.Errorf("ctx line missing line numbers: OldNo=%d NewNo=%d", line.OldNo, line.NewNo)
			}
		}
	}
}

func TestGetFileAtCommit_Content(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "hello.txt", "content here\n", "add hello")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	content, err := repo.GetFileAtCommit(commits[0].Hash, "hello.txt")
	if err != nil {
		t.Fatalf("GetFileAtCommit: %v", err)
	}
	if content != "content here\n" {
		t.Errorf("content = %q, want %q", content, "content here\n")
	}
}

func TestGetFileAtCommit_MissingFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	content, err := repo.GetFileAtCommit(commits[0].Hash, "nonexistent.txt")
	if err != nil {
		t.Fatalf("unexpected error for missing file: %v", err)
	}
	if content != "" {
		t.Errorf("expected empty content for missing file, got %q", content)
	}
}

func TestGetFileAtCommitParent_PreviousContent(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "file.txt", "version one\n", "v1")
	addCommit(t, dir, "file.txt", "version two\n", "v2")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	// commits[0] is v2 — its parent should have "version one"
	parent, err := repo.GetFileAtCommitParent(commits[0].Hash, "file.txt")
	if err != nil {
		t.Fatalf("GetFileAtCommitParent: %v", err)
	}
	if parent != "version one\n" {
		t.Errorf("parent content = %q, want %q", parent, "version one\n")
	}
}

func TestGetFileAtCommitParent_InitialCommit(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "readme.md", "# Hello\n", "init")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)
	initial := commits[len(commits)-1]

	content, err := repo.GetFileAtCommitParent(initial.Hash, "readme.md")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "" {
		t.Errorf("initial commit parent content should be empty, got %q", content)
	}
}
