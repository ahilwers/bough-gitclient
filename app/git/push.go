// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
	// --tags publishes every local tag alongside the branch. An ordinary push
	// only carries tags when named explicitly, and --follow-tags would skip
	// the lightweight tags this app creates.
	_, err = CLI(r.Path, "push", "--set-upstream", "--tags", "--", remote, ref+":"+ref)
	if IsAuthError(err) {
		return ErrAuthFailed
	}
	return err
}

// PushTracked performs the default push: the current branch to its configured
// upstream, plus all local tags. The branch is named explicitly (never via
// push.default or remote.*.push) so that --tags adds tags on top of the branch
// push rather than replacing it. Errors if the branch has no upstream, mirroring
// the confirmation guard in the frontend.
func (r *Repository) PushTracked(force bool) error {
	head, err := r.repo.Head()
	if err != nil {
		return err
	}
	if !head.Name().IsBranch() {
		return fmt.Errorf("cannot push from detached HEAD; check out a branch first")
	}
	branch := head.Name().Short()
	cfg, err := r.repo.Config()
	if err != nil {
		return err
	}
	b := cfg.Branches[branch]
	if b == nil || b.Remote == "" || b.Merge == "" {
		return fmt.Errorf("branch %q has no upstream; confirm creation before pushing", branch)
	}
	// --tags publishes every local tag alongside the branch. An ordinary push
	// only carries tags when named explicitly, and --follow-tags would skip
	// the lightweight tags this app creates.
	args := []string{"push", "--tags"}
	if force {
		args = append(args, "--force-with-lease")
	}
	src := plumbing.NewBranchReferenceName(branch).String()
	args = append(args, b.Remote, src+":"+b.Merge.String())
	_, err = CLI(r.Path, args...)
	if IsAuthError(err) {
		return ErrAuthFailed
	}
	return err
}
