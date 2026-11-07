package git

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// GetStashDiff returns the tracked and untracked changes in stash@{index}.
func (r *Repository) GetStashDiff(index int) ([]DiffFile, error) {
	ref, err := CLI(r.Path, "rev-parse", "--verify", fmt.Sprintf("stash@{%d}^{commit}", index))
	if err != nil {
		return nil, err
	}
	ref = strings.TrimSpace(ref)
	out, err := CLI(r.Path, "stash", "show", "-p", "--include-untracked", "--no-renames", "--no-color", "--no-ext-diff", ref)
	if err != nil {
		return nil, err
	}
	// The NUL-delimited names handle quoted paths, empty files, and binary
	// patches, none of which always have a usable +++ line in the patch.
	names, err := CLI(r.Path, "stash", "show", "--name-only", "-z", "--include-untracked", "--no-renames", "--no-ext-diff", ref)
	if err != nil {
		return nil, err
	}
	files := parsePatchOutput(out)
	paths := strings.Split(strings.TrimSuffix(names, "\x00"), "\x00")
	if names == "" {
		paths = nil
	}
	if len(files) != len(paths) {
		return nil, fmt.Errorf("stash diff contains %d patches for %d paths", len(files), len(paths))
	}
	for i := range files {
		files[i].Path = paths[i]
		if files[i].OldPath == "--- /dev/null" {
			files[i].OldPath = "/dev/null"
		} else if files[i].OldPath != "" && files[i].OldPath != "/dev/null" {
			files[i].OldPath = paths[i]
		}
	}
	return files, nil
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

// ApplyStashFile restores one file from stash@{index}. Tracked files retain
// the existing checkout behavior; untracked files are restored without staging
// them or overwriting an existing file.
func (r *Repository) ApplyStashFile(index int, filePath string) error {
	path := filepath.FromSlash(filePath)
	if !filepath.IsLocal(path) || filepath.Clean(path) == "." || filepath.ToSlash(filepath.Clean(path)) != filePath {
		return fmt.Errorf("invalid stash file path %q", filePath)
	}
	ref, err := CLI(r.Path, "rev-parse", "--verify", fmt.Sprintf("stash@{%d}^{commit}", index))
	if err != nil {
		return err
	}
	ref = strings.TrimSpace(ref)
	pathspec := ":(literal)" + filePath
	_, tracked, err := r.stashFileEntry(ref, filePath, pathspec)
	if err != nil {
		return err
	}
	if tracked {
		_, err = CLI(r.Path, "checkout", ref, "--", pathspec)
		return err
	}
	return r.restoreUntrackedStashFile(ref, filePath, pathspec)
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
