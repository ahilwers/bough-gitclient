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
	"strings"
	"time"

	"github.com/go-git/go-git/v5/plumbing"
)

// logSep separates fields within one commit record.
// logEnd separates commit records from each other.
const logSep = "\x1f"
const logEnd = "\x1e"

// logFormat asks git to emit: hash, parents, ISO date, author name, author email, subject, body
// Fields are separated by US (unit separator, \x1f), records by RS (record separator, \x1e).
const logFormat = "%H" + logSep + "%P" + logSep + "%aI" + logSep + "%an" + logSep + "%ae" + logSep + "%s" + logSep + "%b" + logEnd

// rawCommit holds the data from a single `git log` record.
type rawCommit struct {
	Hash        string
	ParentHashes []string
	Date        time.Time
	AuthorName  string
	AuthorEmail string
	Subject     string
	Body        string
}

const maxCommits = 5000 // cap for initial load

// GetCommits returns the last n commits with pre-computed graph layout.
// When all is true every branch is included; when false only commits
// reachable from HEAD are returned.
// Uses CLI git log to avoid go-git packfile scanning (O(commits×seeks)).
func (r *Repository) GetCommits(limit int, all bool) ([]CommitNode, error) {
	if limit <= 0 || limit > maxCommits {
		limit = maxCommits
	}

	args := []string{
		"log",
		fmt.Sprintf("--format=%s", logFormat),
		fmt.Sprintf("-n%d", limit),
	}
	if all {
		args = append(args, "--all")
	}

	out, err := CLI(r.Path, args...)
	if err != nil {
		return nil, err
	}

	rawCommits := parseGitLog(out)
	if len(rawCommits) == 0 {
		return nil, nil
	}

	// Collect all refs for label display
	refs, _ := r.collectRefs()

	nodes := computeLayout(rawCommits, refs)
	return nodes, nil
}

// parseGitLog parses the output of `git log --format=<logFormat>`.
func parseGitLog(output string) []rawCommit {
	output = strings.TrimSpace(output)
	if output == "" {
		return nil
	}

	records := strings.Split(output, logEnd)
	result := make([]rawCommit, 0, len(records))

	for _, rec := range records {
		rec = strings.TrimSpace(rec)
		if rec == "" {
			continue
		}
		fields := strings.SplitN(rec, logSep, 7)
		if len(fields) < 6 {
			continue
		}

		parents := []string{}
		if p := strings.TrimSpace(fields[1]); p != "" {
			parents = strings.Fields(p)
		}

		date, _ := time.Parse(time.RFC3339, strings.TrimSpace(fields[2]))

		body := ""
		if len(fields) == 7 {
			body = strings.TrimSpace(fields[6])
		}

		result = append(result, rawCommit{
			Hash:        strings.TrimSpace(fields[0]),
			ParentHashes: parents,
			Date:        date,
			AuthorName:  strings.TrimSpace(fields[3]),
			AuthorEmail: strings.TrimSpace(fields[4]),
			Subject:     strings.TrimSpace(fields[5]),
			Body:        body,
		})
	}
	return result
}

// collectRefs builds a map from commit hash → []Ref for label display.
// Uses go-git for ref iteration only (fast: reads ref files, not pack objects).
func (r *Repository) collectRefs() (map[plumbing.Hash][]Ref, error) {
	result := make(map[plumbing.Hash][]Ref)

	// Use CLI-resolved HEAD so linked worktrees show the correct "current" marker.
	out, err := CLI(r.Path, "rev-parse", "HEAD")
	var headHash plumbing.Hash
	if err == nil {
		headHash = plumbing.NewHash(strings.TrimSpace(out))
	}

	branches, _ := r.repo.Branches()
	_ = branches.ForEach(func(ref *plumbing.Reference) error {
		isHead := headHash != plumbing.ZeroHash && ref.Hash() == headHash
		result[ref.Hash()] = append(result[ref.Hash()], Ref{
			Name:   ref.Name().Short(),
			Type:   "branch",
			IsHead: isHead,
		})
		return nil
	})

	allRefs, _ := r.repo.References()
	_ = allRefs.ForEach(func(ref *plumbing.Reference) error {
		if ref.Name().IsRemote() {
			result[ref.Hash()] = append(result[ref.Hash()], Ref{
				Name: ref.Name().Short(),
				Type: "remote",
			})
		}
		return nil
	})

	tags, _ := r.repo.Tags()
	_ = tags.ForEach(func(ref *plumbing.Reference) error {
		result[ref.Hash()] = append(result[ref.Hash()], Ref{
			Name: ref.Name().Short(),
			Type: "tag",
		})
		return nil
	})

	return result, nil
}

// computeLayout assigns each commit to a swimlane column and computes
// the connecting lines that the Canvas renderer will draw.
func computeLayout(commits []rawCommit, refs map[plumbing.Hash][]Ref) []CommitNode {
	if len(commits) == 0 {
		return nil
	}

	// lanes[col] = hash of the commit expected to appear in that column.
	// A lane is freed (set to "") when its commit has been placed.
	lanes := make([]string, 0, 8)

	nodes := make([]CommitNode, len(commits))

	for i, c := range commits {
		hash := c.Hash
		short := hash
		if len(short) > 7 {
			short = short[:7]
		}

		// Find or assign a lane for this commit
		col := -1
		for j, owner := range lanes {
			if owner == hash {
				col = j
				break
			}
		}
		if col == -1 {
			// New branch tip — use the first free (empty) lane, or append a new one
			for j, owner := range lanes {
				if owner == "" {
					col = j
					break
				}
			}
			if col == -1 {
				col = len(lanes)
				lanes = append(lanes, hash)
			} else {
				lanes[col] = hash
			}
		}

		color := col % 8

		// Snapshot which lane indices are occupied BEFORE we process parents.
		activeBefore := make(map[int]bool, len(lanes))
		for j, owner := range lanes {
			if owner != "" {
				activeBefore[j] = true
			}
		}

		var lines []GraphLine

		for pi, ph := range c.ParentHashes {
			// Check whether this parent is already waiting in a lane
			parentLane := -1
			for j, owner := range lanes {
				if owner == ph {
					parentLane = j
					break
				}
			}

			if pi == 0 {
				// First parent always continues (or merges into) the current lane
				if parentLane == -1 {
					parentLane = col
					lanes[col] = ph
				} else {
					lanes[col] = ""
				}
			} else {
				// Additional parents (merge sources) need their own lane
				if parentLane == -1 {
					parentLane = -1
					for j, owner := range lanes {
						if owner == "" {
							parentLane = j
							break
						}
					}
					if parentLane == -1 {
						parentLane = len(lanes)
						lanes = append(lanes, ph)
					} else {
						lanes[parentLane] = ph
					}
				}
			}

			isMerge := pi > 0
			lines = append(lines, GraphLine{
				FromCol: col,
				ToCol:   parentLane,
				Color:   color,
				IsMerge: isMerge,
			})
		}

		// Root commit (no parents): free the lane
		if len(c.ParentHashes) == 0 {
			lanes[col] = ""
		}

		// Pass-through lines for lanes active before this commit
		for j, owner := range lanes {
			if owner == "" || j == col {
				continue
			}
			if activeBefore[j] {
				lines = append(lines, GraphLine{
					FromCol: j,
					ToCol:   j,
					Color:   j % 8,
					IsMerge: false,
				})
			}
		}

		// Trim trailing empty lanes
		for len(lanes) > 0 && lanes[len(lanes)-1] == "" {
			lanes = lanes[:len(lanes)-1]
		}

		h := plumbing.NewHash(hash)
		nodes[i] = CommitNode{
			Hash:        hash,
			ShortHash:   short,
			Message:     c.Subject,
			FullMessage: fullMessage(c.Subject, c.Body),
			Author:      c.AuthorName,
			Email:       c.AuthorEmail,
			Date:        c.Date,
			Parents:     c.ParentHashes,
			Refs:        refs[h],
			Column:      col,
			Color:       color,
			Lines:       lines,
		}
	}
	return nodes
}

func fullMessage(subject, body string) string {
	if body == "" {
		return subject
	}
	return subject + "\n\n" + body
}
