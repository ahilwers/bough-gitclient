package git_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"bough/git"
)

func TestGetStashDiffIncludesUntracked(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "tracked", "before\n", "tracked")
	creationWrite(t, dir, "tracked", "after\n")
	creationWrite(t, dir, "new file.txt", "new content\n")
	creationWrite(t, dir, "binary.bin", "\x00\x01binary")
	creationWrite(t, dir, "empty", "")
	creationWrite(t, dir, "ü.txt", "unicode\n")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("all", true); err != nil {
		t.Fatal(err)
	}
	files, err := repo.GetStashDiff(0)
	if err != nil {
		t.Fatal(err)
	}
	byPath := make(map[string]git.DiffFile)
	for _, file := range files {
		byPath[file.Path] = file
	}
	for _, name := range []string{"tracked", "new file.txt", "binary.bin", "empty", "ü.txt"} {
		if _, ok := byPath[name]; !ok {
			t.Errorf("%q missing from stash diff: %+v", name, files)
		}
	}
	if !byPath["binary.bin"].Binary {
		t.Errorf("binary file not marked binary: %+v", byPath["binary.bin"])
	}
	for _, name := range []string{"tracked", "new file.txt", "ü.txt"} {
		if len(byPath[name].Hunks) == 0 {
			t.Errorf("%q has no hunks", name)
		}
	}
	if _, err := repo.GetStashDiff(99); err == nil {
		t.Fatal("missing stash should return an error")
	}
}

func TestApplyUntrackedStashFile(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "tracked", "before\n", "tracked")
	creationWrite(t, dir, "tracked", "after\n")
	if err := os.MkdirAll(filepath.Join(dir, "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	creationWrite(t, dir, "nested/new file.txt", "untracked\x00content\n")
	creationWrite(t, dir, "nested/a*.txt", "literal wildcard\n")
	creationWrite(t, dir, "nested/other.txt", "other\n")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("all", true); err != nil {
		t.Fatal(err)
	}
	if err := repo.ApplyStashFile(0, "nested/new file.txt"); err != nil {
		t.Fatalf("restore untracked: %v", err)
	}
	if err := repo.ApplyStashFile(0, "nested/a*.txt"); err != nil {
		t.Fatalf("restore literal wildcard: %v", err)
	}
	for path, want := range map[string]string{
		"nested/new file.txt": "untracked\x00content\n",
		"nested/a*.txt":       "literal wildcard\n",
	} {
		got, err := os.ReadFile(filepath.Join(dir, path))
		if err != nil || string(got) != want {
			t.Fatalf("%s = %q, err = %v", path, got, err)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, "nested/other.txt")); !os.IsNotExist(err) {
		t.Fatalf("restoring a single path affected another file: %v", err)
	}
	if got := creationGit(t, dir, "ls-files", "--", "nested"); got != "" {
		t.Fatalf("restoring untracked files staged them: %q", got)
	}
	if err := repo.ApplyStashFile(0, "nested/new file.txt"); err == nil {
		t.Fatal("restoring over existing untracked file should fail")
	}
	creationWrite(t, dir, "nested/other.txt", "current\n")
	creationGit(t, dir, "add", "nested/other.txt")
	if err := os.Remove(filepath.Join(dir, "nested/other.txt")); err != nil {
		t.Fatal(err)
	}
	if err := repo.ApplyStashFile(0, "nested/other.txt"); err == nil {
		t.Fatal("restoring over a path tracked in the index should fail")
	}
	if got := creationGit(t, dir, "show", ":nested/other.txt"); got != "current" {
		t.Fatalf("index was changed: %q", got)
	}
	if err := repo.ApplyStashFile(0, "tracked"); err != nil {
		t.Fatalf("restore tracked file: %v", err)
	}
	if got := creationGit(t, dir, "show", ":tracked"); got != "after" {
		t.Fatalf("tracked checkout behavior changed: %q", got)
	}
	for _, path := range []string{"", ".", "../outside", "nested", "missing", "nested/../tracked"} {
		if err := repo.ApplyStashFile(0, path); err == nil {
			t.Errorf("unexpected success for path %q", path)
		}
	}
	if err := repo.ApplyStashFile(99, "nested/new file.txt"); err == nil {
		t.Fatal("missing stash should return an error")
	}
}

func TestApplyUntrackedStashFileRejectsSymlinkParent(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("creating symlinks requires elevated permissions on Windows")
	}
	dir := initRepo(t)
	outside := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	creationWrite(t, dir, "nested/file", "stash\n")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("", true); err != nil {
		t.Fatal(err)
	}
	// Git may leave the now-empty directory behind.
	if err := os.RemoveAll(filepath.Join(dir, "nested")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(dir, "nested")); err != nil {
		t.Fatal(err)
	}
	if err := repo.ApplyStashFile(0, "nested/file"); err == nil {
		t.Fatal("restoring through a symlink should fail")
	}
	if _, err := os.Stat(filepath.Join(outside, "file")); !os.IsNotExist(err) {
		t.Fatalf("outside file was written: %v", err)
	}
}

func TestApplyStashFileWithoutUntrackedParent(t *testing.T) {
	dir := initRepo(t)
	addCommit(t, dir, "tracked", "before\n", "tracked")
	creationWrite(t, dir, "tracked", "after\n")
	repo, err := git.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateStash("", false); err != nil {
		t.Fatal(err)
	}
	if err := repo.ApplyStashFile(0, "missing"); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("missing file should return a not-found error: %v", err)
	}
}
