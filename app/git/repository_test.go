package git_test

import (
	"os"
	"path/filepath"
	"testing"

	"bough/git"
)

func TestOpen(t *testing.T) {
	dir := initRepo(t)
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if repo.Path == "" {
		t.Fatal("repo.Path is empty")
	}
}

func TestOpen_DetectsDotGit(t *testing.T) {
	// Open should walk up and find the repo when given a subdirectory
	dir := initRepo(t)
	sub := filepath.Join(dir, "sub")
	if err := os.MkdirAll(sub, 0755); err != nil {
		t.Fatal(err)
	}
	repo, err := git.Open(sub)
	if err != nil {
		t.Fatalf("Open from subdirectory: %v", err)
	}
	if repo.Path != dir {
		t.Errorf("Path = %q, want %q", repo.Path, dir)
	}
}

func TestOpen_NotARepo(t *testing.T) {
	_, err := git.Open(t.TempDir())
	if err != git.ErrNotARepo {
		t.Errorf("expected ErrNotARepo, got %v", err)
	}
}

func TestCurrentBranch(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	branch, err := repo.CurrentBranch()
	if err != nil {
		t.Fatalf("CurrentBranch: %v", err)
	}
	if branch == "" {
		t.Error("branch name is empty")
	}
}

func TestStatus_CleanRepo(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	status, err := repo.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if status.Branch == "" {
		t.Error("branch is empty")
	}
	if len(status.Files) != 0 {
		t.Errorf("expected clean working tree, got %d file(s)", len(status.Files))
	}
}

func TestStatus_UntrackedFile(t *testing.T) {
	dir := initRepo(t)
	repo, _ := git.Open(dir)

	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	status, err := repo.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if len(status.Files) == 0 {
		t.Fatal("expected at least one file in dirty status")
	}
}
