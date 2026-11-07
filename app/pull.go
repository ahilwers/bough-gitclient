package main

import (
	gitpkg "bough/git"
)

// PullForUI preserves configured pull behavior and returns a typed decision only
// when Git explicitly requires one. Legacy Pull remains available unchanged.
func (a *App) PullForUI(expectedRepo, expectedBranch string) (gitpkg.PullResult, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.PullResult{}, gitpkg.ErrNotARepo
	}
	return a.repo.PullForUI(expectedRepo, expectedBranch)
}

func (a *App) ResolvePull(snapshot gitpkg.PullSnapshot, strategy string) (gitpkg.PullResult, error) {
	a.pullMu.Lock()
	defer a.pullMu.Unlock()
	if a.repo == nil {
		return gitpkg.PullResult{}, gitpkg.ErrNotARepo
	}
	return a.repo.ResolvePull(snapshot, strategy)
}
