package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func pullGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func pullFixture(t *testing.T, divergent, conflict bool) *Repository {
	t.Helper()
	t.Setenv("GIT_CONFIG_NOSYSTEM", "1")
	t.Setenv("GIT_CONFIG_GLOBAL", os.DevNull)
	t.Setenv("LC_ALL", "de_DE.UTF-8")
	root := t.TempDir()
	remote := filepath.Join(root, "remote.git")
	local := filepath.Join(root, "local")
	peer := filepath.Join(root, "peer")
	pullGit(t, root, "init", "--bare", "--initial-branch=main", remote)
	pullGit(t, root, "clone", remote, local)
	for _, dir := range []string{local} {
		pullGit(t, dir, "config", "user.name", "Test")
		pullGit(t, dir, "config", "user.email", "test@example.com")
	}
	commit := func(dir, file, text string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, file), []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
		pullGit(t, dir, "add", file)
		pullGit(t, dir, "commit", "-m", text)
	}
	commit(local, "base", "base\n")
	pullGit(t, local, "push", "-u", "origin", "main")
	pullGit(t, root, "clone", remote, peer)
	pullGit(t, peer, "config", "user.name", "Test")
	pullGit(t, peer, "config", "user.email", "test@example.com")
	if divergent {
		file := "local"
		if conflict {
			file = "base"
		}
		commit(local, file, "local\n")
	}
	file := "remote"
	if conflict {
		file = "base"
	}
	commit(peer, file, "remote\n")
	pullGit(t, peer, "push")
	r, err := Open(local)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestPullStrategies(t *testing.T) {
	for _, ffOnly := range []bool{false, true} {
		for _, strategy := range []string{"merge", "rebase"} {
			t.Run(strategy+map[bool]string{false: "default", true: "ff-only"}[ffOnly], func(t *testing.T) {
				r := pullFixture(t, true, false)
				if ffOnly {
					pullGit(t, r.Path, "config", "pull.ff", "only")
				}
				configBefore, _ := os.ReadFile(filepath.Join(r.Path, ".git", "config"))
				head := pullGit(t, r.Path, "rev-parse", "HEAD")
				result, err := r.PullForUI(r.Path, "main")
				if err != nil || result.Outcome != "choice" {
					t.Fatalf("%+v %v", result, err)
				}
				if pullGit(t, r.Path, "rev-parse", "HEAD") != head {
					t.Fatal("prompt integrated commits")
				}
				// Cancel is intentionally no IPC call: local refs/index/config stay intact.
				for _, invalid := range []string{"", "reset", "--rebase"} {
					if _, err := r.ResolvePull(*result.Snapshot, invalid); err == nil {
						t.Fatal("accepted invalid strategy")
					}
				}
				stale := *result.Snapshot
				stale.Branch = "other"
				if _, err := r.ResolvePull(stale, strategy); err == nil {
					t.Fatal("accepted stale branch")
				}
				stale = *result.Snapshot
				stale.Repo = "/other"
				if _, err := r.ResolvePull(stale, strategy); err == nil {
					t.Fatal("accepted stale repo")
				}
				stale = *result.Snapshot
				stale.Head = "bad"
				if _, err := r.ResolvePull(stale, strategy); err == nil {
					t.Fatal("accepted stale tip")
				}
				if pullGit(t, r.Path, "rev-parse", "HEAD") != head {
					t.Fatal("validation wrote refs")
				}
				result, err = r.ResolvePull(*result.Snapshot, strategy)
				if err != nil || result.Outcome != "success" {
					t.Fatalf("%+v %v", result, err)
				}
				parents := strings.Fields(pullGit(t, r.Path, "rev-list", "--parents", "-n", "1", "HEAD"))
				want := 2
				if strategy == "merge" {
					want = 3
				}
				if len(parents) != want {
					t.Fatalf("parents %v", parents)
				}
				configAfter, _ := os.ReadFile(filepath.Join(r.Path, ".git", "config"))
				if string(configAfter) != string(configBefore) {
					t.Fatal("changed config")
				}
			})
		}
	}
}

func TestPullConflictsAndAbort(t *testing.T) {
	for _, strategy := range []string{"merge", "rebase"} {
		t.Run(strategy, func(t *testing.T) {
			r := pullFixture(t, true, true)
			head := pullGit(t, r.Path, "rev-parse", "HEAD")
			result, err := r.PullForUI(r.Path, "main")
			if err != nil || result.Snapshot == nil {
				t.Fatalf("%+v %v", result, err)
			}
			result, err = r.ResolvePull(*result.Snapshot, strategy)
			if err != nil || result.Outcome != "conflict" {
				t.Fatalf("%+v %v", result, err)
			}
			if strategy == "merge" {
				err = r.AbortMerge()
			} else {
				err = r.AbortRebase()
			}
			if err != nil {
				t.Fatal(err)
			}
			if pullGit(t, r.Path, "rev-parse", "HEAD") != head {
				t.Fatal("abort did not restore head")
			}
		})
	}
}

func TestPullFastForwardAndConfiguredMerge(t *testing.T) {
	for _, divergent := range []bool{false, true} {
		t.Run(map[bool]string{false: "ff", true: "configured"}[divergent], func(t *testing.T) {
			r := pullFixture(t, divergent, false)
			pullGit(t, r.Path, "config", "pull.rebase", "false")
			result, err := r.PullForUI(r.Path, "main")
			if err != nil || result.Outcome != "success" {
				t.Fatalf("%+v %v", result, err)
			}
		})
	}
}

func TestPullFailureIsNotDivergence(t *testing.T) {
	r := pullFixture(t, true, false)
	pullGit(t, r.Path, "remote", "set-url", "origin", filepath.Join(t.TempDir(), "missing"))
	result, err := r.PullForUI(r.Path, "main")
	if err == nil || result.Outcome == "choice" {
		t.Fatalf("%+v %v", result, err)
	}
}

func TestPullRejectsRealBranchSwitch(t *testing.T) {
	r := pullFixture(t, true, false)
	result, err := r.PullForUI(r.Path, "main")
	if err != nil || result.Snapshot == nil {
		t.Fatalf("%+v %v", result, err)
	}
	pullGit(t, r.Path, "checkout", "-b", "other")
	before := pullGit(t, r.Path, "rev-parse", "HEAD")
	if _, err := r.ResolvePull(*result.Snapshot, "merge"); err == nil {
		t.Fatal("accepted branch switch")
	}
	if pullGit(t, r.Path, "rev-parse", "HEAD") != before {
		t.Fatal("wrote after branch switch")
	}
}
