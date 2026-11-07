package git_test

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"bough/git"
)

func pushGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func TestCreateUpstreamPush(t *testing.T) {
	dir := initRepo(t)
	remote := t.TempDir()
	other := t.TempDir()
	pushGit(t, remote, "init", "--bare")
	pushGit(t, other, "init", "--bare")
	pushGit(t, dir, "checkout", "-b", "feature/publish")
	pushGit(t, dir, "remote", "add", "origin", other)
	pushGit(t, dir, "remote", "add", "selected", remote)
	// Neither auto-setup nor custom push refspecs may bypass confirmation or
	// change the branch chosen by the confirmed operation.
	pushGit(t, dir, "config", "push.autoSetupRemote", "true")
	pushGit(t, dir, "config", "remote.selected.push", "refs/heads/feature/publish:refs/heads/wrong")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	info, err := repo.GetPushInfo()
	if err != nil {
		t.Fatal(err)
	}
	if info.Upstream != "" || info.Branch != "feature/publish" || strings.Join(info.Remotes, ",") != "origin,selected" {
		t.Fatalf("unexpected preflight: %+v", info)
	}
	if got := pushGit(t, remote, "for-each-ref", "refs/heads/"); got != "" {
		t.Fatalf("preflight wrote remote: %s", got)
	}
	if err := repo.PushWithUpstream(info.RepoPath, "selected", info.Branch); err != nil {
		t.Fatal(err)
	}
	if got := pushGit(t, dir, "rev-parse", "--abbrev-ref", "@{upstream}"); got != "selected/feature/publish" {
		t.Fatalf("upstream = %s", got)
	}
	if got := pushGit(t, remote, "for-each-ref", "--format=%(refname)"); got != "refs/heads/feature/publish" {
		t.Fatalf("remote refs = %s", got)
	}
	if got := pushGit(t, other, "for-each-ref"); got != "" {
		t.Fatalf("pushed unselected remote: %s", got)
	}
	// A subsequent normal push continues using Git's existing upstream behavior.
	pushGit(t, dir, "config", "--unset", "remote.selected.push")
	pushGit(t, dir, "commit", "--allow-empty", "-m", "next")
	pushGit(t, dir, "push")
	if got := pushGit(t, remote, "rev-parse", "refs/heads/feature/publish"); got != pushGit(t, dir, "rev-parse", "HEAD") {
		t.Fatal("normal push did not advance upstream")
	}
	// Missing remote-tracking refs are not mistaken for missing configuration.
	pushGit(t, dir, "update-ref", "-d", "refs/remotes/selected/feature/publish")
	info, err = repo.GetPushInfo()
	if err != nil || info.Upstream != "selected/feature/publish" {
		t.Fatalf("configured upstream lost: %+v, %v", info, err)
	}
}

func TestCreateUpstreamRejectsStaleOrInvalidConfirmation(t *testing.T) {
	for _, scenario := range []string{"repository", "branch", "detached", "upstream", "no remotes", "unknown remote"} {
		t.Run(scenario, func(t *testing.T) {
			dir := initRepo(t)
			remote := t.TempDir()
			pushGit(t, remote, "init", "--bare")
			pushGit(t, dir, "remote", "add", "publish", remote)
			repo, err := git.Open(dir)
			if err != nil {
				t.Fatal(err)
			}
			info, err := repo.GetPushInfo()
			if err != nil {
				t.Fatal(err)
			}
			selected := "publish"
			switch scenario {
			case "repository":
				info.RepoPath = t.TempDir()
			case "branch":
				pushGit(t, dir, "checkout", "-b", "different")
			case "detached":
				pushGit(t, dir, "checkout", "--detach")
			case "upstream":
				pushGit(t, dir, "config", "branch."+info.Branch+".remote", "publish")
				pushGit(t, dir, "config", "branch."+info.Branch+".merge", "refs/heads/another")
			case "no remotes":
				pushGit(t, dir, "remote", "remove", "publish")
			case "unknown remote":
				selected = remote // URLs/paths cannot bypass remote selection.
			}
			if err := repo.PushWithUpstream(info.RepoPath, selected, info.Branch); err == nil {
				t.Fatal("expected confirmation validation failure")
			}
			if got := pushGit(t, remote, "for-each-ref"); got != "" {
				t.Fatalf("unexpected write: %s", got)
			}
		})
	}
}

func TestPushInfoNoRemotesDetachedAndLinkedWorktree(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	info, err := repo.GetPushInfo()
	if err != nil || len(info.Remotes) != 0 {
		t.Fatalf("no remotes: %+v, %v", info, err)
	}
	linked := filepath.Join(t.TempDir(), "linked")
	pushGit(t, dir, "worktree", "add", "-b", "linked", linked)
	linkedRepo, err := git.Open(linked)
	if err != nil {
		t.Fatal(err)
	}
	info, err = linkedRepo.GetPushInfo()
	if err != nil || info.Branch != "linked" {
		t.Fatalf("linked: %+v, %v", info, err)
	}
	pushGit(t, linked, "checkout", "--detach")
	if _, err := linkedRepo.GetPushInfo(); err == nil || !strings.Contains(err.Error(), "detached HEAD") {
		t.Fatalf("detached error = %v", err)
	}
}

func TestCreateUpstreamFailedPushDoesNotSetTracking(t *testing.T) {
	dir := initRepo(t)
	remote := t.TempDir()
	pushGit(t, remote, "init", "--bare")
	pushGit(t, dir, "remote", "add", "publish", remote)
	if err := os.WriteFile(filepath.Join(remote, "hooks", "pre-receive"), []byte("#!/bin/sh\nexit 1\n"), 0755); err != nil {
		t.Fatal(err)
	}
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	info, err := repo.GetPushInfo()
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.PushWithUpstream(info.RepoPath, "publish", info.Branch); err == nil {
		t.Fatal("expected rejected push")
	}
	info, err = repo.GetPushInfo()
	if err != nil || info.Upstream != "" {
		t.Fatalf("failed push configured upstream: %+v, %v", info, err)
	}
	// Simulate the same CLI auth diagnostic handled by existing Push. The new
	// operation must preserve the sentinel rather than exposing a different flow.
	if err := os.WriteFile(filepath.Join(remote, "hooks", "pre-receive"), []byte("#!/bin/sh\necho 'authentication failed' >&2\nexit 1\n"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := repo.PushWithUpstream(info.RepoPath, "publish", info.Branch); !errors.Is(err, git.ErrAuthFailed) {
		t.Fatalf("auth error = %v, want ErrAuthFailed", err)
	}
}
