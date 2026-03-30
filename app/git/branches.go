package git

import (
	"strings"

	"github.com/go-git/go-git/v5/plumbing"
)

// ListBranches returns all local and remote branches, with IsHead marked on the
// current branch and Remote populated for remote-tracking refs.
func (r *Repository) ListBranches() (BranchList, error) {
	var bl BranchList

	// Use the CLI-based CurrentBranch so the result is always accurate,
	// including after a CLI checkout and for linked worktrees.
	currentBranch, _ := r.CurrentBranch()

	// Local branches (refs/heads/*)
	iter, err := r.repo.Branches()
	if err != nil {
		return bl, err
	}
	_ = iter.ForEach(func(ref *plumbing.Reference) error {
		bl.Local = append(bl.Local, Branch{
			Name:   ref.Name().Short(),
			IsHead: ref.Name().Short() == currentBranch,
		})
		return nil
	})

	// Remote-tracking branches (refs/remotes/*), skip HEAD tracking refs
	refs, err := r.repo.References()
	if err != nil {
		return bl, err
	}
	_ = refs.ForEach(func(ref *plumbing.Reference) error {
		name := ref.Name().String()
		if strings.HasPrefix(name, "refs/remotes/") && !strings.HasSuffix(name, "/HEAD") {
			short := ref.Name().Short() // e.g. "origin/main"
			remote := strings.SplitN(short, "/", 2)[0]
			bl.Remotes = append(bl.Remotes, Branch{
				Name:   short,
				Remote: remote,
			})
		}
		return nil
	})

	return bl, nil
}

// CheckoutBranch switches the working tree to the named local branch using the
// git CLI so that hooks and credential helpers run as expected.
func (r *Repository) CheckoutBranch(branch string) error {
	_, err := CLI(r.Path, "checkout", branch)
	return err
}
