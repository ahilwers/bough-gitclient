package git

import (
	"os"
	"path/filepath"
	"strings"
)

// DetectMergeState checks if .git/MERGE_HEAD exists and returns a MergeState.
// Returns nil if no merge is in progress.
func (r *Repository) DetectMergeState(conflictCount int) *MergeState {
	mergeHeadPath := filepath.Join(r.Path, ".git", "MERGE_HEAD")
	data, err := os.ReadFile(mergeHeadPath)
	if err != nil {
		return nil // no merge in progress
	}
	hash := strings.TrimSpace(string(data))
	branch := r.hashToFriendlyName(hash)
	return &MergeState{
		MergingBranch: branch,
		ConflictCount: conflictCount,
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
