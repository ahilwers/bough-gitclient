package git

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// GetStashDiff returns the full diff for stash@{index} as a list of DiffFile,
// parsed with the same logic used for working-copy diffs.
func (r *Repository) GetStashDiff(index int) ([]DiffFile, error) {
	out, err := CLI(r.Path, "stash", "show", "-p", fmt.Sprintf("stash@{%d}", index))
	if err != nil {
		return nil, err
	}
	return parsePatchOutput(out), nil
}

// ApplyStashHunk applies a single hunk patch to the working tree without
// touching the index. Uses the same git apply mechanism as DiscardHunk but
// in the forward direction — so the stash change lands in the working tree.
func (r *Repository) ApplyStashHunk(patch string) error {
	cmd := execGit(r.Path, "apply", "--unidiff-zero", "-")
	cmd.Stdin = strings.NewReader(patch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply: %w\n%s", err, string(out))
	}
	return nil
}

// ApplyStashFile overwrites a single file in the working tree with its
// version from stash@{index}, leaving other files untouched.
func (r *Repository) ApplyStashFile(index int, filePath string) error {
	_, err := CLI(r.Path, "checkout", fmt.Sprintf("stash@{%d}", index), "--", filePath)
	return err
}

// ListStashes returns all stash entries in stash order (newest first).
func (r *Repository) ListStashes() ([]StashEntry, error) {
	out, err := CLI(r.Path, "stash", "list", "--format=%gd\t%H\t%ai\t%s")
	if err != nil {
		return nil, err
	}
	out = strings.TrimSpace(out)
	if out == "" {
		return nil, nil
	}

	var entries []StashEntry
	for _, line := range strings.Split(out, "\n") {
		parts := strings.SplitN(line, "\t", 4)
		if len(parts) != 4 {
			continue
		}
		// parts[0] = "stash@{N}", parts[1] = hash, parts[2] = iso date, parts[3] = subject
		idxStr := strings.TrimSuffix(strings.TrimPrefix(parts[0], "stash@{"), "}")
		idx, _ := strconv.Atoi(idxStr)
		date, _ := time.Parse("2006-01-02 15:04:05 -0700", parts[2])
		entries = append(entries, StashEntry{
			Index:   idx,
			Hash:    parts[1],
			Date:    date,
			Message: parts[3],
		})
	}
	return entries, nil
}

// ApplyStash applies stash@{index} without removing it from the stash list.
func (r *Repository) ApplyStash(index int) error {
	_, err := CLI(r.Path, "stash", "apply", fmt.Sprintf("stash@{%d}", index))
	return err
}

// PopStash applies stash@{index} and removes it from the stash list.
func (r *Repository) PopStash(index int) error {
	_, err := CLI(r.Path, "stash", "pop", fmt.Sprintf("stash@{%d}", index))
	return err
}

// DropStash removes stash@{index} without applying it.
func (r *Repository) DropStash(index int) error {
	_, err := CLI(r.Path, "stash", "drop", fmt.Sprintf("stash@{%d}", index))
	return err
}
