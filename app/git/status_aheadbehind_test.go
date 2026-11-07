package git_test

import (
	"path/filepath"
	"strings"
	"testing"

	"bough/git"
)

// statusGit runs real Git commands against the temporary status fixtures.
func statusGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	out, err := git.CLI(dir, args...)
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(out)
}

// statusTrackingRepo creates actual commits on both sides of an upstream ref.
func statusTrackingRepo(t *testing.T, ahead, behind int) (string, *git.Repository) {
	t.Helper()
	dir := initRepo(t)
	statusGit(t, dir, "branch", "-M", "main")
	base := statusGit(t, dir, "rev-parse", "HEAD")
	statusGit(t, dir, "remote", "add", "origin", dir)
	for i := 0; i < behind; i++ {
		statusGit(t, dir, "commit", "--allow-empty", "-m", "Remote commit")
	}
	statusGit(t, dir, "update-ref", "refs/remotes/origin/main", "HEAD")
	statusGit(t, dir, "reset", "--hard", base)
	statusGit(t, dir, "branch", "--set-upstream-to=origin/main", "main")
	for i := 0; i < ahead; i++ {
		statusGit(t, dir, "commit", "--allow-empty", "-m", "Local commit")
	}
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	return dir, repo
}

func assertStatusTracking(t *testing.T, repo *git.Repository, branch string, ahead, behind int) {
	t.Helper()
	status, err := repo.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if status.Branch != branch || status.Ahead != ahead || status.Behind != behind {
		t.Errorf("Status branch/ahead/behind = %q/%d/%d, want %q/%d/%d",
			status.Branch, status.Ahead, status.Behind, branch, ahead, behind)
	}
}

func TestStatus_AheadBehind(t *testing.T) {
	for _, tt := range []struct {
		name          string
		ahead, behind int
	}{
		{"up-to-date", 0, 0},
		{"ahead", 2, 0},
		{"behind", 0, 3},
		{"diverged", 2, 3},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, repo := statusTrackingRepo(t, tt.ahead, tt.behind)
			assertStatusTracking(t, repo, "main", tt.ahead, tt.behind)
		})
	}
}

func TestStatus_AheadBehindCheckout(t *testing.T) {
	dir, repo := statusTrackingRepo(t, 2, 3)
	assertStatusTracking(t, repo, "main", 2, 3)
	statusGit(t, dir, "checkout", "-b", "synced", "--track", "origin/main")
	assertStatusTracking(t, repo, "synced", 0, 0)
	if err := repo.CheckoutBranch("main"); err != nil {
		t.Fatal(err)
	}
	assertStatusTracking(t, repo, "main", 2, 3)
}

func TestStatus_AheadBehindLinkedWorktree(t *testing.T) {
	dir, repo := statusTrackingRepo(t, 2, 3)
	linked := filepath.Join(t.TempDir(), "linked")
	statusGit(t, dir, "worktree", "add", "-b", "linked", linked, "origin/main")
	statusGit(t, linked, "branch", "--set-upstream-to=origin/main", "linked")
	statusGit(t, linked, "commit", "--allow-empty", "-m", "Linked commit")

	// Both opening a linked worktree and switching the existing Repository path
	// must use its HEAD, not the main worktree's diverged branch.
	linkedRepo, err := git.Open(linked)
	if err != nil {
		t.Fatal(err)
	}
	assertStatusTracking(t, linkedRepo, "linked", 1, 0)
	repo.SwitchPath(linked)
	assertStatusTracking(t, repo, "linked", 1, 0)
	repo.SwitchPath(dir)
	assertStatusTracking(t, repo, "main", 2, 3)
}

func TestStatus_AheadBehindWithoutUpstream(t *testing.T) {
	for _, gone := range []bool{false, true} {
		name := "no-upstream"
		if gone {
			name = "gone-upstream"
		}
		t.Run(name, func(t *testing.T) {
			dir, repo := statusTrackingRepo(t, 2, 3)
			assertStatusTracking(t, repo, "main", 2, 3)
			if gone {
				statusGit(t, dir, "update-ref", "-d", "refs/remotes/origin/main")
			} else {
				statusGit(t, dir, "branch", "--unset-upstream", "main")
			}
			// Local commits still exist, but do not imply an ahead count.
			assertStatusTracking(t, repo, "main", 0, 0)
		})
	}
}

func TestStatus_AheadBehindDetachedAndUnborn(t *testing.T) {
	dir, repo := statusTrackingRepo(t, 2, 3)
	statusGit(t, dir, "checkout", "--detach", "HEAD")
	assertStatusTracking(t, repo, "HEAD", 0, 0)
	statusGit(t, dir, "checkout", "--orphan", "unborn")
	assertStatusTracking(t, repo, "unborn", 0, 0)

	fresh := t.TempDir()
	statusGit(t, fresh, "init", "--initial-branch=empty")
	freshRepo, err := git.Open(fresh)
	if err != nil {
		t.Fatal(err)
	}
	assertStatusTracking(t, freshRepo, "empty", 0, 0)
}
