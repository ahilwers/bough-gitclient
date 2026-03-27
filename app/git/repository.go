package git

import (
	gogit "github.com/go-git/go-git/v5"
)

// Repository wraps a go-git repository with Bough-specific helpers.
type Repository struct {
	repo *gogit.Repository
	Path string
}

// Open opens a Git repository at the given path.
func Open(path string) (*Repository, error) {
	repo, err := gogit.PlainOpenWithOptions(path, &gogit.PlainOpenOptions{
		DetectDotGit:          true,
		EnableDotGitCommonDir: true,
	})
	if err != nil {
		return nil, err
	}
	return &Repository{repo: repo, Path: path}, nil
}
