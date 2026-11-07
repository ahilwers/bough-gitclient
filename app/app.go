package main

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"

	gitpkg "bough/git"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

	// Restore window position (size is already set via options.App in main.go).
	if ws := loadWindowState(); ws.HasPos {
		wailsruntime.WindowSetPosition(ctx, ws.X, ws.Y)
	}

	// Ensure SSH_AUTH_SOCK is set for macOS .app bundles launched via launchd
	gitpkg.EnsureSSHAgent()

	// Auto-configure OS-native credential helper if none is set
	if err := gitpkg.EnsureCredentialHelper(); err != nil {
		wailsruntime.LogWarning(ctx, "Could not configure credential helper: "+err.Error())
	}

	var err error
	a.watcher, err = gitpkg.NewWatcher()
	if err != nil {
		wailsruntime.LogError(ctx, "Failed to create watcher: "+err.Error())
		return
	}
	a.watcher.OnChange(func(path string) {
		wailsruntime.EventsEmit(ctx, "repo:changed", path)
	})
}

// --- Repository ---

func (a *App) OpenRepository(path string) (string, error) {
	repo, err := gitpkg.Open(path)
	if err != nil {
		return "", err
	}
	a.repo = repo
	_ = a.watcher.Watch(repo.Path)

	// Persist to the recent repos list so it survives restarts.
	updated := addRecentRepo(repo.Path)
	_ = saveRecentRepos(updated)

	return repo.Path, nil
}

// GetRecentRepos returns the persisted list of recently opened repository paths,
// most recent first. Called once on app launch to seed the frontend store.
func (a *App) GetRecentRepos() []string {
	repos := loadRecentRepos()
	if repos == nil {
		return []string{}
	}
	return repos
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
	// Mark the call so the watcher suppresses the index write that git status
	// itself produces (prevents the status → index-change → status feedback loop).
	a.watcher.MarkStatusCall()
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
	a.watcher.MarkStatusCall()
	return a.repo.StageFiles(filePaths)
}

func (a *App) UnstageFiles(filePaths []string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.UnstageFiles(filePaths)
}

func (a *App) StageFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.StageFile(filePath)
}

func (a *App) UnstageFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.UnstageFile(filePath)
}

func (a *App) StageHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.StageHunkViaApply(patch)
}

func (a *App) UnstageHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.UnstageHunkViaApply(patch)
}

func (a *App) DiscardFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.DiscardFile(filePath)
}

func (a *App) DiscardStagedFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
	return a.repo.DiscardStagedFile(filePath)
}

func (a *App) DiscardHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.watcher.MarkStatusCall()
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
	if remote == "" && branch == "" {
		// Recheck just before a default push: autoSetupRemote must not publish
		// an untracked branch if it changed after the frontend preflight.
		info, err := a.repo.GetPushInfo()
		if err != nil {
			return err
		}
		if info.Upstream == "" {
			return fmt.Errorf("branch %q has no upstream; confirm creation before pushing", info.Branch)
		}
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

// GetPushInfo checks the current branch without contacting or changing a remote.
func (a *App) GetPushInfo() (gitpkg.PushInfo, error) {
	if a.repo == nil {
		return gitpkg.PushInfo{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetPushInfo()
}

// PushWithUpstream publishes only the repository and branch the user confirmed.
func (a *App) PushWithUpstream(repoPath, remote, branch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.PushWithUpstream(repoPath, remote, branch)
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

func (a *App) CreateBranch(name, from string, checkoutAfter bool) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CreateBranch(name, from, checkoutAfter); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) MergeBranch(from string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.MergeBranch(from); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) AbortMerge() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AbortMerge(); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) CheckoutOurs(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutOurs(filePath); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) CheckoutTheirs(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutTheirs(filePath); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) OpenMergeToolForFile(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	// Run the tool in a goroutine so the IPC call returns immediately.
	// When the tool exits, emit repo:changed so the UI refreshes.
	go func() {
		_ = a.repo.OpenMergeToolForFile(filePath)
		wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	}()
	return nil
}

func (a *App) GetFileContent(filePath string) (string, error) {
	if a.repo == nil {
		return "", gitpkg.ErrNotARepo
	}
	return a.repo.GetFileContent(filePath)
}

func (a *App) AcceptBoth(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AcceptBoth(filePath); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) GetMergeCommits() ([]gitpkg.CommitNode, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.GetMergeCommits()
}

func (a *App) CherryPickCommits(hashes []string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	err := a.repo.CherryPickCommits(hashes)
	// Always emit repo:changed — even a conflicted pick modifies the working tree and index.
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return err
}

func (a *App) AbortCherryPick() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AbortCherryPick(); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

// --- Interactive Rebase ---

func (a *App) StartInteractiveRebase(actions []gitpkg.RebaseAction) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	err := a.repo.StartInteractiveRebase(actions)
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return err
}

func (a *App) ContinueRebase() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	err := a.repo.ContinueRebase()
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return err
}

func (a *App) AbortRebase() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AbortRebase(); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) CommitsOnRemote(hashes []string) ([]string, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.CommitsOnRemote(hashes)
}

func (a *App) CheckoutBranch(branch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutBranch(branch); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) CheckoutRemoteBranch(remoteBranch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutRemoteBranch(remoteBranch); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) PullIntoLocalBranch(remote, localBranch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.PullIntoLocalBranch(remote, localBranch); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

// --- Tags ---

func (a *App) ListTags() ([]gitpkg.Tag, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.ListTags()
}

func (a *App) CheckoutTag(tag string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutTag(tag); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) DeleteTag(tag string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DeleteTag(tag); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

// --- Stashes ---

func (a *App) GetStashDiff(index int) ([]gitpkg.DiffFile, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.GetStashDiff(index)
}

func (a *App) ApplyStashHunk(patch string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.ApplyStashHunk(patch); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) ApplyStashFile(index int, filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.ApplyStashFile(index, filePath); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) ListStashes() ([]gitpkg.StashEntry, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.ListStashes()
}

func (a *App) ApplyStash(index int) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.ApplyStash(index); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) PopStash(index int) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.PopStash(index); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

func (a *App) DropStash(index int) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DropStash(index); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
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
	if err := a.repo.AddWorktree(path, branch); err != nil {
		return err
	}
	// Also watch the new worktree directory so HEAD changes are detected.
	_ = a.watcher.Watch(path)
	wailsruntime.EventsEmit(a.ctx, "repo:worktrees-changed")
	return nil
}

func (a *App) RemoveWorktree(wtPath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.RemoveWorktree(wtPath); err != nil {
		return err
	}
	_ = a.watcher.Unwatch(wtPath)
	wailsruntime.EventsEmit(a.ctx, "repo:worktrees-changed")
	return nil
}

// SwitchWorktree changes the active working directory to wtPath without
// replacing the underlying go-git repository object. All worktrees share
// the same object store; only the working directory and HEAD differ.
// CLI-based operations (status, staging, commits) automatically pick up
// the correct worktree state because they run git -C wtPath.
// The frontend is notified via "repo:changed" so it invalidates all queries.
func (a *App) SwitchWorktree(wtPath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.repo.SwitchPath(wtPath)
	_ = a.watcher.Watch(wtPath)
	wailsruntime.EventsEmit(a.ctx, "repo:changed", wtPath)
	return nil
}

// OpenInFinder opens the given path in the platform's native file browser.
// macOS → Finder, Windows → Explorer, Linux → xdg-open.
func (a *App) OpenInFinder(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "windows":
		cmd = exec.Command("explorer", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}

// RevealInFinder reveals the given repo-relative file path in the platform's
// native file browser, with the file selected where supported.
// macOS: open -R, Windows: explorer /select, Linux: xdg-open on parent dir.
func (a *App) RevealInFinder(relativePath string) error {
	full := filepath.Join(a.repo.Path, relativePath)
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", "-R", full)
	case "windows":
		cmd = exec.Command("explorer", "/select,"+full)
	default:
		cmd = exec.Command("xdg-open", filepath.Dir(full))
	}
	return cmd.Start()
}

// --- Version & updates ---

// GetAppVersion returns the application version embedded at build time via -ldflags.
// Returns "dev" when running outside of a release build.
func (a *App) GetAppVersion() string {
	return version
}

// --- Window state ---

// SaveWindowSize persists the window dimensions and current position so the
// next launch restores them. Called by the frontend on a debounced resize event.
// Position is read from the Go runtime so the frontend doesn't need to supply it.
func (a *App) SaveWindowSize(width, height int) {
	x, y := wailsruntime.WindowGetPosition(a.ctx)
	if err := saveWindowState(width, height, x, y); err != nil {
		wailsruntime.LogWarning(a.ctx, "Could not save window state: "+err.Error())
	}
}

// --- Repository selection (native folder dialog) ---

// SelectRepository opens a native folder-picker dialog and, if the user
// selects a path, opens it as the active repository. Returns the resolved
// repository path on success or an empty string if the dialog was cancelled.
func (a *App) SelectRepository() (string, error) {
	path, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select Git Repository",
	})
	if err != nil || path == "" {
		return "", err
	}
	return a.OpenRepository(path)
}

// SelectAndInitRepository opens a native folder-picker dialog, initialises a
// new git repository in the chosen directory, and opens it as the active repo.
// Returns the resolved repository path on success, or an empty string if the
// dialog was cancelled.
func (a *App) SelectAndInitRepository() (string, error) {
	path, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:                "Select Folder for New Repository",
		CanCreateDirectories: true,
	})
	if err != nil || path == "" {
		return "", err
	}
	if _, err := gitpkg.CLI(path, "init", "-b", "main"); err != nil {
		return "", err
	}
	return a.OpenRepository(path)
}

// --- Remote management ---

func (a *App) ListRemotes() ([]gitpkg.Remote, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.ListRemotes()
}

func (a *App) AddRemote(name, url string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.AddRemote(name, url)
}

func (a *App) UpdateRemote(name, url string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.UpdateRemote(name, url)
}

func (a *App) RenameRemote(oldName, newName string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.RenameRemote(oldName, newName)
}

func (a *App) RemoveRemote(name string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	return a.repo.RemoveRemote(name)
}
