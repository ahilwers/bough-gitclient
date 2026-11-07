package main

import (
	gitpkg "bough/git"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// CreateStash saves the current worktree changes in a new stash.
func (a *App) CreateStash(message string, includeUntracked bool) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CreateStash(message, includeUntracked); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}

// CreateTag creates a lightweight tag at target.
func (a *App) CreateTag(name string, target string) error {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.ErrNotARepo
	}
	if err := a.repo.CreateTag(name, target); err != nil {
		return err
	}
	wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
	return nil
}
