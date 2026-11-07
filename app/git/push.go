package git

import (
	"fmt"
	"sort"

	"github.com/go-git/go-git/v5/plumbing"
)

// PushInfo is a read-only snapshot used before asking to publish a branch.
// An upstream is configured even if its remote-tracking ref is not present yet.
type PushInfo struct {
	RepoPath string   `json:"repoPath"`
	Branch   string   `json:"branch"`
	Upstream string   `json:"upstream"`
	Remotes  []string `json:"remotes"`
}

func (r *Repository) GetPushInfo() (PushInfo, error) {
	info := PushInfo{RepoPath: r.Path, Remotes: []string{}}
	head, err := r.repo.Head()
	if err != nil {
		return info, err
	}
	if !head.Name().IsBranch() {
		return info, fmt.Errorf("cannot push from detached HEAD; check out a branch first")
	}
	info.Branch = head.Name().Short()
	cfg, err := r.repo.Config()
	if err != nil {
		return info, err
	}
	if branch := cfg.Branches[info.Branch]; branch != nil && branch.Remote != "" && branch.Merge != "" {
		info.Upstream = branch.Remote + "/" + branch.Merge.Short()
	}
	for name := range cfg.Remotes {
		info.Remotes = append(info.Remotes, name)
	}
	sort.Strings(info.Remotes)
	return info, nil
}

// PushWithUpstream must only be called after explicit confirmation. Validate the
// snapshot again so a checkout/repository switch while the dialog is open cannot
// publish a different branch. Use a full refspec, never push.default or remote.*.push.
func (r *Repository) PushWithUpstream(repoPath, remote, branch string) error {
	if repoPath != r.Path {
		return fmt.Errorf("repository changed; please push again")
	}
	info, err := r.GetPushInfo()
	if err != nil {
		return err
	}
	if branch != info.Branch || info.Upstream != "" {
		return fmt.Errorf("branch or upstream changed; please push again")
	}
	found := false
	for _, name := range info.Remotes {
		if name == remote {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("select a configured remote before creating an upstream")
	}
	ref := plumbing.NewBranchReferenceName(branch).String()
	_, err = CLI(r.Path, "push", "--set-upstream", "--", remote, ref+":"+ref)
	if IsAuthError(err) {
		return ErrAuthFailed
	}
	return err
}
