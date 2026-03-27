package main

import (
	"context"

	gitpkg "bough/git"
)

// App holds application state and exposes methods to the frontend via Wails IPC.
type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. Save the context for later use.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// --- Repository ---

// OpenRepository opens a git repository and returns its path.
// Returns an error string if the path is not a valid git repo.
func (a *App) OpenRepository(path string) (string, error) {
	repo, err := gitpkg.Open(path)
	if err != nil {
		return "", err
	}
	return repo.Path, nil
}
