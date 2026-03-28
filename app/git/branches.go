package git

import (
	"strings"

	"github.com/go-git/go-git/v5/plumbing"
)

// ListBranches returns all local and remote branches, with IsHead marked on the
// current branch and Remote populated for remote-tracking refs.
func (r *Repository) ListBranches() (BranchList, error) {
	var bl BranchList

	head, _ := r.repo.Head()

	// Local branches (refs/heads/*)
	iter, err := r.repo.Branches()
	if err != nil {
		return bl, err
	}
	_ = iter.ForEach(func(ref *plumbing.Reference) error {
		bl.Local = append(bl.Local, Branch{
			Name:   ref.Name().Short(),
			IsHead: head != nil && head.Name() == ref.Name(),
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
