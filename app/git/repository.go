package git

import (
	"errors"
	"path/filepath"

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

// Status returns the current working copy status.
func (r *Repository) Status() (RepoStatus, error) {
	wt, err := r.repo.Worktree()
	if err != nil {
		return RepoStatus{}, err
	}

	status, err := wt.Status()
	if err != nil {
		return RepoStatus{}, err
	}

	branch, _ := r.CurrentBranch()
	var files []FileStatus
	hasConflicts := false

	for path, s := range status {
		staged := string(s.Staging)
		unstaged := string(s.Worktree)
		if staged == "?" && unstaged == "?" {
			staged = "?"
			unstaged = ""
		}
		if staged == "U" || unstaged == "U" {
			hasConflicts = true
		}
		files = append(files, FileStatus{
			Path:     path,
			Staged:   staged,
			Unstaged: unstaged,
		})
	}

	return RepoStatus{
		Branch:       branch,
		Files:        files,
		HasConflicts: hasConflicts,
	}, nil
}

// Head returns the current HEAD hash.
func (r *Repository) Head() (*plumbing.Reference, error) {
	return r.repo.Head()
}
