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
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"gitmorrow/git"
)

func deletionGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func deletionRepo(t *testing.T) (string, *git.Repository) {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("GIT_CONFIG_NOSYSTEM", "1")
	dir := t.TempDir()
	deletionGit(t, dir, "init", "-b", "main")
	deletionGit(t, dir, "config", "user.name", "Test")
	deletionGit(t, dir, "config", "user.email", "test@example.com")
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "initial")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	return dir, repo
}

func mustPrepareDeletion(t *testing.T, repo *git.Repository, name, remote string) git.BranchDeletionInfo {
	t.Helper()
	info, err := repo.PrepareBranchDeletion(name, remote)
	if err != nil {
		t.Fatal(err)
	}
	return info
}

func assertRef(t *testing.T, dir, ref string, exists bool) {
	t.Helper()
	cmd := exec.Command("git", "show-ref", "--verify", "--quiet", ref)
	cmd.Dir = dir
	err := cmd.Run()
	if (err == nil) != exists {
		t.Fatalf("ref %s: exists=%t, expected %t (%v)", ref, err == nil, exists, err)
	}
}

func TestDeleteLocalBranchSafety(t *testing.T) {
	dir, repo := deletionRepo(t)
	deletionGit(t, dir, "branch", "merged")
	info := mustPrepareDeletion(t, repo, "merged", "")
	actualDir, err := filepath.EvalSymlinks(dir)
	if err != nil {
		t.Fatal(err)
	}
	if info.Ref != "refs/heads/merged" || info.RepoPath != actualDir || info.OID == "" {
		t.Fatalf("bad snapshot: %+v", info)
	}
	if err := repo.DeleteBranch(info); err != nil {
		t.Fatal(err)
	}
	assertRef(t, dir, "refs/heads/merged", false)

	deletionGit(t, dir, "checkout", "-b", "unmerged")
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "unmerged")
	deletionGit(t, dir, "checkout", "main")
	if err := repo.DeleteBranch(mustPrepareDeletion(t, repo, "unmerged", "")); err == nil {
		t.Fatal("deleted unmerged branch")
	}
	assertRef(t, dir, "refs/heads/unmerged", true)

	deletionGit(t, dir, "branch", "checked")
	wt := filepath.Join(t.TempDir(), "worktree")
	deletionGit(t, dir, "worktree", "add", wt, "checked")
	if err := repo.DeleteBranch(mustPrepareDeletion(t, repo, "checked", "")); err == nil {
		t.Fatal("deleted branch checked out in another worktree")
	}
	assertRef(t, dir, "refs/heads/checked", true)

	deletionGit(t, dir, "branch", "stale")
	stale := mustPrepareDeletion(t, repo, "stale", "")
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "advance")
	deletionGit(t, dir, "branch", "-f", "stale", "main")
	if err := repo.DeleteBranch(stale); err == nil {
		t.Fatal("deleted changed branch")
	}
	assertRef(t, dir, "refs/heads/stale", true)
	for _, name := range []string{"", "-D", "HEAD", "../main", "main\nother", "refs/heads/main"} {
		if _, err := repo.PrepareBranchDeletion(name, ""); err == nil {
			t.Errorf("accepted invalid or nonexistent branch %q", name)
		}
	}
	forged := mustPrepareDeletion(t, repo, "stale", "")
	forged.RepoPath = wt
	if err := repo.DeleteBranch(forged); err == nil {
		t.Fatal("accepted changed repository")
	}
}

func deletionRemoteFixture(t *testing.T) (string, string, string, *git.Repository) {
	t.Helper()
	dir, repo := deletionRepo(t)
	fetch := filepath.Join(t.TempDir(), "fetch.git")
	push := filepath.Join(t.TempDir(), "push.git")
	deletionGit(t, dir, "init", "--bare", fetch)
	deletionGit(t, dir, "init", "--bare", push)
	deletionGit(t, dir, "branch", "feature/deep")
	deletionGit(t, dir, "branch", "other")
	for _, target := range []string{fetch, push} {
		deletionGit(t, dir, "push", target, "refs/heads/main:refs/heads/main", "refs/heads/feature/deep:refs/heads/feature/deep", "refs/heads/other:refs/heads/other")
	}
	deletionGit(t, dir, "remote", "add", "origin", fetch)
	deletionGit(t, dir, "remote", "set-url", "--push", "origin", push)
	deletionGit(t, dir, "fetch", "origin")
	return dir, fetch, push, repo
}

func TestRemoteDeletionInspectionFailuresPreserveDiagnostics(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fixture uses a POSIX shell wrapper")
	}
	for _, tc := range []struct{ name, pattern string }{
		{"rewrite rules", "config:--get-regexp:*"},
		{"push URL", "remote:get-url:--push"},
		{"remote list", "remote::"},
		{"fetch URLs", "remote:get-url:--all"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir, _, _, repo := deletionRemoteFixture(t)
			realGit, err := exec.LookPath("git")
			if err != nil {
				t.Fatal(err)
			}
			bin := t.TempDir()
			wrapper := fmt.Sprintf("#!/bin/sh\ncase \"$1:$2:$3\" in %s) printf 'private-diagnostic-value\\n' >&2; exit 42;; esac\nexec %q \"$@\"\n", tc.pattern, realGit)
			if err := os.WriteFile(filepath.Join(bin, "git"), []byte(wrapper), 0700); err != nil {
				t.Fatal(err)
			}
			t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
			_, err = repo.PrepareBranchDeletion("origin/feature/deep", "origin")
			var failure *git.Failure
			if !errors.As(err, &failure) || failure.ExitCode != 42 {
				t.Fatalf("inspection failure must preserve structured Git diagnostics: %v", err)
			}
			if strings.Contains(err.Error(), "private-diagnostic-value") {
				t.Fatalf("raw diagnostic exposed: %v", err)
			}
			_ = dir
		})
	}
}

func TestDeleteRemoteUsesOnlyPushDestination(t *testing.T) {
	dir, fetch, push, repo := deletionRemoteFixture(t)
	// Make accidental mirror/default/follow-tags pushes observable.
	deletionGit(t, dir, "config", "--global", "push.followTags", "true")
	deletionGit(t, dir, "config", "--global", "push.default", "matching")
	deletionGit(t, dir, "config", "--global", "push.recurseSubmodules", "on-demand")
	deletionGit(t, dir, "config", "remote.origin.mirror", "true")
	deletionGit(t, dir, "config", "--add", "remote.origin.push", "refs/heads/*:refs/heads/*")
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "local only")
	deletionGit(t, dir, "tag", "-a", "private-tag", "-m", "local tag")
	before := deletionGit(t, push, "for-each-ref", "--format=%(refname) %(objectname)")
	info := mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	if info.Ref != "refs/heads/feature/deep" || !strings.Contains(info.Destination, push) || strings.Contains(info.Destination, fetch) {
		t.Fatalf("bad push destination snapshot: %+v", info)
	}
	if err := repo.DeleteBranch(info); err != nil {
		t.Fatal(err)
	}
	assertRef(t, push, "refs/heads/feature/deep", false)
	assertRef(t, fetch, "refs/heads/feature/deep", true)
	assertRef(t, dir, "refs/remotes/origin/feature/deep", true)
	after := deletionGit(t, push, "for-each-ref", "--format=%(refname) %(objectname)")
	var filtered []string
	for _, line := range strings.Split(before, "\n") {
		if !strings.HasPrefix(line, "refs/heads/feature/deep ") {
			filtered = append(filtered, line)
		}
	}
	if after != strings.Join(filtered, "\n") {
		t.Fatalf("unexpected remote changes\nbefore: %s\nafter: %s", before, after)
	}
}

func TestDeleteRemoteRemovesTrackingRefForMatchingDestinations(t *testing.T) {
	dir, fetch, _, repo := deletionRemoteFixture(t)
	deletionGit(t, dir, "config", "remote.origin.pushurl", fetch)
	info := mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	if err := repo.DeleteBranch(info); err != nil {
		t.Fatal(err)
	}
	assertRef(t, fetch, "refs/heads/feature/deep", false)
	assertRef(t, dir, "refs/remotes/origin/feature/deep", false)
}

func TestDeleteRemoteMultipleFetchURLsKeepTrackingRef(t *testing.T) {
	dir, fetch, _, repo := deletionRemoteFixture(t)
	deletionGit(t, dir, "config", "remote.origin.pushurl", fetch)
	deletionGit(t, dir, "config", "--add", "remote.origin.url", filepath.Join(t.TempDir(), "second-fetch.git"))
	if err := repo.DeleteBranch(mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")); err != nil {
		t.Fatal(err)
	}
	assertRef(t, fetch, "refs/heads/feature/deep", false)
	assertRef(t, dir, "refs/remotes/origin/feature/deep", true)
}

func TestDeleteRemoteCleanupPreservesRefreshedTrackingRef(t *testing.T) {
	dir, fetch, _, repo := deletionRemoteFixture(t)
	deletionGit(t, dir, "config", "remote.origin.pushurl", fetch)
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "new tracking tip")
	newOID := deletionGit(t, dir, "rev-parse", "HEAD")
	info := mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	// The hook refreshes the tracking ref after snapshot validation but before
	// cleanup. A failing cleanup CAS must still report server-side success.
	hook := filepath.Join(dir, ".git", "hooks", "pre-push")
	if err := os.WriteFile(hook, []byte("#!/bin/sh\ngit update-ref refs/remotes/origin/feature/deep "+newOID+"\n"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteBranch(info); err != nil {
		t.Fatal(err)
	}
	assertRef(t, fetch, "refs/heads/feature/deep", false)
	if got := deletionGit(t, dir, "rev-parse", "refs/remotes/origin/feature/deep"); got != newOID {
		t.Fatalf("refreshed tracking ref lost: %s", got)
	}
}

func TestDeleteRemoteRejectsStaleAndUnsafeConfiguration(t *testing.T) {
	dir, _, push, repo := deletionRemoteFixture(t)
	info := mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "new tip")
	deletionGit(t, dir, "push", push, "HEAD:refs/heads/feature/deep")
	if err := repo.DeleteBranch(info); err == nil {
		t.Fatal("accepted stale server OID")
	}
	assertRef(t, push, "refs/heads/feature/deep", true)
	info = mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	deletionGit(t, dir, "config", "--add", "remote.origin.pushurl", filepath.Join(t.TempDir(), "other.git"))
	if err := repo.DeleteBranch(info); err == nil {
		t.Fatal("accepted multiple push URLs")
	}
	if _, err := repo.PrepareBranchDeletion("origin/feature/deep", "origin"); err == nil {
		t.Fatal("prepared multiple push URLs")
	}
	deletionGit(t, dir, "config", "--unset-all", "remote.origin.pushurl")
	deletionGit(t, dir, "config", "--add", "remote.origin.pushurl", push)
	info = mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	deletionGit(t, dir, "config", "remote.origin.pushurl", filepath.Join(t.TempDir(), "changed.git"))
	if err := repo.DeleteBranch(info); err == nil {
		t.Fatal("accepted changed push URL")
	}
	deletionGit(t, dir, "config", "remote.origin.pushurl", push)
	deletionGit(t, dir, "config", "--add", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*")
	if _, err := repo.PrepareBranchDeletion("origin/feature/deep", "origin"); err == nil {
		t.Fatal("accepted ambiguous fetch mapping")
	}
	deletionGit(t, dir, "config", "--unset-all", "remote.origin.fetch")
	deletionGit(t, dir, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*")
	deletionGit(t, dir, "config", "url.https://example.com/.pushInsteadOf", "secret:")
	if _, err := repo.PrepareBranchDeletion("origin/feature/deep", "origin"); err == nil {
		t.Fatal("accepted URL rewrites")
	}
	for _, name := range []string{"", "origin/", "origin/../main", "other/feature/deep", "origin/HEAD"} {
		if _, err := repo.PrepareBranchDeletion(name, "origin"); err == nil {
			t.Errorf("accepted invalid remote branch %q", name)
		}
	}
}

func TestDeleteRemoteLeaseRejectsRaceDuringPush(t *testing.T) {
	dir, _, push, repo := deletionRemoteFixture(t)
	deletionGit(t, dir, "commit", "--allow-empty", "-m", "racing tip")
	newOID := deletionGit(t, dir, "rev-parse", "HEAD")
	// Ensure the new object already exists on the server, without moving the
	// branch selected for deletion until the push has begun.
	deletionGit(t, dir, "push", push, "HEAD:refs/heads/other")
	info := mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	hook := filepath.Join(dir, ".git", "hooks", "pre-push")
	quotedPush := "'" + strings.ReplaceAll(push, "'", "'\\''") + "'"
	if err := os.WriteFile(hook, []byte("#!/bin/sh\ngit --git-dir="+quotedPush+" update-ref refs/heads/feature/deep "+newOID+"\n"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteBranch(info); err == nil {
		t.Fatal("lease allowed deletion after a concurrent server update")
	}
	if got := deletionGit(t, push, "rev-parse", "refs/heads/feature/deep"); got != newOID {
		t.Fatalf("concurrent server tip lost: %s", got)
	}
	assertRef(t, dir, "refs/remotes/origin/feature/deep", true)
}

func TestDeleteRemoteCredentialsAreNotExposed(t *testing.T) {
	dir, _, _, repo := deletionRemoteFixture(t)
	secretURL := "https://alice:secret-password@127.0.0.1:1/repo?token=secret-token"
	deletionGit(t, dir, "config", "remote.origin.pushurl", secretURL)
	info, err := repo.PrepareBranchDeletion("origin/feature/deep", "origin")
	if err == nil {
		t.Fatal("expected inaccessible remote to fail")
	}
	for _, secret := range []string{"alice", "secret-password", "secret-token"} {
		if strings.Contains(info.Destination, secret) || strings.Contains(err.Error(), secret) {
			t.Fatalf("credential %q exposed in destination/error: %q / %v", secret, info.Destination, err)
		}
	}
	if !strings.Contains(info.Destination, "127.0.0.1") {
		t.Fatalf("missing push host: %q", info.Destination)
	}
}

func TestDeleteRemoteServerRejection(t *testing.T) {
	dir, _, push, repo := deletionRemoteFixture(t)
	info := mustPrepareDeletion(t, repo, "origin/feature/deep", "origin")
	hook := filepath.Join(push, "hooks", "pre-receive")
	if err := os.WriteFile(hook, []byte("#!/bin/sh\necho rejected >&2\nexit 1\n"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteBranch(info); err == nil || !strings.Contains(err.Error(), "rejected") {
		t.Fatalf("expected rejection, got %v", err)
	}
	assertRef(t, push, "refs/heads/feature/deep", true)
	assertRef(t, dir, "refs/remotes/origin/feature/deep", true)
}
