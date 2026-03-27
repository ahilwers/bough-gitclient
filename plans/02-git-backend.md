# Bough – Plan 02: Go Git Backend

**Phase:** 1–2 (Weeks 2–8)
**Prerequisite:** `01-setup.md` complete
**Goal:** A complete Go backend covering all git operations Bough needs, with typed structs that map cleanly to the TypeScript frontend.

---

## 1. Architecture Decisions

### go-git vs. CLI-git

| Operation | Library | Reason |
|---|---|---|
| Open repository | go-git | Fast, no process spawn |
| Read commits, log | go-git | Native struct access, no output parsing |
| Compute diff | go-git | Efficient, typed patches |
| Read staging index | go-git | Direct index file access |
| Stage / unstage hunks | go-git | Manipulates index directly |
| Create commit | go-git | Works without external process |
| Push / Pull / Fetch | CLI-git | SSH agent, credential helpers, NTLM |
| Rebase / Cherry-pick | CLI-git | Complex operations; go-git support is incomplete |
| Worktree add / remove | CLI-git | Filesystem operations not fully in go-git |
| GPG signing | CLI-git | Requires gpg binary |
| Git hooks | CLI-git | Hooks are shell scripts; must run via OS |

### Data Flow
```
Frontend (TypeScript)
    ↕ Wails IPC (JSON)
App struct (app.go)
    ↕ function calls
git/ package (Go)
    ↕ go-git / exec.Command
.git/ directory on disk
```

---

## 2. Shared Data Types (`git/types.go`)

Define all structs here. Wails will auto-generate TypeScript types.

```go
package git

import "time"

// CommitNode is one entry in the graph — it carries both git data
// and pre-computed layout information for the Canvas renderer.
type CommitNode struct {
    Hash      string    `json:"hash"`      // full 40-char SHA
    ShortHash string    `json:"shortHash"` // first 7 chars
    Message   string    `json:"message"`   // first line only
    Author    string    `json:"author"`
    Email     string    `json:"email"`
    Date      time.Time `json:"date"`
    Parents   []string  `json:"parents"` // parent hashes (full SHA)
    Refs      []Ref     `json:"refs"`    // branches/tags pointing here

    // Graph layout (pre-computed by swimlane algorithm)
    Column    int       `json:"column"`  // swimlane index (0-based)
    Color     int       `json:"color"`   // branch color index (0-7)
    Lines     []GraphLine `json:"lines"` // lines to draw below this commit
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
    Staged   string `json:"staged"`   // "M"|"A"|"D"|"R"|"?"|""
    Unstaged string `json:"unstaged"` // same codes
    Added    int    `json:"added"`    // line counts for quick display
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
    Header    string     `json:"header"`    // e.g. "@@ -12,8 +12,22 @@"
    OldStart  int        `json:"oldStart"`
    OldLines  int        `json:"oldLines"`
    NewStart  int        `json:"newStart"`
    NewLines  int        `json:"newLines"`
    Lines     []DiffLine `json:"lines"`
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
    Date    time.Time `json:"date"`
}

// WorktreeInfo describes one git worktree.
type WorktreeInfo struct {
    Path    string `json:"path"`
    Branch  string `json:"branch"`
    Head    string `json:"head"`    // short hash
    IsMain  bool   `json:"isMain"`
    IsDirty bool   `json:"isDirty"`
}

// RepoStatus summarises the current state of a repository.
type RepoStatus struct {
    Branch     string       `json:"branch"`
    Ahead      int          `json:"ahead"`
    Behind     int          `json:"behind"`
    Files      []FileStatus `json:"files"`
    HasConflicts bool       `json:"hasConflicts"`
}
```

---

## 3. Repository Management (`git/repository.go`)

```go
package git

import (
    "errors"
    "os"
    "path/filepath"

    gogit "github.com/go-git/go-git/v5"
    "github.com/go-git/go-git/v5/plumbing"
)

type Repository struct {
    repo *gogit.Repository
    Path string // absolute path to the worktree root
}

// Open opens a git repository, searching upward for .git if needed.
func Open(path string) (*Repository, error) {
    abs, err := filepath.Abs(path)
    if err != nil {
        return nil, err
    }
    repo, err := gogit.PlainOpenWithOptions(abs, &gogit.PlainOpenOptions{
        DetectDotGit:          true,
        EnableDotGitCommonDir: true, // required for linked worktrees
    })
    if err != nil {
        if errors.Is(err, gogit.ErrRepositoryNotExists) {
            return nil, ErrNotARepo
        }
        return nil, err
    }
    // Resolve the actual worktree path (not the .git path)
    wt, err := repo.Worktree()
    if err != nil {
        return nil, err
    }
    return &Repository{repo: repo, Path: wt.Filesystem.Root()}, nil
}

var ErrNotARepo = errors.New("not a git repository")

// CurrentBranch returns the name of the currently checked-out branch,
// or "HEAD" if in detached HEAD state.
func (r *Repository) CurrentBranch() (string, error) {
    head, err := r.repo.Head()
    if err != nil {
        return "", err
    }
    if head.Name().IsBranch() {
        return head.Name().Short(), nil
    }
    return "HEAD", nil // detached HEAD
}

// Status returns the current working copy status.
func (r *Repository) Status() (RepoStatus, error) {
    wt, err := r.repo.Worktree()
    if err != nil {
        return RepoStatus{}, err
    }

    status, err := wt.Status()
    if err != nil {
        return RepoStatus{}, err
    }

    branch, _ := r.CurrentBranch()
    var files []FileStatus
    hasConflicts := false

    for path, s := range status {
        staged   := string(s.Staging)
        unstaged := string(s.Worktree)
        if staged == "?" && unstaged == "?" {
            staged = "?"
            unstaged = ""
        }
        if staged == "U" || unstaged == "U" {
            hasConflicts = true
        }
        files = append(files, FileStatus{
            Path:     path,
            Staged:   staged,
            Unstaged: unstaged,
        })
    }

    return RepoStatus{
        Branch:       branch,
        Files:        files,
        HasConflicts: hasConflicts,
    }, nil
}
```

---

## 4. Commit Log & Graph Layout (`git/commits.go`)

### 4.1 Reading Commits

```go
package git

import (
    "sort"

    gogit "github.com/go-git/go-git/v5"
    "github.com/go-git/go-git/v5/plumbing"
    "github.com/go-git/go-git/v5/plumbing/object"
)

const maxCommits = 5000 // cap for initial load; use pagination for more

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
            return gogit.ErrStop // stop early
        }
        return nil
    })
    if err != nil && err != gogit.ErrStop {
        return nil, err
    }

    // Run layout algorithm
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

    remotes, _ := r.repo.References()
    _ = remotes.ForEach(func(ref *plumbing.Reference) error {
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
```

### 4.2 Swimlane Layout Algorithm

```go
// computeLayout assigns each commit to a swimlane column and computes
// the connecting lines that the Canvas renderer will draw.
func computeLayout(commits []*object.Commit, refs map[plumbing.Hash][]Ref) []CommitNode {
    if len(commits) == 0 {
        return nil
    }

    // hashIndex maps commit hash → row index for O(1) parent lookup
    hashIndex := make(map[string]int, len(commits))
    for i, c := range commits {
        hashIndex[c.Hash.String()] = i
    }

    // columns[col] = hash of the commit currently "owning" that lane
    // A lane is freed when its commit has been placed.
    lanes := make([]string, 0, 8) // current open lanes (by commit hash)

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
            // This commit is the start of a new branch — find the first free lane
            col = len(lanes)
            lanes = append(lanes, hash)
        }

        color := col % 8

        // Collect lines from this row to the next
        var lines []GraphLine

        // For each parent, claim a lane (or continue existing one)
        for pi, parent := range c.ParentHashes {
            ph := parent.String()
            // Find or claim a lane for this parent
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
```

---

## 5. Diff Computation (`git/diff.go`)

```go
package git

import (
    "strings"

    gogit "github.com/go-git/go-git/v5"
    "github.com/go-git/go-git/v5/plumbing"
    "github.com/go-git/go-git/v5/plumbing/object"
    "github.com/go-git/go-git/v5/plumbing/format/diff"
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

    changes, err := parentTree.Diff(currentTree)
    if err != nil {
        return nil, err
    }

    return changesFromObjectDiff(changes)
}

// GetFileDiff returns the staged or unstaged diff for a working-copy file.
// staged=true: compares HEAD vs index; staged=false: compares index vs worktree.
func (r *Repository) GetFileDiff(filePath string, staged bool) (*DiffFile, error) {
    out, err := CLI(r.Path, "diff",
        "--unified=3",
        "--no-color",
        func() string {
            if staged {
                return "--cached"
            }
            return ""
        }(),
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
            currentHunk = &hunk
            oldNo = hunk.OldStart
            newNo = hunk.NewStart
            current.Hunks = append(current.Hunks, *currentHunk)
            // Update reference to last element
            currentHunk = &current.Hunks[len(current.Hunks)-1]

        case currentHunk != nil && len(rawLine) > 0:
            prefix := string(rawLine[0])
            content := rawLine[1:]
            var lineType string
            switch prefix {
            case "+":
                lineType = "add"
                currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: lineType, Content: content, NewNo: newNo})
                newNo++
            case "-":
                lineType = "del"
                currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: lineType, Content: content, OldNo: oldNo})
                oldNo++
            default:
                lineType = "ctx"
                currentHunk.Lines = append(currentHunk.Lines, DiffLine{Type: lineType, Content: content, OldNo: oldNo, NewNo: newNo})
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
    // Parses "@@ -oldStart,oldLines +newStart,newLines @@ optional context"
    hunk := DiffHunk{Header: line}
    // Simple sscanf-style parse
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

            for _, chunk := range fp.Chunks() {
                // Simplified: convert chunks to DiffHunk
                // Full implementation would track line numbers properly
                hunk := DiffHunk{Header: "@@ chunk @@"}
                for _, line := range strings.Split(chunk.Content(), "\n") {
                    switch chunk.Type() {
                    case diff.Add:
                        hunk.Lines = append(hunk.Lines, DiffLine{Type: "add", Content: line})
                    case diff.Delete:
                        hunk.Lines = append(hunk.Lines, DiffLine{Type: "del", Content: line})
                    default:
                        hunk.Lines = append(hunk.Lines, DiffLine{Type: "ctx", Content: line})
                    }
                }
                df.Hunks = append(df.Hunks, hunk)
            }
            result = append(result, df)
        }
    }
    return result, nil
}
```

---

## 6. Staging (`git/staging.go`)

```go
package git

import (
    "fmt"
    "strings"

    "github.com/go-git/go-git/v5/plumbing/format/index"
)

// StageFile stages an entire file (equivalent to `git add <file>`).
func (r *Repository) StageFile(filePath string) error {
    wt, err := r.repo.Worktree()
    if err != nil {
        return err
    }
    _, err = wt.Add(filePath)
    return err
}

// UnstageFile unstages an entire file (equivalent to `git restore --staged <file>`).
func (r *Repository) UnstageFile(filePath string) error {
    _, err := CLI(r.Path, "restore", "--staged", "--", filePath)
    return err
}

// StageHunk stages a single hunk by generating a patch and applying it with `git apply --cached`.
// hunkPatch must be a valid unified diff patch string for exactly one hunk.
func (r *Repository) StageHunk(hunkPatch string) error {
    _, err := CLI(r.Path, "apply", "--cached", "--unidiff-zero", "-")
    // In practice: pipe hunkPatch to stdin of the process
    // Use exec.Command with stdin pipe — see implementation note below
    return err
}

// StageHunkViaApply is the production implementation using stdin pipe.
func (r *Repository) StageHunkViaApply(hunkPatch string) error {
    cmd := execGit(r.Path, "apply", "--cached", "--unidiff-zero", "-")
    cmd.Stdin = strings.NewReader(hunkPatch)
    out, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("git apply: %w\n%s", err, string(out))
    }
    return nil
}

// DiscardHunk discards a hunk from the working tree (irreversible).
// Uses `git apply -R` (reverse) to undo changes in the worktree.
func (r *Repository) DiscardHunk(hunkPatch string) error {
    cmd := execGit(r.Path, "apply", "-R", "--unidiff-zero", "-")
    cmd.Stdin = strings.NewReader(hunkPatch)
    out, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("git apply -R: %w\n%s", err, string(out))
    }
    return nil
}

// CreateCommit creates a commit with the given message.
func (r *Repository) CreateCommit(message string) (string, error) {
    wt, err := r.repo.Worktree()
    if err != nil {
        return "", err
    }
    // Read the current user config
    cfg, err := r.repo.ConfigScoped(config.GlobalScope)
    if err != nil {
        return "", err
    }
    author := object.Signature{
        Name:  cfg.User.Name,
        Email: cfg.User.Email,
        When:  time.Now(),
    }
    hash, err := wt.Commit(message, &gogit.CommitOptions{
        Author:    &author,
        Committer: &author,
    })
    if err != nil {
        return "", err
    }
    return hash.String()[:7], nil
}

// AmendCommit amends the last commit with the staged changes and new message.
func (r *Repository) AmendCommit(message string) error {
    args := []string{"commit", "--amend", "--no-edit"}
    if message != "" {
        args = append(args, "-m", message)
    }
    _, err := CLI(r.Path, args...)
    return err
}
```

---

## 7. CLI Wrapper (`git/cli.go`)

```go
package git

import (
    "bytes"
    "fmt"
    "os/exec"
)

// CLI runs a git command and returns stdout as a string.
// Empty args are ignored (useful for conditional flags).
func CLI(dir string, args ...string) (string, error) {
    filtered := args[:0]
    for _, a := range args {
        if a != "" {
            filtered = append(filtered, a)
        }
    }
    cmd := execGit(dir, filtered...)
    var stdout, stderr bytes.Buffer
    cmd.Stdout = &stdout
    cmd.Stderr = &stderr
    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("git %v: %w\n%s", filtered, err, stderr.String())
    }
    return stdout.String(), nil
}

// execGit creates an exec.Cmd for git without running it.
// Use this when you need to set Stdin or capture output separately.
func execGit(dir string, args ...string) *exec.Cmd {
    cmd := exec.Command("git", args...)
    cmd.Dir = dir
    return cmd
}
```

---

## 7a. Authentication (`git/auth.go`)

Bough delegates all authentication to the system SSH agent and Git's own credential helper system. This file provides two things:

1. **Startup check** — detect and auto-configure a sensible OS credential helper if none is set.
2. **Auth error handling** — detect authentication failures from CLI operations and surface them to the frontend so a credential dialog can be shown.

```go
package git

import (
    "errors"
    "os/exec"
    "runtime"
    "strings"
)

// ErrAuthFailed is returned when a CLI-git operation fails due to authentication.
var ErrAuthFailed = errors.New("git: authentication failed")

// EnsureCredentialHelper checks whether a global credential.helper is configured.
// If not, it sets the OS-native default. Called once at app startup.
func EnsureCredentialHelper() error {
    // Check current value
    out, _ := exec.Command("git", "config", "--global", "credential.helper").Output()
    current := strings.TrimSpace(string(out))
    if current != "" {
        return nil // already configured, nothing to do
    }

    // Choose OS-native helper
    var helper string
    switch runtime.GOOS {
    case "darwin":
        // osxkeychain ships with Xcode Command Line Tools
        helper = "osxkeychain"
    case "windows":
        // Git Credential Manager ships with Git for Windows
        // Check if it's available before setting
        if _, err := exec.LookPath("git-credential-manager"); err == nil {
            helper = "manager"
        } else {
            helper = "wincred"
        }
    default: // linux and others
        // Prefer libsecret (GNOME/KDE keyring) if available
        if _, err := exec.LookPath("git-credential-libsecret"); err == nil {
            helper = "libsecret"
        } else {
            // Fall back to file-based store (less secure, but universal)
            helper = "store"
        }
    }

    if helper == "" {
        return nil // no suitable helper found; operations will fail with ErrAuthFailed
    }

    cmd := exec.Command("git", "config", "--global", "credential.helper", helper)
    if out, err := cmd.CombinedOutput(); err != nil {
        return fmt.Errorf("could not set credential helper %q: %w\n%s", helper, err, out)
    }
    return nil
}

// IsAuthError inspects a git CLI error message and returns true if it indicates
// an authentication failure (wrong credentials, no credentials, or SSH rejection).
func IsAuthError(err error) bool {
    if err == nil {
        return false
    }
    msg := strings.ToLower(err.Error())
    triggers := []string{
        "authentication failed",
        "could not read username",
        "could not read password",
        "permission denied (publickey",
        "invalid username or password",
        "http basic: access denied",
        "fatal: repository not found",   // often means 403 / wrong creds on GitHub
        "remote: invalid username",
    }
    for _, t := range triggers {
        if strings.Contains(msg, t) {
            return true
        }
    }
    return false
}

// StoreCredentials writes a username/password pair for a given URL into the
// configured credential helper via `git credential approve`.
// Called after the user enters credentials in Bough's credential dialog.
func StoreCredentials(repoURL, username, password string) error {
    // Parse protocol and host from URL for the git credential format
    proto, host := parseURLParts(repoURL)
    input := fmt.Sprintf("protocol=%s\nhost=%s\nusername=%s\npassword=%s\n\n",
        proto, host, username, password)

    cmd := exec.Command("git", "credential", "approve")
    cmd.Stdin = strings.NewReader(input)
    if out, err := cmd.CombinedOutput(); err != nil {
        return fmt.Errorf("git credential approve: %w\n%s", err, out)
    }
    return nil
}

// parseURLParts is a minimal parser that extracts protocol and host
// from git remote URLs like "https://github.com/user/repo.git"
func parseURLParts(rawURL string) (protocol, host string) {
    if strings.HasPrefix(rawURL, "https://") {
        rest := strings.TrimPrefix(rawURL, "https://")
        parts := strings.SplitN(rest, "/", 2)
        return "https", parts[0]
    }
    if strings.HasPrefix(rawURL, "http://") {
        rest := strings.TrimPrefix(rawURL, "http://")
        parts := strings.SplitN(rest, "/", 2)
        return "http", parts[0]
    }
    // SSH URLs (git@github.com:...) don't use git credential; skip
    return "", ""
}
```

### SSH Authentication

Bough does **not** manage SSH keys. All SSH authentication is handled by the system SSH agent:
- macOS: The system Keychain automatically loads keys from `~/.ssh/` and the SSH agent.
- Windows: Pageant (PuTTY) or the OpenSSH service built into Windows 10+.
- Linux: `ssh-agent` started by the desktop session, keys loaded via `ssh-add`.

When `CLI()` runs `git push/pull/fetch`, git calls `ssh` internally. The SSH binary picks up the agent socket from the `SSH_AUTH_SOCK` environment variable. Bough must preserve this variable when launching git subprocesses.

Update `execGit()` in `cli.go` to inherit the full environment (it already does via `exec.Command`, which inherits the parent process environment by default — no change required unless Bough is launched from a context without `SSH_AUTH_SOCK`, e.g. a macOS .app bundle).

**macOS .app note:** Wails macOS builds launch via `launchd`, which does not inherit the SSH agent socket from the terminal. To fix this, Bough reads the socket path from `launchctl getenv SSH_AUTH_SOCK` at startup and injects it:

```go
// In app.go OnStartup():
func ensureSSHAgent() {
    if os.Getenv("SSH_AUTH_SOCK") != "" {
        return // already set (e.g. launched from terminal)
    }
    out, err := exec.Command("launchctl", "getenv", "SSH_AUTH_SOCK").Output()
    if err == nil {
        sock := strings.TrimSpace(string(out))
        if sock != "" {
            os.Setenv("SSH_AUTH_SOCK", sock)
        }
    }
}
```

---

## 8. Filesystem Watcher (`git/watcher.go`)

```go
package git

import (
    "path/filepath"
    "sync"

    "github.com/fsnotify/fsnotify"
)

// Watcher monitors one or more repository paths and fires a callback
// when the .git directory changes (new commits, branch switches, etc.).
type Watcher struct {
    watcher   *fsnotify.Watcher
    callbacks []func(path string)
    mu        sync.Mutex
}

func NewWatcher() (*Watcher, error) {
    fw, err := fsnotify.NewWatcher()
    if err != nil {
        return nil, err
    }
    w := &Watcher{watcher: fw}
    go w.loop()
    return w, nil
}

// Watch adds a repository path to the watch list.
func (w *Watcher) Watch(repoPath string) error {
    gitDir := filepath.Join(repoPath, ".git")
    return w.watcher.Add(gitDir)
}

// Unwatch removes a path from the watch list.
func (w *Watcher) Unwatch(repoPath string) error {
    gitDir := filepath.Join(repoPath, ".git")
    return w.watcher.Remove(gitDir)
}

// OnChange registers a callback that fires when any watched path changes.
func (w *Watcher) OnChange(fn func(path string)) {
    w.mu.Lock()
    defer w.mu.Unlock()
    w.callbacks = append(w.callbacks, fn)
}

func (w *Watcher) loop() {
    for {
        select {
        case event, ok := <-w.watcher.Events:
            if !ok {
                return
            }
            // Only care about changes to key files
            base := filepath.Base(event.Name)
            if base == "HEAD" || base == "index" || base == "COMMIT_EDITMSG" || base == "packed-refs" {
                w.mu.Lock()
                cbs := w.callbacks
                w.mu.Unlock()
                for _, cb := range cbs {
                    go cb(filepath.Dir(filepath.Dir(event.Name)))
                }
            }
        case _, ok := <-w.watcher.Errors:
            if !ok {
                return
            }
        }
    }
}

func (w *Watcher) Close() {
    w.watcher.Close()
}
```

---

## 9. Wiring into `app.go`

All git operations are exposed as methods on `App`. Wails generates TypeScript bindings for each exported method.

```go
package main

import (
    "context"

    gitpkg "bough/git"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
    ctx     context.Context
    repo    *gitpkg.Repository
    watcher *gitpkg.Watcher
}

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx

    // Ensure SSH_AUTH_SOCK is set for macOS .app bundles launched via launchd
    gitpkg.EnsureSSHAgent()

    // Auto-configure OS-native credential helper if none is set
    if err := gitpkg.EnsureCredentialHelper(); err != nil {
        runtime.LogWarning(ctx, "Could not configure credential helper: "+err.Error())
    }

    var err error
    a.watcher, err = gitpkg.NewWatcher()
    if err != nil {
        runtime.LogError(ctx, "Failed to create watcher: "+err.Error())
        return
    }
    a.watcher.OnChange(func(path string) {
        // Notify the frontend via Wails event
        runtime.EventsEmit(ctx, "repo:changed", path)
    })
}

// --- Repository ---

func (a *App) OpenRepository(path string) (string, error) {
    repo, err := gitpkg.Open(path)
    if err != nil {
        return "", err
    }
    a.repo = repo
    _ = a.watcher.Watch(path)
    return repo.Path, nil
}

// --- Commits ---

func (a *App) GetCommits(limit int) ([]gitpkg.CommitNode, error) {
    if a.repo == nil {
        return nil, gitpkg.ErrNotARepo
    }
    return a.repo.GetCommits(limit)
}

func (a *App) GetCommitDiff(hash string) ([]gitpkg.DiffFile, error) {
    if a.repo == nil {
        return nil, gitpkg.ErrNotARepo
    }
    return a.repo.GetCommitDiff(hash)
}

// --- Status & Diff ---

func (a *App) GetStatus() (gitpkg.RepoStatus, error) {
    if a.repo == nil {
        return gitpkg.RepoStatus{}, gitpkg.ErrNotARepo
    }
    return a.repo.Status()
}

func (a *App) GetFileDiff(filePath string, staged bool) (*gitpkg.DiffFile, error) {
    if a.repo == nil {
        return nil, gitpkg.ErrNotARepo
    }
    return a.repo.GetFileDiff(filePath, staged)
}

// --- Staging ---

func (a *App) StageFile(filePath string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    return a.repo.StageFile(filePath)
}

func (a *App) UnstageFile(filePath string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    return a.repo.UnstageFile(filePath)
}

func (a *App) StageHunk(patch string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    return a.repo.StageHunkViaApply(patch)
}

func (a *App) DiscardHunk(patch string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    return a.repo.DiscardHunk(patch)
}

func (a *App) CreateCommit(message string) (string, error) {
    if a.repo == nil {
        return "", gitpkg.ErrNotARepo
    }
    return a.repo.CreateCommit(message)
}

func (a *App) AmendCommit(message string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    return a.repo.AmendCommit(message)
}

// --- Remote operations (CLI-git) ---

func (a *App) Fetch(remote string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    args := []string{"fetch"}
    if remote != "" {
        args = append(args, remote)
    }
    _, err := gitpkg.CLI(a.repo.Path, args...)
    return err
}

func (a *App) Pull(remote, branch string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    _, err := gitpkg.CLI(a.repo.Path, "pull", remote, branch)
    return err
}

func (a *App) Push(remote, branch string, force bool) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    args := []string{"push", remote, branch}
    if force {
        args = append(args, "--force-with-lease")
    }
    _, err := gitpkg.CLI(a.repo.Path, args...)
    if gitpkg.IsAuthError(err) {
        return gitpkg.ErrAuthFailed
    }
    return err
}

// StoreCredentials is called by the frontend after the user enters credentials
// in the credential dialog. It writes them into the configured git credential helper.
func (a *App) StoreCredentials(repoURL, username, password string) error {
    return gitpkg.StoreCredentials(repoURL, username, password)
}
```

### Auth Error Flow

When `Push`, `Pull`, or `Fetch` returns `ErrAuthFailed` (as a rejected Promise on the frontend):

1. TanStack Query's `onError` callback checks if `error.message` contains `"git: authentication failed"`.
2. If yes, the global Zustand store sets `needsCredentials: { url, operation }`.
3. The `CredentialDialog` component (in `components/shared/`) renders as a modal overlay.
4. User enters username + password → frontend calls `StoreCredentials(url, username, password)`.
5. The original operation is retried automatically via `queryClient.invalidateQueries()`.

This keeps all credential storage inside the OS keychain — Bough never holds passwords in memory beyond the duration of a single operation.

---

## 10. Testing the Backend

Create `git/repository_test.go`:

```go
package git_test

import (
    "os"
    "testing"

    "bough/git"
)

func TestOpenRepository(t *testing.T) {
    // Use the bough repo itself as a test fixture
    cwd, _ := os.Getwd()
    repo, err := git.Open(cwd + "/..")
    if err != nil {
        t.Fatalf("Open failed: %v", err)
    }
    if repo.Path == "" {
        t.Fatal("repo.Path is empty")
    }
}

func TestGetCommits(t *testing.T) {
    cwd, _ := os.Getwd()
    repo, _ := git.Open(cwd + "/..")

    commits, err := repo.GetCommits(50)
    if err != nil {
        t.Fatalf("GetCommits failed: %v", err)
    }
    if len(commits) == 0 {
        t.Fatal("no commits returned")
    }
    // Verify layout fields are set
    for i, c := range commits {
        if c.Hash == "" {
            t.Errorf("commit[%d] has empty hash", i)
        }
        if c.Column < 0 {
            t.Errorf("commit[%d] has negative column", i)
        }
    }
}

func TestGetStatus(t *testing.T) {
    cwd, _ := os.Getwd()
    repo, _ := git.Open(cwd + "/..")

    status, err := repo.Status()
    if err != nil {
        t.Fatalf("Status failed: %v", err)
    }
    // Branch should not be empty
    if status.Branch == "" {
        t.Error("Branch is empty")
    }
}
```

Run with:
```bash
go test ./git/... -v
```

---

## 11. Checklist

- [ ] `OpenRepository` works on a real local repo
- [ ] `GetCommits(100)` returns commits with non-empty `Column` and `Color`
- [ ] `GetStatus()` returns correct file list for a dirty worktree
- [ ] `GetFileDiff()` returns valid hunks for a modified file
- [ ] `StageFile()` moves a file from unstaged to staged (verify with `git status`)
- [ ] `CLI()` runs `git fetch` successfully in a repo with a remote
- [ ] fsnotify watcher triggers callback when `HEAD` changes
- [ ] `EnsureCredentialHelper()` sets OS-native helper when none configured
- [ ] `EnsureSSHAgent()` injects `SSH_AUTH_SOCK` on macOS .app launch

**Automated tests (see `10-testing.md` for full test code):**
- [ ] `app/git/repository_test.go` — `TestOpen`, `TestOpen_NotARepo`
- [ ] `app/git/commits_test.go` — `TestGetCommits`, `TestGetCommits_GraphLayout`
- [ ] `app/git/diff_test.go` — `TestGetFileDiff`
- [ ] `app/git/staging_test.go` — `TestStageAndCommit`
- [ ] `go test -race ./...` passes with no data race warnings

**Next steps:** `03-commit-graph.md` (Canvas renderer) and `04-frontend.md` (React architecture) can be worked on in parallel.
