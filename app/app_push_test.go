package main

import (
	"os/exec"
	"strings"
	"testing"

	gitpkg "bough/git"
)

func TestPushRequiresConfirmationAndPreservesNormalPush(t *testing.T) {
	dir := t.TempDir()
	remote := t.TempDir()
	run := func(path string, args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = path
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	run(remote, "init", "--bare")
	run(dir, "init")
	run(dir, "config", "user.name", "Test")
	run(dir, "config", "user.email", "test@example.com")
	run(dir, "commit", "--allow-empty", "-m", "initial")
	run(dir, "remote", "add", "publish", remote)
	run(dir, "config", "push.autoSetupRemote", "true")
	repo, err := gitpkg.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	app := &App{repo: repo}
	info, err := app.GetPushInfo()
	if err != nil {
		t.Fatal(err)
	}
	if err := app.Push("", "", false); err == nil || !strings.Contains(err.Error(), "confirm creation") {
		t.Fatalf("unconfirmed push error = %v", err)
	}
	if got := run(remote, "for-each-ref"); got != "" {
		t.Fatalf("unconfirmed push wrote remote: %s", got)
	}
	if err := app.PushWithUpstream(info.RepoPath, "publish", info.Branch); err != nil {
		t.Fatal(err)
	}
	run(dir, "commit", "--allow-empty", "-m", "next")
	if err := app.Push("", "", false); err != nil {
		t.Fatalf("normal tracked push: %v", err)
	}
	if got := run(remote, "rev-parse", "refs/heads/"+info.Branch); got != run(dir, "rev-parse", "HEAD") {
		t.Fatal("tracked push did not advance upstream")
	}
	run(dir, "checkout", "--detach")
	if err := app.Push("", "", false); err == nil || !strings.Contains(err.Error(), "detached HEAD") {
		t.Fatalf("detached push error = %v", err)
	}
}
