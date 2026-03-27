package git

import (
	"fmt"
	"strings"
	"time"

	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// StageFile stages an entire file (equivalent to `git add <file>`).
func (r *Repository) StageFile(filePath string) error {
	wt, err := r.repo.Worktree()
	if err != nil {
		return err
	}
	_, err = wt.Add(filePath)
	return err
}

// UnstageFile unstages an entire file (equivalent to `git restore --staged <file>`).
func (r *Repository) UnstageFile(filePath string) error {
	_, err := CLI(r.Path, "restore", "--staged", "--", filePath)
	return err
}

// StageHunkViaApply stages a single hunk by piping a patch to `git apply --cached`.
// hunkPatch must be a valid unified diff patch string for exactly one hunk.
func (r *Repository) StageHunkViaApply(hunkPatch string) error {
	cmd := execGit(r.Path, "apply", "--cached", "--unidiff-zero", "-")
	cmd.Stdin = strings.NewReader(hunkPatch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply: %w\n%s", err, string(out))
	}
	return nil
}

// DiscardHunk discards a hunk from the working tree (irreversible).
// Uses `git apply -R` (reverse) to undo changes in the worktree.
func (r *Repository) DiscardHunk(hunkPatch string) error {
	cmd := execGit(r.Path, "apply", "-R", "--unidiff-zero", "-")
	cmd.Stdin = strings.NewReader(hunkPatch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply -R: %w\n%s", err, string(out))
	}
	return nil
}

// CreateCommit creates a commit with the given message.
// Returns the full 40-character commit hash.
func (r *Repository) CreateCommit(message string) (string, error) {
	wt, err := r.repo.Worktree()
	if err != nil {
		return "", err
	}
	// Try local config first (covers test repos), then fall back to global.
	name, email := "", ""
	if localCfg, err := r.repo.ConfigScoped(config.LocalScope); err == nil {
		name = localCfg.User.Name
		email = localCfg.User.Email
	}
	if name == "" || email == "" {
		if globalCfg, err := r.repo.ConfigScoped(config.GlobalScope); err == nil {
			if name == "" {
				name = globalCfg.User.Name
			}
			if email == "" {
				email = globalCfg.User.Email
			}
		}
	}
	author := object.Signature{
		Name:  name,
		Email: email,
		When:  time.Now(),
	}
	hash, err := wt.Commit(message, &gogit.CommitOptions{
		Author:    &author,
		Committer: &author,
	})
	if err != nil {
		return "", err
	}
	return hash.String(), nil
}

// AmendCommit amends the last commit with the staged changes and new message.
func (r *Repository) AmendCommit(message string) error {
	args := []string{"commit", "--amend", "--no-edit"}
	if message != "" {
		args = append(args, "-m", message)
	}
	_, err := CLI(r.Path, args...)
	return err
}
