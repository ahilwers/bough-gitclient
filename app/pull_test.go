package main

import (
	gitpkg "bough/git"
	"testing"
)

func TestPullIPCRejectsMissingRepository(t *testing.T) {
	app := NewApp()
	if _, err := app.PullForUI("/missing", "main"); err == nil {
		t.Fatal("accepted missing repo")
	}
	if _, err := app.ResolvePull(gitpkg.PullSnapshot{}, "merge"); err == nil {
		t.Fatal("accepted missing repo")
	}
}
