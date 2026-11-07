# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Bough

A cross-platform, native Git GUI client for macOS (primary), Windows, and Linux. No usage restrictions or bundled Chromium.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Wails 2 (Go backend + native WebView, typed IPC) |
| Backend | Go 1.27+ |
| Git reads | go-git v5 |
| Git writes (push/pull/fetch) | CLI exec.Command (for auth, GPG, hooks) |
| Filesystem watching | fsnotify |
| Frontend | React 19 + TypeScript 5 |
| Styling | Tailwind CSS 4 + CSS custom properties design tokens |
| UI components | shadcn/ui + Radix UI |
| State | Zustand |
| Async/cache | TanStack Query v5 |
| Diff viewer | Monaco Editor |
| Animations | Framer Motion |
| Auto-update | Sparkle 2 (macOS), WinSparkle (Windows), AppImageUpdate (Linux) |

## Development Commands

Requires Go 1.27+ and Node.js 22. Wails v2.17.1 is pinned as a Go tool in `app/go.mod`; no global CLI installation is needed. All Wails commands must be run from `app/`:

```bash
# Start dev server (hot reload, Go + frontend)
cd app && go tool wails dev

# Production build  →  app/build/bin/Bough.app
cd app && go tool wails build

# Download pinned Go dependencies (including the Wails tool)
cd app && go mod download

# After changing Go dependencies
cd app && go mod tidy

# Frontend only
cd app/frontend && npm install
cd app/frontend && npm run dev
cd app/frontend && npm run build
```

## Repository Layout

```
app/            # Wails app (Wails 2 + React scaffold)
  main.go
  app.go        # Go backend methods bound to frontend via Wails
  frontend/     # React + TypeScript SPA
    src/
      components/
      hooks/
      store/    # Zustand store
      i18n/     # EN + DE translations
docs/           # Design and architecture documents
```

## Architecture

### IPC Pattern
Go methods on the `App` struct are automatically bound to the frontend by Wails. The frontend calls them as typed async functions. Never use raw JSON over stdin/stdout.

### Git Backend Strategy
- Use **go-git** for all read operations (log, diff, status, branches, refs).
- Use **exec.Command git** for write operations that need credentials or hooks (push, pull, fetch, commit signing).
- `RepoStatus`, `CommitNode`, `DiffFile`, `DiffHunk`, `DiffLine`, `FileStatus`, `WorktreeInfo` are the canonical shared types defined in the Go backend and mirrored as TypeScript interfaces.

### Frontend State
- **Zustand store**: theme, active view, selected commit hash, selected file, notifications, sidebar collapse state.
- **TanStack Query**: all Go backend calls go through query/mutation hooks. Keys follow `[entity, repoPath, ...args]` pattern.
- Custom hooks (`useCommits`, `useStatus`, `useBranches`, `useWorktrees`) encapsulate query logic and are the only way components access backend data.

### Commit Graph
Rendered on a `<canvas>` (Canvas 2D API) for performance. DOM rows are absolutely positioned in sync with the canvas scroll position. Column/color layout is computed in Go and returned as part of `CommitNode`.

### Styling
All colors, spacing, and layout constants use CSS custom properties defined in `global.css`. Tailwind utilities reference these tokens via `var(--token-name)`. Do not hardcode color values. Light and dark themes are both defined at `:root` level, toggled by a class on `<html>`.

Key layout constants: titlebar 40px, toolbar 44px, sidebar 200px, commit row 34px.

### Design Tokens (CSS custom properties)
- Background: `--bg-window`, `--bg-titlebar`, `--bg-toolbar`, `--bg-sidebar`, `--bg-content`, `--bg-panel`
- Text: `--text-pri`, `--text-sec`, `--text-ter`, `--text-acc`
- Accent/semantic: `--acc`, `--danger`, `--success`, `--warn`
- Diff: `--bg-add`, `--bg-del`, `--bg-hunk`, `--text-add`, `--text-del`
- Graph lines: `--line-0` through `--line-7`
- Borders: `--border-sub`, `--border`, `--border-str`

### Chunk-Level Staging
The Changes view supports per-hunk and per-line staging. `StageHunk` / `UnstageHunk` / `DiscardHunk` Go methods accept a constructed patch string. The frontend's `diffUtils` module is responsible for building minimal valid patches from selected lines.

### Auto-Update
Version is embedded at compile time via `-ldflags`. A single appcast XML is served at a known URL; each platform's updater library polls it. EdDSA signatures are required on all update artifacts.

## Further reading

- `docs/` — design and architecture documents
- GitHub Issues — bug reports and feature requests
