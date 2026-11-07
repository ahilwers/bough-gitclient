package git

import (
	"errors"
	"os"
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

var (
	ErrNotARepo                 = errors.New("not a git repository")
	ErrCannotRemoveMainWorktree = errors.New("cannot remove the main worktree")
)

// SwitchPath changes the working-directory path used for CLI operations
// without replacing the underlying go-git repository object. All worktrees
// share the same object store and refs; only the working directory and HEAD
// differ. Using CLI for HEAD-dependent operations (see GetCommits, CurrentBranch)
// ensures each worktree is handled correctly.
func (r *Repository) SwitchPath(newPath string) {
	r.Path = newPath
}

// CurrentBranch returns the name of the currently checked-out branch,
// or "HEAD" if in detached HEAD state.
// Uses CLI so the result is correct for linked worktrees.
// Falls back to symbolic-ref on empty repos (no commits yet).
func (r *Repository) CurrentBranch() (string, error) {
	out, err := CLI(r.Path, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		// rev-parse fails on a newly-initialised repo with no commits.
		// symbolic-ref still works in that case.
		if out2, err2 := CLI(r.Path, "symbolic-ref", "--short", "HEAD"); err2 == nil {
			return strings.TrimSpace(out2), nil
		}
		return "", err
	}
	branch := strings.TrimSpace(out)
	if branch == "HEAD" {
		return "HEAD", nil // detached HEAD
	}
	return branch, nil
}

// Status returns the current working copy status using git status --porcelain=v1.
// Using CLI avoids a go-git panic in path.Clean for certain file paths.
func (r *Repository) Status() (RepoStatus, error) {
	out, err := CLI(r.Path, "status", "--porcelain=v1")
	if err != nil {
		return RepoStatus{}, err
	}

	branch, _ := r.CurrentBranch()
	// Use the current worktree's branch, including after CLI checkouts.
	aheadBehind := r.fetchAheadBehind()[branch]
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
		// Conflict states: UU, AA, DD, AU, UA, DU, UD
		if staged == "U" || unstaged == "U" ||
			(staged == "A" && unstaged == "A") ||
			(staged == "D" && unstaged == "D") {
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

	// Count conflicts and detect merge state.
	conflictCount := 0
	for _, f := range files {
		if isConflictedFile(f) {
			conflictCount++
		}
	}
	mergeState := r.DetectMergeState(conflictCount)
	var cherryPickState *CherryPickState
	var rebaseState *RebaseState
	if mergeState == nil {
		cherryPickState = r.DetectCherryPickState(conflictCount)
		if cherryPickState == nil {
			rebaseState = r.DetectRebaseState(conflictCount)
		}
	}

	return RepoStatus{
		Branch:          branch,
		Ahead:           aheadBehind[0],
		Behind:          aheadBehind[1],
		Files:           files,
		HasConflicts:    hasConflicts,
		MergeState:      mergeState,
		CherryPickState: cherryPickState,
		RebaseState:     rebaseState,
	}, nil
}

// isConflictedFile reports whether f has unresolved merge conflicts.
func isConflictedFile(f FileStatus) bool {
	return f.Staged == "U" || f.Unstaged == "U" ||
		(f.Staged == "A" && f.Unstaged == "A") ||
		(f.Staged == "D" && f.Unstaged == "D")
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

// gitDir returns the path to the actual git directory, resolving the gitfile
// indirection used by linked worktrees.
func (r *Repository) gitDir() string {
	candidate := filepath.Join(r.Path, ".git")
	data, err := os.ReadFile(candidate)
	if err != nil {
		// candidate is a directory (normal case for main worktrees)
		return candidate
	}
	// candidate is a gitfile: "gitdir: /path/to/actual/git/dir\n"
	line := strings.TrimSpace(string(data))
	line = strings.TrimPrefix(line, "gitdir:")
	line = strings.TrimSpace(line)
	if filepath.IsAbs(line) {
		return line
	}
	return filepath.Join(r.Path, line)
}
