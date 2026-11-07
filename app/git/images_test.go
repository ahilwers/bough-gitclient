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
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"bough/git"
)

// tinyRedPng is a minimal valid 1x1 red PNG.
var tinyRedPng = []byte{
	0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
	0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
	0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
	0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
	0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
	0x42, 0x60, 0x82,
}

func gitRun(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return string(out)
}

func TestGetImageAtCommit_ReturnsDataURL(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "shot.png", string(tinyRedPng), "add image")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	img, err := repo.GetImageAtCommit(commits[0].Hash, "shot.png")
	if err != nil {
		t.Fatalf("GetImageAtCommit: %v", err)
	}
	if !strings.HasPrefix(img.DataURL, "data:image/png;base64,") {
		t.Errorf("DataURL = %q, want image/png data URL prefix", img.DataURL)
	}
	if img.Size != int64(len(tinyRedPng)) {
		t.Errorf("Size = %d, want %d", img.Size, len(tinyRedPng))
	}
}

func TestGetImageAtCommit_MissingFile(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "shot.png", string(tinyRedPng), "add image")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	img, err := repo.GetImageAtCommit(commits[0].Hash, "missing.png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if img.DataURL != "" {
		t.Errorf("DataURL = %q, want empty for missing file", img.DataURL)
	}
}

func TestGetImageAtCommitParent_ReturnsPreviousVersion(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "logo.png", string(tinyRedPng), "v1")
	bigger := append([]byte{}, tinyRedPng...)
	bigger = append(bigger, 0x00)
	addCommit(t, dir, "logo.png", string(bigger), "v2")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	// commits[0] is v2 — parent ("v1") has the smaller image
	parent, err := repo.GetImageAtCommitParent(commits[0].Hash, "logo.png")
	if err != nil {
		t.Fatalf("GetImageAtCommitParent: %v", err)
	}
	if parent.Size != int64(len(tinyRedPng)) {
		t.Errorf("parent Size = %d, want %d", parent.Size, len(tinyRedPng))
	}
	current, err := repo.GetImageAtCommit(commits[0].Hash, "logo.png")
	if err != nil {
		t.Fatalf("GetImageAtCommit: %v", err)
	}
	if current.Size != int64(len(bigger)) {
		t.Errorf("current Size = %d, want %d", current.Size, len(bigger))
	}
	if current.DataURL == parent.DataURL {
		t.Errorf("current and parent data URLs should differ")
	}
}

func TestGetImageAtCommitParent_InitialCommit(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "logo.png", string(tinyRedPng), "init")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)
	initial := commits[len(commits)-1] // oldest commit in the log

	img, err := repo.GetImageAtCommitParent(initial.Hash, "logo.png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if img.DataURL != "" {
		t.Errorf("initial commit parent image should be empty, got %q", img.DataURL)
	}
}

func TestGetImageAtCommit_DeletedFile(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "shot.png", string(tinyRedPng), "add image")
	gitRun(t, dir, "rm", "shot.png")
	gitRun(t, dir, "commit", "-m", "remove image")

	repo, _ := git.Open(dir)
	commits, _ := repo.GetCommits(10, true)

	// Newest commit removed the image — current side is empty, parent has it.
	current, err := repo.GetImageAtCommit(commits[0].Hash, "shot.png")
	if err != nil {
		t.Fatalf("GetImageAtCommit: %v", err)
	}
	if current.DataURL != "" {
		t.Errorf("current DataURL = %q, want empty", current.DataURL)
	}

	parent, err := repo.GetImageAtCommitParent(commits[0].Hash, "shot.png")
	if err != nil {
		t.Fatalf("GetImageAtCommitParent: %v", err)
	}
	if !strings.HasPrefix(parent.DataURL, "data:image/png;base64,") {
		t.Errorf("parent DataURL missing png prefix: %q", parent.DataURL)
	}
}

func TestGetImageFromStash_TrackedAndBase(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "logo.png", string(tinyRedPng), "add image")

	stashed := append([]byte{}, tinyRedPng...)
	stashed = append(stashed, 0x42)
	if err := os.WriteFile(filepath.Join(dir, "logo.png"), stashed, 0644); err != nil {
		t.Fatal(err)
	}
	gitRun(t, dir, "stash", "push", "-m", "stash image", "--", "logo.png")

	repo, _ := git.Open(dir)

	stashImg, err := repo.GetImageFromStash(0, "logo.png")
	if err != nil {
		t.Fatalf("GetImageFromStash: %v", err)
	}
	if stashImg.Size != int64(len(stashed)) {
		t.Errorf("stash image size = %d, want %d", stashImg.Size, len(stashed))
	}

	baseImg, err := repo.GetImageFromStashBase(0, "logo.png")
	if err != nil {
		t.Fatalf("GetImageFromStashBase: %v", err)
	}
	if baseImg.Size != int64(len(tinyRedPng)) {
		t.Errorf("base image size = %d, want %d", baseImg.Size, len(tinyRedPng))
	}
	if baseImg.DataURL == stashImg.DataURL {
		t.Errorf("base and stash data URLs should differ")
	}
}

func TestGetImageFromStash_Untracked(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "main.txt", "content\n", "init")

	untracked := append([]byte{}, tinyRedPng...)
	untracked = append(untracked, 0x99)
	if err := os.WriteFile(filepath.Join(dir, "new.png"), untracked, 0644); err != nil {
		t.Fatal(err)
	}
	gitRun(t, dir, "stash", "push", "-u", "-m", "stash untracked")

	repo, _ := git.Open(dir)

	// Untracked file is stored in the stash's third parent — base has no version.
	stashImg, err := repo.GetImageFromStash(0, "new.png")
	if err != nil {
		t.Fatalf("GetImageFromStash: %v", err)
	}
	if stashImg.Size != int64(len(untracked)) {
		t.Errorf("stash untracked image size = %d, want %d", stashImg.Size, len(untracked))
	}

	baseImg, err := repo.GetImageFromStashBase(0, "new.png")
	if err != nil {
		t.Fatalf("GetImageFromStashBase: %v", err)
	}
	if baseImg.DataURL != "" {
		t.Errorf("base should be empty for untracked file, got %q", baseImg.DataURL)
	}
}

func TestGetImageFromWorktree(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "shot.png", string(tinyRedPng), "add image")

	repo, _ := git.Open(dir)

	newData := append([]byte{}, tinyRedPng...)
	newData = append(newData, 0xFF, 0xFE)
	if err := os.WriteFile(filepath.Join(dir, "shot.png"), newData, 0644); err != nil {
		t.Fatal(err)
	}

	img, err := repo.GetImageFromWorktree("shot.png")
	if err != nil {
		t.Fatalf("GetImageFromWorktree: %v", err)
	}
	if img.Size != int64(len(newData)) {
		t.Errorf("Size = %d, want %d", img.Size, len(newData))
	}
	if !strings.HasPrefix(img.DataURL, "data:image/png;base64,") {
		t.Errorf("DataURL missing png prefix: %q", img.DataURL)
	}
}

func TestGetImageFromHead(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "shot.png", string(tinyRedPng), "add image")

	repo, _ := git.Open(dir)

	img, err := repo.GetImageFromHead("shot.png")
	if err != nil {
		t.Fatalf("GetImageFromHead: %v", err)
	}
	if img.Size != int64(len(tinyRedPng)) {
		t.Errorf("Size = %d, want %d", img.Size, len(tinyRedPng))
	}
	if !strings.HasPrefix(img.DataURL, "data:image/png;base64,") {
		t.Errorf("HEAD image missing png prefix: %q", img.DataURL)
	}
}

func TestGetImageFromIndex_StagedVersion(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "shot.png", string(tinyRedPng), "add image")

	repo, _ := git.Open(dir)

	// Stage a modified version — the index then holds the new bytes.
	staged := append([]byte{}, tinyRedPng...)
	staged = append(staged, 0x01, 0x02, 0x03)
	if err := os.WriteFile(filepath.Join(dir, "shot.png"), staged, 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("shot.png"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	img, err := repo.GetImageFromIndex("shot.png")
	if err != nil {
		t.Fatalf("GetImageFromIndex: %v", err)
	}
	if img.Size != int64(len(staged)) {
		t.Errorf("index Size = %d, want %d", img.Size, len(staged))
	}
}

func TestGetImageFromMergeStage_OursAndTheirs(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "logo.png", string(tinyRedPng), "base")

	ours := append([]byte{}, tinyRedPng...)
	ours = append(ours, 0x0A) // "ours" adds one byte
	theirs := append([]byte{}, tinyRedPng...)
	theirs = append(theirs, 0x0B) // "theirs" adds a different byte

	mainBranch := strings.TrimSpace(gitRun(t, dir, "rev-parse", "--abbrev-ref", "HEAD"))

	gitRun(t, dir, "checkout", "-b", "side")
	if err := os.WriteFile(filepath.Join(dir, "logo.png"), theirs, 0644); err != nil {
		t.Fatal(err)
	}
	gitRun(t, dir, "add", "logo.png")
	gitRun(t, dir, "commit", "-m", "theirs")

	gitRun(t, dir, "checkout", mainBranch)
	if err := os.WriteFile(filepath.Join(dir, "logo.png"), ours, 0644); err != nil {
		t.Fatal(err)
	}
	gitRun(t, dir, "add", "logo.png")
	gitRun(t, dir, "commit", "-m", "ours")

	// Merging a binary modify/modify conflict leaves unmerged index stages.
	cmd := exec.Command("git", "merge", "side")
	cmd.Dir = dir
	out, _ := cmd.CombinedOutput()
	if !strings.Contains(string(out), "CONFLICT") {
		t.Fatalf("expected merge conflict, got:\n%s", out)
	}

	repo, _ := git.Open(dir)

	img, err := repo.GetImageFromIndexStage("logo.png", 2)
	if err != nil {
		t.Fatalf("GetImageFromIndexStage(2): %v", err)
	}
	if img.Size != int64(len(ours)) {
		t.Errorf("ours size = %d, want %d", img.Size, len(ours))
	}

	img, err = repo.GetImageFromIndexStage("logo.png", 3)
	if err != nil {
		t.Fatalf("GetImageFromIndexStage(3): %v", err)
	}
	if img.Size != int64(len(theirs)) {
		t.Errorf("theirs size = %d, want %d", img.Size, len(theirs))
	}
}
