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

import "time"

// CommitNode is one entry in the graph — it carries both git data
// and pre-computed layout information for the Canvas renderer.
type CommitNode struct {
	Hash        string    `json:"hash"`        // full 40-char SHA
	ShortHash   string    `json:"shortHash"`   // first 7 chars
	Message     string    `json:"message"`     // first line only (for list display)
	FullMessage string    `json:"fullMessage"` // complete commit message
	Author      string    `json:"author"`
	Email       string    `json:"email"`
	Date        time.Time `json:"date"`
	Parents     []string  `json:"parents"` // parent hashes (full SHA)
	Refs        []Ref     `json:"refs"`    // branches/tags pointing here

	// Graph layout (pre-computed by swimlane algorithm)
	Column int         `json:"column"` // swimlane index (0-based)
	Color  int         `json:"color"`  // branch color index (0-7)
	Lines  []GraphLine `json:"lines"`  // lines to draw below this commit
}

// GraphLine describes a single connecting line between commit rows.
type GraphLine struct {
	FromCol int  `json:"fromCol"`
	ToCol   int  `json:"toCol"`
	Color   int  `json:"color"`
	IsMerge bool `json:"isMerge"` // use Bézier curve if true
}

// Ref is a branch, tag, or remote ref pointing to a commit.
type Ref struct {
	Name   string `json:"name"`
	Type   string `json:"type"`   // "branch" | "remote" | "tag" | "head"
	IsHead bool   `json:"isHead"` // true if this is the current HEAD
}

// FileStatus represents one file in the working copy.
type FileStatus struct {
	Path     string `json:"path"`
	OldPath  string `json:"oldPath"` // non-empty for renames
	Staged   string `json:"staged"`  // "M"|"A"|"D"|"R"|"?"|""
	Unstaged string `json:"unstaged"`
	Added    int    `json:"added"`   // line counts for quick display
	Deleted  int    `json:"deleted"`
}

// DiffFile is the complete diff for one file.
type DiffFile struct {
	Path    string     `json:"path"`
	OldPath string     `json:"oldPath"`
	Hunks   []DiffHunk `json:"hunks"`
	Binary  bool       `json:"binary"`
}

// DiffHunk is one @@ block in a diff.
type DiffHunk struct {
	Header   string     `json:"header"`   // e.g. "@@ -12,8 +12,22 @@"
	OldStart int        `json:"oldStart"`
	OldLines int        `json:"oldLines"`
	NewStart int        `json:"newStart"`
	NewLines int        `json:"newLines"`
	Lines    []DiffLine `json:"lines"`
}

// DiffLine is one line in a hunk.
type DiffLine struct {
	Type    string `json:"type"`    // "add" | "del" | "ctx"
	Content string `json:"content"` // line content (without +/-/space prefix)
	OldNo   int    `json:"oldNo"`   // old line number (0 if not applicable)
	NewNo   int    `json:"newNo"`   // new line number (0 if not applicable)
}

// Branch is a local or remote branch.
type Branch struct {
	Name     string `json:"name"`
	Remote   string `json:"remote"`   // empty for local branches
	IsHead   bool   `json:"isHead"`
	Upstream string `json:"upstream"` // e.g. "origin/main"
	Ahead    int    `json:"ahead"`
	Behind   int    `json:"behind"`
}

// Tag is an annotated or lightweight tag.
type Tag struct {
	Name    string    `json:"name"`
	Hash    string    `json:"hash"`
	Date    time.Time `json:"date"`
	Message string    `json:"message"` // empty for lightweight tags
}

// StashEntry is one git stash entry.
type StashEntry struct {
	Index   int       `json:"index"`
	Message string    `json:"message"`
	Hash    string    `json:"hash"`
	Date    time.Time `json:"date"`
}

// WorktreeInfo describes one git worktree.
type WorktreeInfo struct {
	Path    string `json:"path"`
	Branch  string `json:"branch"`
	Head    string `json:"head"`   // short hash
	IsMain  bool   `json:"isMain"`
	IsDirty bool   `json:"isDirty"`
}

// Remote is a configured git remote.
type Remote struct {
	Name     string `json:"name"`
	FetchURL string `json:"fetchURL"`
	PushURL  string `json:"pushURL"`
}

// BranchList groups local and remote branches for the sidebar.
type BranchList struct {
	Local   []Branch `json:"local"`
	Remotes []Branch `json:"remotes"`
}

// MergeState is set when a merge is in progress (.git/MERGE_HEAD exists).
type MergeState struct {
	MergingBranch string `json:"mergingBranch"` // branch being merged in
	ConflictCount int    `json:"conflictCount"`  // remaining conflicted files
	MergeMessage  string `json:"mergeMessage"`   // pre-composed commit message from .git/MERGE_MSG
}

// CherryPickState is set when a cherry-pick is halted by conflicts
// (.git/CHERRY_PICK_HEAD exists). Not set for conflict-free --no-commit picks.
type CherryPickState struct {
	ConflictCount int    `json:"conflictCount"` // remaining conflicted files
	PickedMessage string `json:"pickedMessage"` // commit message of the halted cherry-pick
}

// RebaseAction is one entry in an interactive rebase sequence.
// Action is one of: "pick" | "reword" | "squash" | "fixup" | "drop"
type RebaseAction struct {
	Action  string `json:"action"`
	Hash    string `json:"hash"`
	Message string `json:"message"`
}

// ImageSource carries one version of an image file as a base64 data URL.
// DataURL is empty when no image exists for the requested source (e.g. the
// file was added in this commit, so there is no parent version). Size is the
// original file size in bytes (before base64 encoding).
type ImageSource struct {
	DataURL string `json:"dataURL"`
	Size    int64  `json:"size"`
}

// RebaseState is set when an interactive rebase is in progress
// (.git/rebase-merge directory exists).
type RebaseState struct {
	InProgress    bool   `json:"inProgress"`
	HeadName      string `json:"headName"`      // branch being rebased
	Onto          string `json:"onto"`          // friendly name of the base commit
	Step          int    `json:"step"`          // current step (e.g. 2)
	Total         int    `json:"total"`         // total steps (e.g. 5)
	ConflictCount int    `json:"conflictCount"` // remaining conflicted files
}

// RepoStatus summarises the current state of a repository.
type RepoStatus struct {
	Branch          string           `json:"branch"`
	Ahead           int              `json:"ahead"`
	Behind          int              `json:"behind"`
	Files           []FileStatus     `json:"files"`
	HasConflicts    bool             `json:"hasConflicts"`
	MergeState      *MergeState      `json:"mergeState,omitempty"`
	CherryPickState *CherryPickState `json:"cherryPickState,omitempty"`
	RebaseState     *RebaseState     `json:"rebaseState,omitempty"`
}
