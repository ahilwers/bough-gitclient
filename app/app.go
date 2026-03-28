package main

import (
	"context"

	gitpkg "bough/git"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App holds application state and exposes methods to the frontend via Wails IPC.
type App struct {
	ctx     context.Context
	repo    *gitpkg.Repository
	watcher *gitpkg.Watcher
}

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Ensure SSH_AUTH_SOCK is set for macOS .app bundles launched via launchd
	gitpkg.EnsureSSHAgent()

	// Auto-configure OS-native credential helper if none is set
	if err := gitpkg.EnsureCredentialHelper(); err != nil {
		runtime.LogWarning(ctx, "Could not configure credential helper: "+err.Error())
	}

	var err error
	a.watcher, err = gitpkg.NewWatcher()
	if err != nil {
		runtime.LogError(ctx, "Failed to create watcher: "+err.Error())
		return
	}
	a.watcher.OnChange(func(path string) {
		runtime.EventsEmit(ctx, "repo:changed", path)
	})
}

// --- Repository ---

func (a *App) OpenRepository(path string) (string, error) {
	repo, err := gitpkg.Open(path)
	if err != nil {
		return "", err
	}
	a.repo = repo
	_ = a.watcher.Watch(path)
	return repo.Path, nil
}

// --- Commits ---

func (a *App) GetCommits(limit int, all bool) ([]gitpkg.CommitNode, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.GetCommits(limit, all)
}

func (a *App) GetCommitDiff(hash string) ([]gitpkg.DiffFile, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.GetCommitDiff(hash)
}

func (a *App) GetFileAtCommit(hash, filePath string) (string, error) {
	if a.repo == nil {
		return "", gitpkg.ErrNotARepo
	}
	return a.repo.GetFileAtCommit(hash, filePath)
}

func (a *App) GetFileAtCommitParent(hash, filePath string) (string, error) {
	if a.repo == nil {
		return "", gitpkg.ErrNotARepo
	}
	return a.repo.GetFileAtCommitParent(hash, filePath)
}

// --- Status & Diff ---

func (a *App) GetStatus() (gitpkg.RepoStatus, error) {
	if a.repo == nil {
		return gitpkg.RepoStatus{}, gitpkg.ErrNotARepo
	}
	return a.repo.Status()
}

func (a *App) GetFileDiff(filePath string, staged bool) (*gitpkg.DiffFile, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.GetFileDiff(filePath, staged)
}

func (a *App) GetUntrackedFileDiff(filePath string) (*gitpkg.DiffFile, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.GetUntrackedFileDiff(filePath)
}

// --- Staging ---

func (a *App) StageFiles(filePaths []string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.StageFiles(filePaths)
}

func (a *App) UnstageFiles(filePaths []string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.UnstageFiles(filePaths)
}

func (a *App) StageFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.StageFile(filePath)
}

func (a *App) UnstageFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.UnstageFile(filePath)
}

func (a *App) StageHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.StageHunkViaApply(patch)
}

func (a *App) UnstageHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.UnstageHunkViaApply(patch)
}

func (a *App) DiscardHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.DiscardHunk(patch)
}

func (a *App) CreateCommit(message string) (string, error) {
	if a.repo == nil {
		return "", gitpkg.ErrNotARepo
	}
	return a.repo.CreateCommit(message)
}

func (a *App) AmendCommit(message string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.AmendCommit(message)
}

// --- Remote operations (CLI-git) ---

func (a *App) Fetch(remote string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	args := []string{"fetch"}
	if remote != "" {
		args = append(args, remote)
	}
	_, err := gitpkg.CLI(a.repo.Path, args...)
	return err
}

func (a *App) Pull(remote, branch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	_, err := gitpkg.CLI(a.repo.Path, "pull", remote, branch)
	return err
}

func (a *App) Push(remote, branch string, force bool) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	args := []string{"push", remote, branch}
	if force {
		args = append(args, "--force-with-lease")
	}
	_, err := gitpkg.CLI(a.repo.Path, args...)
	if gitpkg.IsAuthError(err) {
		return gitpkg.ErrAuthFailed
	}
	return err
}

// StoreCredentials writes credentials into the configured git credential helper.
// Called by the frontend after the user enters credentials in the credential dialog.
func (a *App) StoreCredentials(repoURL, username, password string) error {
	return gitpkg.StoreCredentials(repoURL, username, password)
}

// --- Branches ---

func (a *App) ListBranches() (gitpkg.BranchList, error) {
	if a.repo == nil {
		return gitpkg.BranchList{}, gitpkg.ErrNotARepo
	}
	return a.repo.ListBranches()
}

// --- Worktrees ---

func (a *App) ListWorktrees() ([]gitpkg.WorktreeInfo, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.ListWorktrees()
}

func (a *App) AddWorktree(path, branch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.AddWorktree(path, branch)
}

// --- Repository selection (native folder dialog) ---

// SelectRepository opens a native folder-picker dialog and, if the user
// selects a path, opens it as the active repository. Returns the resolved
// repository path on success or an empty string if the dialog was cancelled.
func (a *App) SelectRepository() (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Git Repository",
	})
	if err != nil || path == "" {
		return "", err
	}
	return a.OpenRepository(path)
}
