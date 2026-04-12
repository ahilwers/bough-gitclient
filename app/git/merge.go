package git

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DetectMergeState checks if MERGE_HEAD exists and returns a MergeState.
// Uses git rev-parse for reliable detection across worktree layouts.
// Returns nil if no merge is in progress.
func (r *Repository) DetectMergeState(conflictCount int) *MergeState {
	out, err := CLI(r.Path, "rev-parse", "--verify", "MERGE_HEAD")
	if err != nil {
		return nil // no merge in progress
	}
	hash := strings.TrimSpace(out)
	branch := r.hashToFriendlyName(hash)

	// MERGE_MSG is still read from the gitdir file (git doesn't expose it via rev-parse).
	gitDir := r.gitDir()
	mergeMsg := ""
	if msgData, err := os.ReadFile(filepath.Join(gitDir, "MERGE_MSG")); err == nil {
		mergeMsg = strings.TrimRight(string(msgData), "\n")
	}

	return &MergeState{
		MergingBranch: branch,
		ConflictCount: conflictCount,
		MergeMessage:  mergeMsg,
	}
}

// hashToFriendlyName tries to resolve a commit hash to a human-readable branch name.
func (r *Repository) hashToFriendlyName(hash string) string {
	out, err := CLI(r.Path, "name-rev", "--name-only", "--no-undefined", hash)
	if err != nil || strings.TrimSpace(out) == "" {
		if len(hash) >= 7 {
			return hash[:7]
		}
		return hash
	}
	name := strings.TrimSpace(out)
	// name-rev may return "remotes/origin/main" — strip "remotes/" prefix
	name = strings.TrimPrefix(name, "remotes/")
	// Strip "~N" or "^N" suffix (non-tip commits)
	if idx := strings.IndexAny(name, "~^"); idx >= 0 {
		name = name[:idx]
	}
	return name
}

// AbortMerge aborts the current merge and restores the pre-merge state.
func (r *Repository) AbortMerge() error {
	_, err := CLI(r.Path, "merge", "--abort")
	return err
}

// CheckoutOurs resolves a conflict by accepting the local (HEAD) version of a file
// and stages it immediately.
func (r *Repository) CheckoutOurs(filePath string) error {
	if _, err := CLI(r.Path, "checkout", "--ours", "--", filePath); err != nil {
		return err
	}
	_, err := CLI(r.Path, "add", "--", filePath)
	return err
}

// CheckoutTheirs resolves a conflict by accepting the incoming (merging) version
// of a file and stages it immediately.
func (r *Repository) CheckoutTheirs(filePath string) error {
	if _, err := CLI(r.Path, "checkout", "--theirs", "--", filePath); err != nil {
		return err
	}
	_, err := CLI(r.Path, "add", "--", filePath)
	return err
}

// OpenMergeToolForFile launches the user's configured merge tool for the given file.
// Blocks until the tool exits, then stages the file if successful.
func (r *Repository) OpenMergeToolForFile(filePath string) error {
	_, err := CLI(r.Path, "mergetool", "--no-prompt", "--", filePath)
	return err
}

// GetFileContent reads a working-tree file and returns its content as a string.
func (r *Repository) GetFileContent(filePath string) (string, error) {
	fullPath := filepath.Join(r.Path, filePath)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// AcceptBoth resolves a conflict by keeping both the local (ours) and incoming
// (theirs) changes, removing only the conflict marker lines. The result is
// written back to disk and staged.
func (r *Repository) AcceptBoth(filePath string) error {
	content, err := r.GetFileContent(filePath)
	if err != nil {
		return err
	}
	resolved := resolveConflictsBoth(content)
	fullPath := filepath.Join(r.Path, filePath)
	if err := os.WriteFile(fullPath, []byte(resolved), 0o644); err != nil {
		return err
	}
	_, err = CLI(r.Path, "add", "--", filePath)
	return err
}

// resolveConflictsBoth removes conflict markers and retains both sides.
func resolveConflictsBoth(content string) string {
	lines := strings.Split(content, "\n")
	result := make([]string, 0, len(lines))
	state := "normal" // "normal" | "ours" | "theirs"
	for _, line := range lines {
		switch {
		case strings.HasPrefix(line, "<<<<<<<"):
			state = "ours"
		case state != "normal" && strings.HasPrefix(line, "======="):
			state = "theirs"
		case state == "theirs" && strings.HasPrefix(line, ">>>>>>>"):
			state = "normal"
		default:
			result = append(result, line)
		}
	}
	return strings.Join(result, "\n")
}

// GetMergeCommits returns commits that are in MERGE_HEAD but not in HEAD,
// i.e. the commits that would be merged in.
func (r *Repository) GetMergeCommits() ([]CommitNode, error) {
	headOut, err := CLI(r.Path, "rev-parse", "--verify", "MERGE_HEAD")
	if err != nil {
		return []CommitNode{}, nil // no merge in progress
	}
	mergeHash := strings.TrimSpace(headOut)

	out, err := CLI(r.Path, "log",
		fmt.Sprintf("--format=%s", logFormat),
		"HEAD.."+mergeHash,
	)
	if err != nil {
		// HEAD may not exist yet (initial merge into empty repo) — return empty
		return []CommitNode{}, nil
	}

	rawCommits := parseGitLog(out)
	nodes := make([]CommitNode, 0, len(rawCommits))
	for _, rc := range rawCommits {
		nodes = append(nodes, CommitNode{
			Hash:        rc.Hash,
			ShortHash:   rc.Hash[:min(7, len(rc.Hash))],
			Message:     rc.Subject,
			FullMessage: strings.TrimSpace(rc.Subject + "\n\n" + rc.Body),
			Author:      rc.AuthorName,
			Email:       rc.AuthorEmail,
			Date:        rc.Date,
			Parents:     []string{},
		})
	}
	return nodes, nil
}

