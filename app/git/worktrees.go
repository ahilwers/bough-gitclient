package git

import (
	"strings"
)

// ListWorktrees returns all git worktrees for this repository using `git worktree list`.
func (r *Repository) ListWorktrees() ([]WorktreeInfo, error) {
	out, err := CLI(r.Path, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	return parseWorktrees(out), nil
}

// AddWorktree creates a new linked worktree at path checked out to branch.
// Uses CLI-git because go-git does not support worktree add.
func (r *Repository) AddWorktree(path, branch string) error {
	_, err := CLI(r.Path, "worktree", "add", path, branch)
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
