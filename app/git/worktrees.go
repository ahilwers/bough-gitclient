package git

import (
	"strings"
	"sync"
)

// ListWorktrees returns all git worktrees for this repository.
// IsDirty is populated concurrently for each worktree so N sequential
// git-status calls cannot block the IPC handler goroutine.
func (r *Repository) ListWorktrees() ([]WorktreeInfo, error) {
	out, err := CLI(r.Path, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	worktrees := parseWorktrees(out)

	// Check dirty state concurrently — each isWorktreeDirty call runs
	// git status in a separate goroutine so they all proceed in parallel
	// and any single slow worktree doesn't stall the rest.
	var wg sync.WaitGroup
	for i := range worktrees {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			worktrees[idx].IsDirty = isWorktreeDirty(worktrees[idx].Path)
		}(i)
	}
	wg.Wait()

	return worktrees, nil
}

// AddWorktree creates a new linked worktree at path checked out to branch.
// Uses CLI-git because go-git does not support worktree add.
func (r *Repository) AddWorktree(path, branch string) error {
	_, err := CLI(r.Path, "worktree", "add", path, branch)
	return err
}

// RemoveWorktree removes a linked worktree. Refuses to remove the main worktree.
// Passes --force so git removes the directory even if it has local modifications
// (the UI asks for confirmation before calling this).
func (r *Repository) RemoveWorktree(wtPath string) error {
	if wtPath == r.Path {
		return ErrCannotRemoveMainWorktree
	}
	_, err := CLI(r.Path, "worktree", "remove", "--force", wtPath)
	return err
}

// PruneWorktrees removes stale worktree administrative files for worktrees
// whose directories no longer exist.
func (r *Repository) PruneWorktrees() error {
	_, err := CLI(r.Path, "worktree", "prune")
	return err
}

// parseWorktrees parses `git worktree list --porcelain` output.
func parseWorktrees(output string) []WorktreeInfo {
	var result []WorktreeInfo
	var cur WorktreeInfo
	first := true

	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		switch {
		case strings.HasPrefix(line, "worktree "):
			if cur.Path != "" {
				result = append(result, cur)
			}
			cur = WorktreeInfo{
				Path:   strings.TrimPrefix(line, "worktree "),
				IsMain: first,
			}
			first = false
		case strings.HasPrefix(line, "HEAD "):
			h := strings.TrimPrefix(line, "HEAD ")
			if len(h) > 7 {
				h = h[:7]
			}
			cur.Head = h
		case strings.HasPrefix(line, "branch "):
			cur.Branch = strings.TrimPrefix(
				strings.TrimPrefix(line, "branch "),
				"refs/heads/",
			)
		case line == "bare":
			cur.Branch = "(bare)"
		case line == "detached":
			cur.Branch = "(detached)"
		}
	}
	if cur.Path != "" {
		result = append(result, cur)
	}
	return result
}

// isWorktreeDirty returns true when the worktree has uncommitted changes.
// Relies on CLI which already has a timeout, so a stale or locked worktree
// cannot block this goroutine for more than cliTimeout.
func isWorktreeDirty(path string) bool {
	out, err := CLI(path, "status", "--porcelain")
	if err != nil {
		return false
	}
	return strings.TrimSpace(out) != ""
}
