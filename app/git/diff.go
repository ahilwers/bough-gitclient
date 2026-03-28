package git

import (
	"fmt"
	"strings"

	"github.com/go-git/go-git/v5/plumbing"
	fdiff "github.com/go-git/go-git/v5/plumbing/format/diff"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// GetCommitDiff returns the diff of a commit against its first parent.
func (r *Repository) GetCommitDiff(hash string) ([]DiffFile, error) {
	h := plumbing.NewHash(hash)
	commit, err := r.repo.CommitObject(h)
	if err != nil {
		return nil, err
	}

	var parentTree *object.Tree
	if len(commit.ParentHashes) > 0 {
		parent, err := r.repo.CommitObject(commit.ParentHashes[0])
		if err != nil {
			return nil, err
		}
		parentTree, err = parent.Tree()
		if err != nil {
			return nil, err
		}
	}

	currentTree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	var changes object.Changes
	if parentTree == nil {
		// Initial commit: diff against empty tree
		changes, err = object.DiffTree(nil, currentTree)
	} else {
		changes, err = parentTree.Diff(currentTree)
	}
	if err != nil {
		return nil, err
	}

	return changesFromObjectDiff(changes)
}

// GetFileAtCommit returns the raw text content of filePath at hash.
// Returns an empty string (not an error) when the file did not exist at that commit.
func (r *Repository) GetFileAtCommit(hash, filePath string) (string, error) {
	commit, err := r.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return "", err
	}
	tree, err := commit.Tree()
	if err != nil {
		return "", err
	}
	file, err := tree.File(filePath)
	if err != nil {
		return "", nil // file didn't exist at this commit
	}
	return file.Contents()
}

// GetFileAtCommitParent returns the content of filePath at the first parent of hash.
// Returns an empty string when the commit has no parent (initial commit) or the
// file didn't exist in the parent.
func (r *Repository) GetFileAtCommitParent(hash, filePath string) (string, error) {
	commit, err := r.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return "", err
	}
	if len(commit.ParentHashes) == 0 {
		return "", nil
	}
	return r.GetFileAtCommit(commit.ParentHashes[0].String(), filePath)
}

// GetFileDiff returns the staged or unstaged diff for a working-copy file.
// staged=true: compares HEAD vs index; staged=false: compares index vs worktree.
func (r *Repository) GetFileDiff(filePath string, staged bool) (*DiffFile, error) {
	cachedFlag := ""
	if staged {
		cachedFlag = "--cached"
	}
	out, err := CLI(r.Path, "diff",
		"--unified=3",
		"--no-color",
		cachedFlag,
		"--",
		filePath,
	)
	if err != nil {
		return nil, err
	}
	files := parsePatchOutput(out)
	if len(files) == 0 {
		return &DiffFile{Path: filePath}, nil
	}
	return &files[0], nil
}

// parsePatchOutput parses unified diff output from `git diff`.
func parsePatchOutput(patch string) []DiffFile {
	var files []DiffFile
	var current *DiffFile
	var currentHunk *DiffHunk
	oldNo, newNo := 0, 0

	for _, rawLine := range strings.Split(patch, "\n") {
		switch {
		case strings.HasPrefix(rawLine, "diff --git"):
			if current != nil {
				files = append(files, *current)
			}
			current = &DiffFile{}
			currentHunk = nil

		case strings.HasPrefix(rawLine, "--- a/") || strings.HasPrefix(rawLine, "--- /dev/null"):
			if current != nil {
				current.OldPath = strings.TrimPrefix(rawLine, "--- a/")
			}
		case strings.HasPrefix(rawLine, "+++ b/") || strings.HasPrefix(rawLine, "+++ /dev/null"):
			if current != nil {
				current.Path = strings.TrimPrefix(rawLine, "+++ b/")
			}
		case strings.HasPrefix(rawLine, "@@"):
			if current == nil {
				continue
			}
			hunk := parseHunkHeader(rawLine)
			current.Hunks = append(current.Hunks, hunk)
			currentHunk = &current.Hunks[len(current.Hunks)-1]
			oldNo = currentHunk.OldStart
			newNo = currentHunk.NewStart

		case currentHunk != nil && len(rawLine) > 0:
			prefix := string(rawLine[0])
			content := rawLine[1:]
			switch prefix {
			case "+":
				currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: "add", Content: content, NewNo: newNo})
				newNo++
			case "-":
				currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: "del", Content: content, OldNo: oldNo})
				oldNo++
			case " ":
				currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: "ctx", Content: content, OldNo: oldNo, NewNo: newNo})
				oldNo++
				newNo++
			}
		}
	}
	if current != nil {
		files = append(files, *current)
	}
	return files
}

func parseHunkHeader(line string) DiffHunk {
	hunk := DiffHunk{Header: line}
	var oldStart, oldLines, newStart, newLines int
	_, _ = fmt.Sscanf(line, "@@ -%d,%d +%d,%d @@",
		&oldStart, &oldLines, &newStart, &newLines)
	hunk.OldStart = oldStart
	hunk.OldLines = oldLines
	hunk.NewStart = newStart
	hunk.NewLines = newLines
	return hunk
}

func changesFromObjectDiff(changes object.Changes) ([]DiffFile, error) {
	var result []DiffFile
	for _, change := range changes {
		patch, err := change.Patch()
		if err != nil {
			continue
		}
		for _, fp := range patch.FilePatches() {
			from, to := fp.Files()
			df := DiffFile{}
			if from != nil {
				df.OldPath = from.Path()
			}
			if to != nil {
				df.Path = to.Path()
			}
			if df.Path == "" {
				df.Path = df.OldPath
			}
			df.Binary = fp.IsBinary()

			if !df.Binary {
				var currentHunk *DiffHunk
				for _, chunk := range fp.Chunks() {
					switch chunk.Type() {
					case fdiff.Add, fdiff.Delete, fdiff.Equal:
						if currentHunk == nil {
							df.Hunks = append(df.Hunks, DiffHunk{Header: "@@ chunk @@"})
							currentHunk = &df.Hunks[len(df.Hunks)-1]
						}
						for _, line := range strings.Split(strings.TrimRight(chunk.Content(), "\n"), "\n") {
							switch chunk.Type() {
							case fdiff.Add:
								currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: "add", Content: line})
							case fdiff.Delete:
								currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: "del", Content: line})
							default:
								currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: "ctx", Content: line})
							}
						}
					}
				}
			}
			result = append(result, df)
		}
	}
	return result, nil
}
