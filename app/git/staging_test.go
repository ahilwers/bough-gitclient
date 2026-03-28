package git_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"bough/git"
)

func TestStageFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	// Write an untracked file
	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Before staging: file is untracked (staged="?")
	before, _ := repo.Status()
	untracked := filesByPath(before.Files, "new.txt")
	if len(untracked) == 0 {
		t.Fatal("new.txt not in status before staging")
	}

	if err := repo.StageFile("new.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	// After staging: file should have a non-empty Staged code
	after, _ := repo.Status()
	staged := filesByPath(after.Files, "new.txt")
	if len(staged) == 0 {
		t.Fatal("new.txt not in status after staging")
	}
	if staged[0].Staged == "" || staged[0].Staged == "?" {
		t.Errorf("Staged = %q after StageFile, expected A or M", staged[0].Staged)
	}
}

func TestUnstageFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("f.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	// Confirm it's staged
	status, _ := repo.Status()
	if files := filesByPath(status.Files, "f.txt"); len(files) == 0 || files[0].Staged == "?" {
		t.Fatal("expected f.txt to be staged")
	}

	if err := repo.UnstageFile("f.txt"); err != nil {
		t.Fatalf("UnstageFile: %v", err)
	}

	status, _ = repo.Status()
	unstaged := filesByPath(status.Files, "f.txt")
	if len(unstaged) > 0 && unstaged[0].Staged != "" && unstaged[0].Staged != "?" {
		t.Errorf("file still has Staged=%q after UnstageFile", unstaged[0].Staged)
	}
}

func TestCreateCommit(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	if err := os.WriteFile(filepath.Join(dir, "commit.txt"), []byte("content"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("commit.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	hash, err := repo.CreateCommit("test commit message")
	if err != nil {
		t.Fatalf("CreateCommit: %v", err)
	}
	if len(hash) != 40 {
		t.Errorf("hash length = %d, want 40", len(hash))
	}

	// Verify the commit appears in the log
	commits, _ := repo.GetCommits(10, true)
	if commits[0].Message != "test commit message" {
		t.Errorf("top commit message = %q, want %q", commits[0].Message, "test commit message")
	}
}

func TestStageHunk(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "hunk.txt", "line1\nline2\nline3\n", "initial")
	repo, _ := git.Open(dir)

	// Modify the file
	if err := os.WriteFile(filepath.Join(dir, "hunk.txt"), []byte("line1\nLINE2_CHANGED\nline3\n"), 0644); err != nil {
		t.Fatal(err)
	}

	diff, err := repo.GetFileDiff("hunk.txt", false)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected hunks for modified file")
	}

	// Build a minimal patch for the hunk
	patch := buildPatch("hunk.txt", diff.Hunks[0])
	if err := repo.StageHunkViaApply(patch); err != nil {
		t.Fatalf("StageHunkViaApply: %v", err)
	}

	// The file should now have staged changes
	status, _ := repo.Status()
	f := filesByPath(status.Files, "hunk.txt")
	if len(f) == 0 {
		t.Fatal("hunk.txt not in status after hunk staging")
	}
	if f[0].Staged == "" {
		t.Error("expected Staged to be set after StageHunkViaApply")
	}
}

func TestUnstageHunk(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "unstage.txt", "line1\nline2\nline3\n", "initial")
	repo, _ := git.Open(dir)

	// Modify and stage the file
	if err := os.WriteFile(filepath.Join(dir, "unstage.txt"), []byte("line1\nLINE2_CHANGED\nline3\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := repo.StageFile("unstage.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}

	// Confirm it's staged
	status, _ := repo.Status()
	f := filesByPath(status.Files, "unstage.txt")
	if len(f) == 0 || f[0].Staged == "" {
		t.Fatal("expected unstage.txt to be staged")
	}

	// Build patch from the staged diff and unstage the hunk
	diff, err := repo.GetFileDiff("unstage.txt", true)
	if err != nil {
		t.Fatalf("GetFileDiff (staged): %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected staged hunks")
	}
	patch := buildPatch("unstage.txt", diff.Hunks[0])
	if err := repo.UnstageHunkViaApply(patch); err != nil {
		t.Fatalf("UnstageHunkViaApply: %v", err)
	}

	// After unstaging, staged code should be empty, "?" or " " (unmodified)
	status, _ = repo.Status()
	f = filesByPath(status.Files, "unstage.txt")
	notStaged := map[string]bool{"": true, "?": true, " ": true}
	if len(f) > 0 && !notStaged[f[0].Staged] {
		t.Errorf("expected Staged to be empty/unmodified after UnstageHunkViaApply, got %q", f[0].Staged)
	}
}

func TestDiscardHunk(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "discard.txt", "line1\nline2\nline3\n", "initial")
	repo, _ := git.Open(dir)

	// Modify the file without staging
	if err := os.WriteFile(filepath.Join(dir, "discard.txt"), []byte("line1\nLINE2_CHANGED\nline3\n"), 0644); err != nil {
		t.Fatal(err)
	}

	diff, err := repo.GetFileDiff("discard.txt", false)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if len(diff.Hunks) == 0 {
		t.Fatal("expected hunks for modified file")
	}

	patch := buildPatch("discard.txt", diff.Hunks[0])
	if err := repo.DiscardHunk(patch); err != nil {
		t.Fatalf("DiscardHunk: %v", err)
	}

	// After discarding, the file should be back to original (no unstaged changes)
	after, _ := repo.GetFileDiff("discard.txt", false)
	if len(after.Hunks) > 0 {
		t.Error("expected no hunks after DiscardHunk")
	}
}

func TestAmendCommit(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "a.txt", "hello", "original message")

	repo, _ := git.Open(dir)
	if err := repo.AmendCommit("amended message"); err != nil {
		t.Fatalf("AmendCommit: %v", err)
	}

	commits, _ := repo.GetCommits(10, true)
	if commits[0].Message != "amended message" {
		t.Errorf("after amend: message = %q, want %q", commits[0].Message, "amended message")
	}
}

// --- helpers ---

func filesByPath(files []git.FileStatus, path string) []git.FileStatus {
	var out []git.FileStatus
	for _, f := range files {
		if f.Path == path {
			out = append(out, f)
		}
	}
	return out
}

// buildPatch constructs a minimal unified diff patch string for a single hunk.
func buildPatch(filePath string, hunk git.DiffHunk) string {
	var sb strings.Builder
	sb.WriteString("--- a/" + filePath + "\n")
	sb.WriteString("+++ b/" + filePath + "\n")
	sb.WriteString(hunk.Header + "\n")
	for _, line := range hunk.Lines {
		switch line.Type {
		case "add":
			sb.WriteString("+" + line.Content + "\n")
		case "del":
			sb.WriteString("-" + line.Content + "\n")
		default:
			sb.WriteString(" " + line.Content + "\n")
		}
	}
	return sb.String()
}
