package git

import (
	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/storer"
)

const maxCommits = 5000 // cap for initial load

// GetCommits returns the last n commits with pre-computed graph layout.
func (r *Repository) GetCommits(limit int) ([]CommitNode, error) {
	if limit <= 0 || limit > maxCommits {
		limit = maxCommits
	}

	head, err := r.repo.Head()
	if err != nil {
		return nil, err
	}

	iter, err := r.repo.Log(&gogit.LogOptions{
		From:  head.Hash(),
		Order: gogit.LogOrderCommitterTime,
		All:   true, // include all branches
	})
	if err != nil {
		return nil, err
	}

	// Collect all refs for label display
	refs, _ := r.collectRefs()

	var rawCommits []*object.Commit
	err = iter.ForEach(func(c *object.Commit) error {
		rawCommits = append(rawCommits, c)
		if len(rawCommits) >= limit {
			return storer.ErrStop
		}
		return nil
	})
	if err != nil && err != storer.ErrStop {
		return nil, err
	}

	nodes := computeLayout(rawCommits, refs)
	return nodes, nil
}

// collectRefs builds a map from commit hash → []Ref for label display.
func (r *Repository) collectRefs() (map[plumbing.Hash][]Ref, error) {
	result := make(map[plumbing.Hash][]Ref)

	head, _ := r.repo.Head()

	branches, _ := r.repo.Branches()
	_ = branches.ForEach(func(ref *plumbing.Reference) error {
		isHead := head != nil && ref.Hash() == head.Hash() && ref.Name() == head.Name()
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
func computeLayout(commits []*object.Commit, refs map[plumbing.Hash][]Ref) []CommitNode {
	if len(commits) == 0 {
		return nil
	}

	// lanes[col] = hash of the commit currently "owning" that lane.
	// A lane is freed when its commit has been placed.
	lanes := make([]string, 0, 8)

	nodes := make([]CommitNode, len(commits))

	for i, c := range commits {
		hash := c.Hash.String()
		short := hash[:7]

		// Find or assign a lane for this commit
		col := -1
		for j, owner := range lanes {
			if owner == hash {
				col = j
				break
			}
		}
		if col == -1 {
			// New branch — use the first free (empty) lane, or append a new one
			col = len(lanes)
			for j, owner := range lanes {
				if owner == "" {
					col = j
					break
				}
			}
			if col == len(lanes) {
				lanes = append(lanes, hash)
			} else {
				lanes[col] = hash
			}
		}

		color := col % 8

		// Collect lines from this row to the next
		var lines []GraphLine

		for pi, parent := range c.ParentHashes {
			ph := parent.String()
			parentLane := -1
			for j, owner := range lanes {
				if owner == ph {
					parentLane = j
					break
				}
			}
			if parentLane == -1 {
				if pi == 0 {
					// First parent continues the current lane
					parentLane = col
					lanes[col] = ph
				} else {
					// Additional parent (merge) gets a new lane
					parentLane = len(lanes)
					lanes = append(lanes, ph)
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

		// If this commit has no parents (initial commit), free the lane
		if len(c.ParentHashes) == 0 {
			lanes[col] = ""
		}

		// Trim trailing empty lanes
		for len(lanes) > 0 && lanes[len(lanes)-1] == "" {
			lanes = lanes[:len(lanes)-1]
		}

		nodes[i] = CommitNode{
			Hash:      hash,
			ShortHash: short,
			Message:   firstLine(c.Message),
			Author:    c.Author.Name,
			Email:     c.Author.Email,
			Date:      c.Author.When,
			Parents:   hashStrings(c.ParentHashes),
			Refs:      refs[c.Hash],
			Column:    col,
			Color:     color,
			Lines:     lines,
		}
	}
	return nodes
}

func firstLine(s string) string {
	for i, ch := range s {
		if ch == '\n' {
			return s[:i]
		}
	}
	return s
}

func hashStrings(hashes []plumbing.Hash) []string {
	out := make([]string, len(hashes))
	for i, h := range hashes {
		out[i] = h.String()
	}
	return out
}
