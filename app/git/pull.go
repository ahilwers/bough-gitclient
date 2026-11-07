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
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// PullSnapshot binds a one-shot decision to the worktree, branch, local tip and
// upstream configuration/tip that the user was shown. It is not a Git setting.
type PullSnapshot struct {
	Repo     string `json:"repo"`
	Branch   string `json:"branch"`
	Head     string `json:"head"`
	Upstream string `json:"upstream"`
	Target   string `json:"target"`
	Remote   string `json:"remote"`
	MergeRef string `json:"mergeRef"`
}

type PullResult struct {
	Outcome  string        `json:"outcome"` // success | choice | conflict
	Snapshot *PullSnapshot `json:"snapshot,omitempty"`
	Detail   string        `json:"detail,omitempty"`
}

func (r *Repository) pullSnapshot() (PullSnapshot, error) {
	s := PullSnapshot{Repo: r.Path}
	var err error
	s.Branch, err = r.CurrentBranch()
	if err != nil {
		return s, err
	}
	s.Head, err = CLI(r.Path, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return s, err
	}
	s.Head = strings.TrimSpace(s.Head)
	// These may be absent for an untracked branch. Normal pull must still return
	// Git's original diagnostic rather than a synthetic strategy prompt.
	s.Upstream, _ = CLI(r.Path, "rev-parse", "--symbolic-full-name", "@{upstream}")
	s.Target, _ = CLI(r.Path, "rev-parse", "--verify", "@{upstream}")
	s.Remote, _ = CLI(r.Path, "config", "--get", "branch."+s.Branch+".remote")
	s.MergeRef, _ = CLI(r.Path, "config", "--get", "branch."+s.Branch+".merge")
	s.Upstream = strings.TrimSpace(s.Upstream)
	s.Target = strings.TrimSpace(s.Target)
	s.Remote = strings.TrimSpace(s.Remote)
	s.MergeRef = strings.TrimSpace(s.MergeRef)
	return s, nil
}

// pullCLI controls locale only for machine classification. Auth diagnostics are
// retained verbatim. Editors/prompts cannot strand an IPC call; hooks and the
// user's credential helpers still run, under the existing bounded CLI timeout.
func pullCLI(path string, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), cliTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = path
	cmd.Env = append(os.Environ(), "LC_ALL=C", "LANG=C", "GIT_EDITOR=true", "GIT_SEQUENCE_EDITOR=true", "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return fmt.Errorf("git pull: timed out after %s\n%s", cliTimeout, out)
	}
	if err != nil {
		return fmt.Errorf("git pull: %w\n%s", err, out)
	}
	return nil
}

// PullForUI runs the ordinary configured pull first; it never picks a strategy.
func (r *Repository) PullForUI(expectedRepo, expectedBranch string) (PullResult, error) {
	before, err := r.pullSnapshot()
	if err != nil {
		return PullResult{}, err
	}
	if before.Repo != expectedRepo || before.Branch != expectedBranch {
		return PullResult{}, fmt.Errorf("repository or branch changed; pull again")
	}
	return r.finishPull(pullCLI(r.Path, "pull"), before, true)
}

// ResolvePull uses command-line flags for this pull only. Validate before any
// fetch/index/ref writes, including rejecting detached HEAD and stale tips.
func (r *Repository) ResolvePull(snapshot PullSnapshot, strategy string) (PullResult, error) {
	if strategy != "merge" && strategy != "rebase" {
		return PullResult{}, fmt.Errorf("invalid pull strategy")
	}
	current, err := r.pullSnapshot()
	if err != nil {
		return PullResult{}, err
	}
	if current != snapshot || current.Branch == "HEAD" || current.Upstream == "" || current.Target == "" {
		return PullResult{}, fmt.Errorf("repository, branch or upstream changed; pull again")
	}
	if r.DetectMergeState(0) != nil || r.DetectRebaseState(0) != nil {
		return PullResult{}, fmt.Errorf("finish or abort the current operation before pulling")
	}
	args := []string{"pull", "--ff", "--no-rebase", "--no-edit"}
	if strategy == "rebase" {
		// The existing conflict/continue UI reads rebase-merge state, not
		// rebase-apply. Select the merge backend for this invocation only.
		args = []string{"-c", "rebase.backend=merge", "pull", "--ff", "--rebase", "--no-edit"}
	}
	return r.finishPull(pullCLI(r.Path, args...), current, false)
}

func (r *Repository) finishPull(pullErr error, before PullSnapshot, offerChoice bool) (PullResult, error) {
	if pullErr == nil {
		return PullResult{Outcome: "success"}, nil
	}
	// A failed integration is not success. Route even non-file stops (e.g. a
	// failed commit hook) to the existing continue/abort UI.
	if r.DetectMergeState(0) != nil || r.DetectRebaseState(0) != nil {
		return PullResult{Outcome: "conflict", Detail: pullErr.Error()}, nil
	}
	if offerChoice && !IsAuthError(pullErr) && strategyRequired(pullErr) {
		after, err := r.pullSnapshot()
		fetched, fetchErr := CLI(r.Path, "rev-parse", "--verify", "FETCH_HEAD")
		if err == nil && fetchErr == nil && after.Head == before.Head && after.Branch == before.Branch && after.Upstream != "" && strings.TrimSpace(fetched) == after.Target && r.diverged(after.Head, after.Target) {
			return PullResult{Outcome: "choice", Snapshot: &after}, nil
		}
	}
	return PullResult{}, pullErr
}

func strategyRequired(err error) bool {
	// Git has no structured error code for these failures. Pin the subprocess
	// locale, then require BOTH its specific fatal diagnostic and actual graph
	// divergence. Never infer this from arbitrary frontend/localized text.
	msg := err.Error()
	return strings.Contains(msg, "fatal: Need to specify how to reconcile divergent branches.") || strings.Contains(msg, "fatal: Not possible to fast-forward, aborting.")
}

func (r *Repository) diverged(head, target string) bool {
	if _, err := CLI(r.Path, "merge-base", head, target); err != nil {
		return false
	}
	counts, err := CLI(r.Path, "rev-list", "--left-right", "--count", head+"..."+target)
	var ahead, behind int
	if err != nil {
		return false
	}
	_, err = fmt.Sscanf(counts, "%d %d", &ahead, &behind)
	return err == nil && ahead > 0 && behind > 0
}
