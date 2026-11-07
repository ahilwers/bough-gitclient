# AGENTS.md - Bough Git GUI Client

High-signal guidance for OpenCode agents working in this repository.

## Commands & Directories

**Prerequisites:** Go 1.27+ and Node.js 22. Wails v2.17.1 is pinned as a Go tool in `app/go.mod`; use `go tool wails` from `app/`, not a globally installed CLI.

**All Wails development commands must be run from `app/` directory:**
```bash
cd app && go tool wails dev    # Full dev server with hot reload (Go + React)
cd app && go tool wails build  # Production build → app/build/bin/Bough.app
cd app && go mod download  # Download pinned Go dependencies
cd app && go mod tidy      # After changing Go dependencies
```

**Frontend-only commands (run from `app/frontend/`):**
```bash
cd app/frontend && npm install
cd app/frontend && npm run dev     # Vite dev server
cd app/frontend && npm run build   # Frontend build
cd app/frontend && npm test        # Vitest unit tests
```

**Make commands (run from root):**
```bash
make dev            # Wails dev server (cd app && go tool wails dev)
make build-wails    # Production Wails build
make test           # Go backend tests with race detector
make test-frontend  # Frontend Vitest tests
make test-e2e       # Playwright E2E tests
make clean          # Remove build artifacts
```

## Architecture & Conventions

**Git Backend Split:**
- **Read operations**: Use `go-git` (history, diff, status, branches, refs)
- **Write operations**: Use `exec.Command git` (push/pull/fetch for auth, GPG, hooks)

**IPC Pattern (Wails 2.10+):**
- Go methods on `App` struct auto-bind to frontend
- Frontend imports from `../wailsjs/go/main/App`
- **Never** use raw JSON over stdin/stdout

**Version Embedding:**
Builds embed version via Makefile `LDFLAGS`:
```bash
-X main.version=$(git describe --tags --always --dirty) -X main.buildDate=$(date -u +%Y-%m-%d)
```

**Testing:**
- Go: `go test -race -cover ./...` (run from `app/`)
- Frontend: Vitest (run from `app/frontend`)
- E2E: Playwright tests in `app/frontend/tests/e2e/`

**Frontend Stack:**
- React 19 + TypeScript 5 + Vite
- Zustand for app state, TanStack Query v5 for async/cache
- Tailwind CSS 4 with CSS custom properties (design tokens in `global.css`)
- Monaco Editor for diff viewer, Radix UI for components

**Type System:**
Canonical Go types in `app/git/types.go` mirrored as TypeScript interfaces:
- `CommitNode`, `DiffFile`, `DiffHunk`, `DiffLine`, `FileStatus`, `WorktreeInfo`, `RepoStatus`

## Directory Structure

```
app/
├── main.go                # Wails entry point
├── app.go                 # App struct with bound methods
├── git/                   # Go Git backend
│   ├── types.go           # Canonical types
│   ├── commits.go         # History/log operations
│   ├── diff.go            # Diff generation
│   ├── status.go          # Repository status
│   ├── branches.go        # Branch operations
│   ├── worktrees.go       # Worktree management
│   ├── staging.go         # Stage/unstage operations
│   └── watcher.go         # Filesystem watching (fsnotify)
├── frontend/              # React app
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom hooks (useCommits, useStatus, etc.)
│   │   ├── store/         # Zustand store
│   │   ├── types/         # TypeScript type mirrors
│   │   └── globals.css    # CSS custom properties (design tokens)
├── update/                # Platform-specific updaters
└── wails.json             # Wails configuration

plans/                     # Implementation plans (read before coding)
scripts/                   # Build/deploy utilities
```

## Key Implementation Notes

**Commit Graph:**
- Rendered on `<canvas>` for performance
- DOM rows absolutely positioned in sync with canvas scroll
- Column/color layout computed in Go, returned as part of `CommitNode`

**Staging:**
- Per-hunk and per-line staging in Changes view
- `StageHunk`/`UnstageHunk`/`DiscardHunk` accept constructed patch strings
- Frontend `diffUtils.ts` builds minimal valid patches from selected lines

**Auto-update:**
- Sparkle 2 (macOS), WinSparkle (Windows), AppImageUpdate (Linux)
- EdDSA signatures required on all update artifacts
- Single appcast XML served from fixed URL

## Before Implementing Features

**Always read the relevant plan file first:**
- `plans/00-overview.md` - Phase roadmap
- `plans/01-setup.md` - Wails scaffold, dependencies
- `plans/02-git-backend.md` - Go types, backend methods
- `plans/03-commit-graph.md` - Canvas graph renderer
- `plans/04-frontend.md` - App shell, shared components  
- `plans/05-history-view.md` - History view, diff viewer
- `plans/06-changes-view.md` - Staging, chunk diff
- `plans/07-worktrees.md` - Worktree management
- `plans/08-updates-distribution.md` - CI/CD, signing
- `plans/09-licensing.md` - Note on the removed payment and licensing system

Feature plans have verification checklists — confirm completeness before moving on.

## Verification Commands

After changes, run in order:
1. `cd app/frontend && npm run build` (frontend build)
2. `cd app && go tool wails build` (full production build)
3. `make test && make test-frontend` (unit tests)
4. Check real Git repos (100+, 1000+, 10000+ commits)
5. Test cross-platform: macOS x86_64/ARM, Windows, Linux

## Imported Claude Cowork project instructions
