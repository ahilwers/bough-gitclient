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

func creationGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func creationWrite(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestCreateStash(t *testing.T) {
	for _, tt := range []struct {
		name             string
		message          string
		includeUntracked bool
	}{
		{"default message without untracked", "", false},
		{"option-like message without untracked", "--include-untracked; touch injected", false},
		{"message with untracked", "save; touch injected", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dir := initRepo(t)
			addCommit(t, dir, "tracked", "base\n", "tracked")
			creationWrite(t, dir, "tracked", "staged\n")
			creationGit(t, dir, "add", "tracked")
			creationWrite(t, dir, "tracked", "working\n")
			creationWrite(t, dir, "untracked", "untracked content\n")
			repo, err := git.Open(dir)
			if err != nil {
				t.Fatal(err)
			}
			if err := repo.CreateStash(tt.message, tt.includeUntracked); err != nil {
				t.Fatal(err)
			}

			entries, err := repo.ListStashes()
			if err != nil || len(entries) != 1 {
				t.Fatalf("stashes = %v, err = %v", entries, err)
			}
			if tt.message == "" {
				if !strings.HasPrefix(entries[0].Message, "WIP on ") {
					t.Fatalf("default message = %q", entries[0].Message)
				}
			} else if !strings.HasSuffix(entries[0].Message, ": "+tt.message) {
				t.Fatalf("message = %q, want suffix %q", entries[0].Message, tt.message)
			}
			if got := creationGit(t, dir, "show", "stash@{0}:tracked"); got != "working" {
				t.Fatalf("stash working tree content = %q", got)
			}
			if got := creationGit(t, dir, "show", "stash@{0}^2:tracked"); got != "staged" {
				t.Fatalf("stash index content = %q", got)
			}
			if got := creationGit(t, dir, "status", "--porcelain"); (got == "") != tt.includeUntracked {
				t.Fatalf("status after stash = %q", got)
			}
			_, err = os.Stat(filepath.Join(dir, "untracked"))
			if tt.includeUntracked && !os.IsNotExist(err) || !tt.includeUntracked && err != nil {
				t.Fatalf("untracked file after stash: %v", err)
			}
			if _, err := os.Stat(filepath.Join(dir, "injected")); !os.IsNotExist(err) {
				t.Fatalf("message executed as a shell command: %v", err)
			}

			creationGit(t, dir, "stash", "pop", "--index")
			for file, want := range map[string]string{"tracked": "working\n", "untracked": "untracked content\n"} {
				got, err := os.ReadFile(filepath.Join(dir, file))
				if err != nil || string(got) != want {
					t.Fatalf("restored %s = %q, err = %v", file, got, err)
				}
			}
			if got := creationGit(t, dir, "show", ":tracked"); got != "staged" {
				t.Fatalf("restored index content = %q", got)
			}
		})
	}
}

func TestCreateStashOnlyUntracked(t *testing.T) {
	dir := initRepo(t)
	creationWrite(t, dir, "untracked", "content\n")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("", true); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "untracked")); !os.IsNotExist(err) {
		t.Fatalf("untracked file was not stashed: %v", err)
	}
	if got := creationGit(t, dir, "show", "stash@{0}^3:untracked"); got != "content" {
		t.Fatalf("stashed untracked content = %q", got)
	}
}

func TestCreateStashRejectsNoChanges(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("", false); err == nil || !strings.Contains(err.Error(), "no new stash entry") {
		t.Fatalf("clean worktree: expected no-changes error, got %v", err)
	}
	creationWrite(t, dir, "untracked", "content\n")
	if err := repo.CreateStash("message", false); err == nil || !strings.Contains(err.Error(), "no new stash entry") {
		t.Fatalf("only untracked with option disabled: expected no-changes error, got %v", err)
	}
	if got := creationGit(t, dir, "stash", "list"); got != "" {
		t.Fatalf("unexpected stash: %q", got)
	}
	if err := repo.CreateStash("message", true); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("", true); err == nil || !strings.Contains(err.Error(), "no new stash entry") {
		t.Fatalf("existing stash and clean worktree: expected no-changes error, got %v", err)
	}
	if entries, err := repo.ListStashes(); err != nil || len(entries) != 1 {
		t.Fatalf("existing stash changed: entries = %v, err = %v", entries, err)
	}
}

func TestCreateStashWithIdenticalCommitHash(t *testing.T) {
	// Recreating the same stash at the same timestamp can reuse its object hash.
	t.Setenv("GIT_AUTHOR_DATE", "2024-01-01T00:00:00Z")
	t.Setenv("GIT_COMMITTER_DATE", "2024-01-01T00:00:00Z")
	dir := initRepo(t)
	addCommit(t, dir, "tracked", "base\n", "tracked")
	creationWrite(t, dir, "tracked", "changed\n")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("same", false); err != nil {
		t.Fatal(err)
	}
	first := creationGit(t, dir, "rev-parse", "refs/stash")
	creationGit(t, dir, "stash", "apply")
	createErr := repo.CreateStash("same", false)
	if second := creationGit(t, dir, "rev-parse", "refs/stash"); second != first {
		t.Fatalf("test did not reproduce identical hash: first %s, second %s", first, second)
	}
	entries, err := repo.ListStashes()
	if err != nil {
		t.Fatal(err)
	}
	// Git versions may or may not append a reflog entry when the hash is
	// unchanged. Report success only if a new entry is actually visible.
	switch len(entries) {
	case 1:
		if createErr == nil || !strings.Contains(createErr.Error(), "no new stash entry") {
			t.Fatalf("missing new stash entry should be an error: %v", createErr)
		}
	case 2:
		if createErr != nil {
			t.Fatalf("new reflog entry with identical hash: %v", createErr)
		}
	default:
		t.Fatalf("unexpected stashes: %v", entries)
	}
	if got := creationGit(t, dir, "show", "stash@{0}:tracked"); got != "changed" {
		t.Fatalf("existing stash no longer contains the changes: %q", got)
	}
}

func TestCreateStashReturnsGitError(t *testing.T) {
	dir := t.TempDir()
	creationGit(t, dir, "init") // An unborn repository cannot be stashed.
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	creationWrite(t, dir, "untracked", "content\n")
	if err := repo.CreateStash("message", true); err == nil || !strings.Contains(err.Error(), "git") {
		t.Fatalf("expected Git error, got %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "untracked")); err != nil {
		t.Fatalf("failed stash changed worktree: %v", err)
	}
}

func TestCreateTag(t *testing.T) {
	dir := initRepo(t)
	first := creationGit(t, dir, "rev-parse", "HEAD")
	creationGit(t, dir, "commit", "--allow-empty", "-m", "second")
	head := creationGit(t, dir, "rev-parse", "HEAD")
	creationGit(t, dir, "config", "tag.gpgSign", "true")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateTag("release/old", first); err != nil {
		t.Fatal(err)
	}
	if got := creationGit(t, dir, "rev-parse", "refs/tags/release/old"); got != first || got == head {
		t.Fatalf("tag = %q, first = %q, HEAD = %q", got, first, head)
	}
	if got := creationGit(t, dir, "cat-file", "-t", "refs/tags/release/old"); got != "commit" {
		t.Fatalf("tag is not lightweight: object type = %q", got)
	}
	if err := repo.CreateTag("release/head", head); err != nil {
		t.Fatal(err)
	}
	if got := creationGit(t, dir, "rev-parse", "refs/tags/release/head"); got != head {
		t.Fatalf("HEAD tag = %q, want %q", got, head)
	}
}

func TestCreateTagRejectsInvalidInputs(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	head := creationGit(t, dir, "rev-parse", "HEAD")
	tree := creationGit(t, dir, "rev-parse", "HEAD^{tree}")
	creationWrite(t, dir, "blob", "blob content\n")
	blob := creationGit(t, dir, "hash-object", "-w", "blob")
	creationGit(t, dir, "-c", "tag.gpgSign=false", "tag", "-a", "temporary", "-m", "annotated", head)
	annotated := creationGit(t, dir, "rev-parse", "refs/tags/temporary")
	creationGit(t, dir, "tag", "-d", "temporary")
	if err := repo.CreateTag("existing", head); err != nil {
		t.Fatal(err)
	}
	before := creationGit(t, dir, "rev-parse", "refs/tags/existing")
	for _, tt := range []struct{ name, target string }{
		{"", head},
		{"missing-target", ""},
		{"existing", head},
		{"invalid name", head},
		{"invalid-target", "nonexistent-revision"},
		{"-d", head},
		{"option-target", "--list"},
		{"symbolic", "HEAD"},
		{"abbreviated", head[:7]},
		{"tree", tree},
		{"blob", blob},
		{"tag-object", annotated},
		{"unknown", strings.Repeat("0", len(head))},
		{"non-hex", strings.Repeat("z", len(head))},
		{"bad\x00name", head},
	} {
		t.Run(tt.name+"/"+tt.target, func(t *testing.T) {
			if err := repo.CreateTag(tt.name, tt.target); err == nil {
				t.Fatalf("CreateTag(%q, %q) unexpectedly succeeded", tt.name, tt.target)
			}
		})
	}
	if got := creationGit(t, dir, "rev-parse", "refs/tags/existing"); got != before {
		t.Fatalf("existing tag was changed: %q", got)
	}
	if got := creationGit(t, dir, "tag", "--list"); got != "existing" {
		t.Fatalf("unexpected tags created: %q", got)
	}
}
