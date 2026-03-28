package git

import (
	"errors"
	"path/filepath"
	"strings"

	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

type Repository struct {
	repo *gogit.Repository
	Path string // absolute path to the worktree root
}

// Open opens a git repository, searching upward for .git if needed.
func Open(path string) (*Repository, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	repo, err := gogit.PlainOpenWithOptions(abs, &gogit.PlainOpenOptions{
		DetectDotGit:          true,
		EnableDotGitCommonDir: true, // required for linked worktrees
	})
	if err != nil {
		if errors.Is(err, gogit.ErrRepositoryNotExists) {
			return nil, ErrNotARepo
		}
		return nil, err
	}
	// Resolve the actual worktree path (not the .git path)
	wt, err := repo.Worktree()
	if err != nil {
		return nil, err
	}
	return &Repository{repo: repo, Path: wt.Filesystem.Root()}, nil
}

var ErrNotARepo = errors.New("not a git repository")

// CurrentBranch returns the name of the currently checked-out branch,
// or "HEAD" if in detached HEAD state.
func (r *Repository) CurrentBranch() (string, error) {
	head, err := r.repo.Head()
	if err != nil {
		return "", err
	}
	if head.Name().IsBranch() {
		return head.Name().Short(), nil
	}
	return "HEAD", nil // detached HEAD
}

// Status returns the current working copy status using git status --porcelain=v1.
// Using CLI avoids a go-git panic in path.Clean for certain file paths.
func (r *Repository) Status() (RepoStatus, error) {
	out, err := CLI(r.Path, "status", "--porcelain=v1")
	if err != nil {
		return RepoStatus{}, err
	}

	branch, _ := r.CurrentBranch()
	var files []FileStatus
	hasConflicts := false

	for _, line := range strings.Split(out, "\n") {
		if len(line) < 4 {
			continue
		}
		x := string(line[0]) // index (staged) status code
		y := string(line[1]) // worktree (unstaged) status code
		rest := line[3:]     // path info, after "XY "

		filePath := rest
		oldPath := ""

		// Renames/copies: "old-path\tnew-path"
		if tab := strings.IndexByte(rest, '\t'); tab >= 0 {
			oldPath = rest[:tab]
			filePath = rest[tab+1:]
		}

		staged := x
		unstaged := y
		// Untracked: both columns are "?" — normalise to staged="?", unstaged=""
		if x == "?" && y == "?" {
			staged = "?"
			unstaged = ""
		}
		// Space means "no change in this area" — normalise to empty string
		if staged == " " {
			staged = ""
		}
		if unstaged == " " {
			unstaged = ""
		}
		if staged == "U" || unstaged == "U" {
			hasConflicts = true
		}

		files = append(files, FileStatus{
			Path:     filePath,
			OldPath:  oldPath,
			Staged:   staged,
			Unstaged: unstaged,
		})
	}

	// Expand untracked directory entries (e.g. "newdir/") into individual files.
	// git status --porcelain collapses new directories to a single "?? dir/" entry.
	files = expandUntrackedDirs(r.Path, files)

	return RepoStatus{
		Branch:       branch,
		Files:        files,
		HasConflicts: hasConflicts,
	}, nil
}

// expandUntrackedDirs replaces untracked directory entries (path ending with "/")
// with the individual files inside them, using git ls-files --others.
func expandUntrackedDirs(repoPath string, files []FileStatus) []FileStatus {
	result := make([]FileStatus, 0, len(files))
	for _, f := range files {
		if f.Staged == "?" && strings.HasSuffix(f.Path, "/") {
			expanded := listUntrackedInDir(repoPath, f.Path)
			if len(expanded) > 0 {
				result = append(result, expanded...)
				continue
			}
		}
		result = append(result, f)
	}
	return result
}

// listUntrackedInDir returns individual untracked files inside dir using
// git ls-files --others --exclude-standard. Paths are relative to the repo root.
func listUntrackedInDir(repoPath, dir string) []FileStatus {
	out, err := CLI(repoPath, "ls-files", "--others", "--exclude-standard", "--", dir)
	if err != nil || strings.TrimSpace(out) == "" {
		return nil
	}
	var files []FileStatus
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		files = append(files, FileStatus{Path: line, Staged: "?", Unstaged: ""})
	}
	return files
}

// Head returns the current HEAD hash.
func (r *Repository) Head() (*plumbing.Reference, error) {
	return r.repo.Head()
}
