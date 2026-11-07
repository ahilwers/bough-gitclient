package main

import (
	"errors"
	"os/exec"
	"strings"
	"testing"

	gitpkg "bough/git"
)

func TestCreateStashAndTagWithoutRepository(t *testing.T) {
	app := NewApp()
	if err := app.CreateStash("", true); !errors.Is(err, gitpkg.ErrNotARepo) {
		t.Fatalf("CreateStash error = %v", err)
	}
	if err := app.CreateTag("tag", "HEAD"); !errors.Is(err, gitpkg.ErrNotARepo) {
		t.Fatalf("CreateTag error = %v", err)
	}
}

func TestCreateStashAndTagForwardErrors(t *testing.T) {
	dir := t.TempDir()
	run := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	run("init")
	run("config", "user.name", "Test User")
	run("config", "user.email", "test@example.com")
	run("commit", "--allow-empty", "-m", "initial")
	repo, err := gitpkg.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	// Failed operations must return before attempting to emit a Wails event.
	app := &App{repo: repo}
	if err := app.CreateStash("", false); err == nil || !strings.Contains(err.Error(), "no new stash entry") {
		t.Fatalf("empty stash error = %v", err)
	}
	if err := app.CreateTag("tag", "HEAD"); err == nil || !strings.Contains(err.Error(), "full commit hash") {
		t.Fatalf("symbolic tag target error = %v", err)
	}
	head := run("rev-parse", "HEAD")
	run("tag", "existing", head)
	if err := app.CreateTag("existing", head); err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("duplicate tag error = %v", err)
	}
}
