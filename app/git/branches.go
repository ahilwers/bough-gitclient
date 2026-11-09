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

package git

import (
	"regexp"
	"strconv"
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

	// Ahead/behind counts from the upstream tracking branch.
	aheadBehind := r.fetchAheadBehind()

	// Local branches (refs/heads/*)
	iter, err := r.repo.Branches()
	if err != nil {
		return bl, err
	}
	_ = iter.ForEach(func(ref *plumbing.Reference) error {
		name := ref.Name().Short()
		ab := aheadBehind[name]
		bl.Local = append(bl.Local, Branch{
			Name:   name,
			IsHead: name == currentBranch,
			Ahead:  ab[0],
			Behind: ab[1],
		})
		return nil
	})

	// On a freshly-initialised repo there are no commits yet, so refs/heads/*
	// is empty. Add the unborn branch so the sidebar always shows something.
	if len(bl.Local) == 0 && currentBranch != "" && currentBranch != "HEAD" {
		bl.Local = append(bl.Local, Branch{Name: currentBranch, IsHead: true})
	}

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

// CreateBranch creates a new branch from the given source branch.
// When checkoutAfter is true the working tree is switched to the new branch.
func (r *Repository) CreateBranch(name, from string, checkoutAfter bool) error {
	if checkoutAfter {
		_, err := CLI(r.Path, "checkout", "-b", name, from)
		return err
	}
	_, err := CLI(r.Path, "branch", name, from)
	return err
}

// MergeBranch merges the given branch into the current branch using the git CLI.
func (r *Repository) MergeBranch(from string) error {
	_, err := CLI(r.Path, "merge", from)
	return err
}

// CheckoutBranch switches the working tree to the named local branch using the
// git CLI so that hooks and credential helpers run as expected.
func (r *Repository) CheckoutBranch(branch string) error {
	_, err := CLI(r.Path, "checkout", branch)
	return err
}

// CheckoutRemoteBranch creates a local tracking branch from the given remote
// branch (e.g. "origin/main") and checks it out.
func (r *Repository) CheckoutRemoteBranch(remoteBranch string) error {
	_, err := CLI(r.Path, "checkout", "--track", remoteBranch)
	return err
}

// PullIntoLocalBranch switches to localBranch and pulls from remote, ensuring
// the local branch is updated regardless of which branch is currently active.
func (r *Repository) PullIntoLocalBranch(remote, localBranch string) error {
	if _, err := CLI(r.Path, "checkout", localBranch); err != nil {
		return err
	}
	_, err := CLI(r.Path, "pull", remote, localBranch)
	return err
}

// fetchAheadBehind returns a map of local branch name → [ahead, behind] counts
// relative to each branch's upstream tracking ref.
func (r *Repository) fetchAheadBehind() map[string][2]int {
	out, err := CLI(r.Path, "for-each-ref", "--format=%(refname:short)\t%(upstream:track)", "refs/heads/")
	if err != nil {
		return nil
	}
	result := make(map[string][2]int)
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		name, track := parts[0], parts[1]
		result[name] = [2]int{parseTrackAhead(track), parseTrackBehind(track)}
	}
	return result
}

var reAhead = regexp.MustCompile(`ahead (\d+)`)
var reBehind = regexp.MustCompile(`behind (\d+)`)

func parseTrackAhead(track string) int {
	if m := reAhead.FindStringSubmatch(track); len(m) > 1 {
		n, _ := strconv.Atoi(m[1])
		return n
	}
	return 0
}

func parseTrackBehind(track string) int {
	if m := reBehind.FindStringSubmatch(track); len(m) > 1 {
		n, _ := strconv.Atoi(m[1])
		return n
	}
	return 0
}
