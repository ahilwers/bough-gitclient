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

package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	gitpkg "bough/git"
)

// Each previously gated operation should reach its normal repository check.
func TestWriteOperationsWithoutRepository(t *testing.T) {
	app := NewApp()
	tests := map[string]func() error{
		"stage files":         func() error { return app.StageFiles(nil) },
		"unstage files":       func() error { return app.UnstageFiles(nil) },
		"stage file":          func() error { return app.StageFile("file") },
		"unstage file":        func() error { return app.UnstageFile("file") },
		"stage hunk":          func() error { return app.StageHunk("") },
		"unstage hunk":        func() error { return app.UnstageHunk("") },
		"discard file":        func() error { return app.DiscardFile("file") },
		"discard staged file": func() error { return app.DiscardStagedFile("file") },
		"discard hunk":        func() error { return app.DiscardHunk("") },
		"commit":              func() error { _, err := app.CreateCommit("message"); return err },
		"amend":               func() error { return app.AmendCommit("message") },
		"fetch":               func() error { return app.Fetch("origin") },
		"pull":                func() error { return app.Pull("origin", "main") },
		"push":                func() error { return app.Push("origin", "main", false) },
		"push preflight":      func() error { _, err := app.GetPushInfo(); return err },
		"create upstream":     func() error { return app.PushWithUpstream("/repo", "origin", "main") },
		"create branch":       func() error { return app.CreateBranch("branch", "main", false) },
		"merge":               func() error { return app.MergeBranch("branch") },
		"cherry-pick":         func() error { return app.CherryPickCommits(nil) },
		"rebase":              func() error { return app.StartInteractiveRebase(nil) },
		"add remote":          func() error { return app.AddRemote("origin", "url") },
		"update remote":       func() error { return app.UpdateRemote("origin", "url") },
		"rename remote":       func() error { return app.RenameRemote("origin", "other") },
		"remove remote":       func() error { return app.RemoveRemote("origin") },
	}
	for name, run := range tests {
		t.Run(name, func(t *testing.T) {
			if err := run(); !errors.Is(err, gitpkg.ErrNotARepo) {
				t.Fatalf("got %v, want %v", err, gitpkg.ErrNotARepo)
			}
		})
	}
}

// Exercise the Wails-facing write methods without any license or trial setup.
func TestWriteOperationsWithoutLicense(t *testing.T) {
	dir := t.TempDir()
	runGit := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}

	runGit("init")
	runGit("config", "user.name", "Test User")
	runGit("config", "user.email", "test@example.com")
	if err := os.WriteFile(filepath.Join(dir, "example.txt"), []byte("hello\n"), 0644); err != nil {
		t.Fatal(err)
	}

	repo, err := gitpkg.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	watcher, err := gitpkg.NewWatcher()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(watcher.Close)
	app := &App{repo: repo, watcher: watcher}

	if err := app.StageFile("example.txt"); err != nil {
		t.Fatalf("stage: %v", err)
	}
	if got := runGit("diff", "--cached", "--name-only"); got != "example.txt" {
		t.Fatalf("staged files = %q", got)
	}
	hash, err := app.CreateCommit("Initial commit")
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if got := runGit("rev-parse", "HEAD"); hash != got {
		t.Fatalf("commit hash = %q, HEAD = %q", hash, got)
	}
}

// Local tags must be pushed along with the branch for both the default push
// (empty remote/branch, which the CLI helper strips into a bare `git push`)
// and the explicit create-upstream path.
func TestPushPublishesTags(t *testing.T) {
	dir := t.TempDir()
	remote := t.TempDir()
	runGit := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	runGit("init")
	runGit("config", "user.name", "Test User")
	runGit("config", "user.email", "test@example.com")
	if err := os.WriteFile(filepath.Join(dir, "example.txt"), []byte("hello\n"), 0644); err != nil {
		t.Fatal(err)
	}
	remoteGit := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = remote
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git (remote) %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	remoteGit("init", "--bare")

	repo, err := gitpkg.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	watcher, err := gitpkg.NewWatcher()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(watcher.Close)
	app := &App{repo: repo, watcher: watcher}

	if err := app.StageFile("example.txt"); err != nil {
		t.Fatalf("stage: %v", err)
	}
	if _, err := app.CreateCommit("Initial commit"); err != nil {
		t.Fatalf("commit: %v", err)
	}
	runGit("remote", "add", "origin", remote)
	canonical := runGit("branch", "--show-current")
	info, err := app.GetPushInfo()
	if err != nil {
		t.Fatalf("push info: %v", err)
	}
	if err := app.PushWithUpstream(info.RepoPath, "origin", info.Branch); err != nil {
		t.Fatalf("create upstream: %v", err)
	}
	// Default push of an already-tracked branch must carry tags too.
	runGit("tag", "v2.0")
	runGit("tag", "-a", "v2.1", "-m", "release")
	if err := app.Push("", "", false); err != nil {
		t.Fatalf("default push: %v", err)
	}
	refs := remoteGit("for-each-ref", "--format=%(refname)")
	for _, want := range []string{"refs/heads/" + canonical, "refs/tags/v2.0", "refs/tags/v2.1"} {
		if !strings.Contains(refs, want) {
			t.Fatalf("remote refs missing %q: %q", want, refs)
		}
	}
}
