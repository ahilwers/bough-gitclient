// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

package main

import (
	"context"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"

	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
	gitpkg "gitmorrow/git"
	"gitmorrow/internal/sysproc"
)

// App holds application state and exposes methods to the frontend via Wails IPC.
type App struct {
	aiMu    sync.Mutex // Serializes AI settings writes and generation.
	pullMu  sync.Mutex // Serializes pull validation/integration with repository and branch switches.
	ctx     context.Context
	app     *application.App // Set in main.go; used for events, dialogs and window queries.
	repo    *gitpkg.Repository
	watcher *gitpkg.Watcher
}

func NewApp() *App { return &App{} }

// ServiceStartup replaces the v2 OnStartup hook. Signature is part of the
// application.ServiceStartup interface, so it stays out of the frontend bindings.
func (a *App) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	a.ctx = ctx
	if a.app == nil {
		// Allow standalone construction (e.g. in tests) to lazily resolve the
		// application handle.
		a.app = application.Get()
	}

	// Ensure SSH_AUTH_SOCK is set for macOS .app bundles launched via launchd
	gitpkg.EnsureSSHAgent()

	// Auto-configure OS-native credential helper if none is set
	if err := gitpkg.EnsureCredentialHelper(); err != nil {
		a.logWarn("Could not configure credential helper: " + err.Error())
	}

	var err error
	a.watcher, err = gitpkg.NewWatcher()
	if err != nil {
		a.logError("Failed to create watcher: " + err.Error())
		return nil
	}
	a.watcher.OnChange(func(path string) {
		a.emitRepoChanged(path)
	})
	return nil
}

// --- Wails v3 runtime helpers (nil-safe so tests can construct App directly) ---

func (a *App) emitRepoChanged(path string) {
	if a.app != nil {
		a.app.Event.Emit("repo:changed", path)
	}
}

func (a *App) emitWorktreesChanged() {
	if a.app != nil {
		a.app.Event.Emit("repo:worktrees-changed")
	}
}

func (a *App) logWarn(msg string) {
	if a.app != nil {
		a.app.Logger.Warn(msg)
	}
}

func (a *App) logError(msg string) {
	if a.app != nil {
		a.app.Logger.Error(msg)
	}
}

// --- Repository ---

func (a *App) OpenRepository(path string) (string, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
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

// GetImageAtCommit returns the image at filePath in the given commit as a
// base64 data URL. DataURL is empty when the file didn't exist at that commit.
func (a *App) GetImageAtCommit(hash, filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageAtCommit(hash, filePath)
}

// GetImageAtCommitParent returns the image at filePath in the first parent of
// hash. DataURL is empty when the commit has no parent or the file didn't exist.
func (a *App) GetImageAtCommitParent(hash, filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageAtCommitParent(hash, filePath)
}

// GetImageFromWorktree reads the current working-copy file as an image.
func (a *App) GetImageFromWorktree(filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageFromWorktree(filePath)
}

// GetImageFromIndex returns the staged (index) version of an image file.
func (a *App) GetImageFromIndex(filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageFromIndex(filePath)
}

// GetImageFromHead returns the image as stored in the current HEAD commit.
func (a *App) GetImageFromHead(filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageFromHead(filePath)
}

// GetImageFromMergeStage returns the image from a merge-conflict index stage:
// 2 = ours (local HEAD), 3 = theirs (incoming branch). DataURL is empty when
// the stage is missing (e.g. add/add conflict where one side lacks the file).
func (a *App) GetImageFromMergeStage(filePath string, stage int) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageFromIndexStage(filePath, stage)
}

// GetImageFromStash returns the image at filePath as saved inside stash@{index}.
// Covers both tracked and untracked (-u) stash entries.
func (a *App) GetImageFromStash(index int, filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageFromStash(index, filePath)
}

// GetImageFromStashBase returns the image at filePath in the commit the stash
// was based on (the stash's first parent).
func (a *App) GetImageFromStashBase(index int, filePath string) (gitpkg.ImageSource, error) {
	if a.repo == nil {
		return gitpkg.ImageSource{}, gitpkg.ErrNotARepo
	}
	return a.repo.GetImageFromStashBase(index, filePath)
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
		// Default push of the tracked branch plus all local tags. PushTracked
		// rechecks the upstream just before pushing so autoSetupRemote must not
		// publish an untracked branch if it changed after the frontend preflight.
		return a.repo.PushTracked(force)
	}
	// --tags adds all local tags to an explicit branch push. The branch is named
	// explicitly so the flag cannot replace the branch refspec with tags-only.
	args := []string{"push", remote, branch, "--tags"}
	if force {
		args = append(args, "--force-with-lease")
	}
	_, err := gitpkg.CLI(a.repo.Path, args...)
	if gitpkg.IsAuthError(err) {
		return fmt.Errorf("%w: %w", gitpkg.ErrAuthFailed, err)
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

// PrepareBranchDeletion captures the branch and push destination for confirmation.
func (a *App) PrepareBranchDeletion(name, remote string) (gitpkg.BranchDeletionInfo, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.BranchDeletionInfo{}, gitpkg.ErrNotARepo
	}
	return a.repo.PrepareBranchDeletion(name, remote)
}

// DiscardFiles discards the unstaged changes of several files at once.
func (a *App) DiscardFiles(filePaths []string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DiscardFiles(filePaths); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

// DiscardStagedFiles reverts several staged files to their HEAD state at once.
func (a *App) DiscardStagedFiles(filePaths []string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DiscardStagedFiles(filePaths); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

// DeleteBranch deletes only the branch described by the confirmed snapshot.
func (a *App) DeleteBranch(info gitpkg.BranchDeletionInfo) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DeleteBranch(info); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) CreateBranch(name, from string, checkoutAfter bool) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CreateBranch(name, from, checkoutAfter); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) MergeBranch(from string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.MergeBranch(from); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) AbortMerge() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AbortMerge(); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) CheckoutOurs(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutOurs(filePath); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) CheckoutTheirs(filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutTheirs(filePath); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
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
		a.emitRepoChanged(a.repo.Path)
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
	a.emitRepoChanged(a.repo.Path)
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
	a.emitRepoChanged(a.repo.Path)
	return err
}

func (a *App) AbortCherryPick() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AbortCherryPick(); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

// --- Interactive Rebase ---

func (a *App) StartInteractiveRebase(actions []gitpkg.RebaseAction) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	err := a.repo.StartInteractiveRebase(actions)
	a.emitRepoChanged(a.repo.Path)
	return err
}

func (a *App) ContinueRebase() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	err := a.repo.ContinueRebase()
	a.emitRepoChanged(a.repo.Path)
	return err
}

func (a *App) AbortRebase() error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.AbortRebase(); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) CommitsOnRemote(hashes []string) ([]string, error) {
	if a.repo == nil {
		return nil, gitpkg.ErrNotARepo
	}
	return a.repo.CommitsOnRemote(hashes)
}

func (a *App) CheckoutBranch(branch string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutBranch(branch); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) CheckoutRemoteBranch(remoteBranch string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CheckoutRemoteBranch(remoteBranch); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) PullIntoLocalBranch(remote, localBranch string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.PullIntoLocalBranch(remote, localBranch); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
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
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) DeleteTag(tag string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DeleteTag(tag); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
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
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) ApplyStashFile(index int, filePath string) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.ApplyStashFile(index, filePath); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
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
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) PopStash(index int) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.PopStash(index); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
	return nil
}

func (a *App) DropStash(index int) error {
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.DropStash(index); err != nil {
		return err
	}
	a.emitRepoChanged(a.repo.Path)
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
	a.emitWorktreesChanged()
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
	a.emitWorktreesChanged()
	return nil
}

// SwitchWorktree changes the active working directory to wtPath without
// replacing the underlying go-git repository object. All worktrees share
// the same object store; only the working directory and HEAD differ.
// CLI-based operations (status, staging, commits) automatically pick up
// the correct worktree state because they run git -C wtPath.
// The frontend is notified via "repo:changed" so it invalidates all queries.
func (a *App) SwitchWorktree(wtPath string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	a.repo.SwitchPath(wtPath)
	_ = a.watcher.Watch(wtPath)
	a.emitRepoChanged(wtPath)
	return nil
}

// OpenInFinder opens the given path in the platform's native file browser.
// macOS → Finder, Windows → Explorer, Linux → xdg-open.
func (a *App) OpenInFinder(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = sysproc.Command("open", path)
	case "windows":
		cmd = sysproc.Command("explorer", path)
	default:
		cmd = sysproc.Command("xdg-open", path)
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
		cmd = sysproc.Command("open", "-R", full)
	case "windows":
		cmd = sysproc.Command("explorer", "/select,"+full)
	default:
		cmd = sysproc.Command("xdg-open", filepath.Dir(full))
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
	var x, y int
	if a.app != nil {
		x, y = a.app.Window.Current().Position()
	}
	if err := saveWindowState(width, height, x, y); err != nil {
		a.logWarn("Could not save window state: " + err.Error())
	}
}

// --- Repository selection (native folder dialog) ---

// SelectRepository opens a native folder-picker dialog and, if the user
// selects a path, opens it as the active repository. Returns the resolved
// repository path on success or an empty string if the dialog was cancelled.
func (a *App) SelectRepository() (string, error) {
	if a.app == nil {
		return "", nil
	}
	path, err := a.app.Dialog.OpenFile().
		SetTitle("Select Git Repository").
		CanChooseDirectories(true).
		PromptForSingleSelection()
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
	if a.app == nil {
		return "", nil
	}
	path, err := a.app.Dialog.OpenFile().
		SetTitle("Select Folder for New Repository").
		CanChooseDirectories(true).
		CanCreateDirectories(true).
		PromptForSingleSelection()
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
