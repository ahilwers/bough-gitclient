# Bough – Implementation Plan: Overview

**Version:** 1.0
**Date:** March 2026
**Stack:** Wails 2 · Go 1.22+ · React 19 · TypeScript 5

---

## 1. What We Are Building

**Bough** is a cross-platform Git GUI client for macOS (primary), Windows, and Linux. It targets professional developers who want the clarity of Tower, the speed of Fork, and a first-class working-copy experience. The name references a bough — the main branch of a tree — mirroring git's branch concept.

### Core Differentiators
- **Chunk-level staging** with per-hunk and per-line stage/discard/unstage
- **Worktree management** — create, switch, and remove worktrees from the UI
- **Native performance** — Wails uses the OS WebView (no bundled Chromium)
- **No account required** — works with any Git host or none at all
- **Auto-updates** via Sparkle (macOS), WinSparkle (Windows), AppImageUpdate (Linux)

---

## 2. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Desktop framework | Wails 2 | Go backend, native WebView, typed IPC |
| Backend language | Go 1.22+ | go-git native library, Goroutines |
| Git reads | go-git v5 | Pure Go, fast, no external process |
| Git writes | CLI-git (exec.Command) | Auth, SSH agent, GPG, hooks |
| Filesystem watch | fsnotify | Cross-platform, live UI updates |
| Frontend framework | React 19 | Concurrent features, large ecosystem |
| Language | TypeScript 5 | Type safety, matches Go binding types |
| Styling | Tailwind CSS 4 | Utility-first, custom design tokens |
| Components | shadcn/ui + Radix UI | Accessible, customizable, no vendor lock-in |
| State | Zustand | Lightweight, devtools, no boilerplate |
| Async data | TanStack Query v5 | Caching, background refetch, suspense |
| Diff/code view | Monaco Editor | VSCode core, 80+ languages, virtual scroll |
| Icons | Lucide Icons (lucide-react) | Consistent, open source, SVG |
| Animations | Framer Motion | Declarative, GPU-accelerated |
| i18n | react-i18next | Namespaces, pluralization, widely used |
| Auto-update (mac) | Sparkle 2 + go-sparkle (CGo) | De-facto standard, EdDSA signed |
| Auto-update (win) | WinSparkle + go-winsparkle (CGo) | Same appcast format as Sparkle |
| Auto-update (linux) | AppImageUpdate | Delta updates, no root required |

---

## 3. Phase Roadmap

```
Phase 1 – Foundation          (Weeks 1–6)
  ├── Wails 2 project scaffold
  ├── Go backend: repository open, status, commits (go-git)
  ├── Wails IPC bindings auto-generated
  ├── React skeleton: theme system, layout shell
  └── Basic commit list (no graph yet)

Phase 2 – Core Git Features   (Weeks 7–14)
  ├── Commit graph with Canvas 2D rendering
  ├── Go swimlane layout algorithm
  ├── Changes view: file list, chunk diff
  ├── Hunk-level and line-level staging (go-git)
  ├── Commit creation and amend
  └── Push / Pull / Fetch via CLI-git

Phase 3 – Power Features      (Weeks 15–22)
  ├── Worktree management
  ├── Sidebar: Tags, Stashes, Remotes
  ├── Interactive rebase (drag & drop)
  ├── Blame viewer
  ├── Command Palette (⌘K)
  └── External merge tool integration

Phase 4 – Distribution        (Weeks 23–26)
  ├── Auto-update: Sparkle 2 (macOS), WinSparkle (Windows)
  ├── AppImage + AppImageUpdate (Linux)
  ├── Code signing + notarization (macOS)
  ├── Authenticode signing (Windows)
  └── GitHub Actions release pipeline
```

---

## 4. File Dependencies Between Plans

Read the plan files in this order — each builds on the previous:

```
00-overview.md          ← This file
01-setup.md             ← Project scaffold (do this first)
02-git-backend.md       ← Go backend (depends on 01)
03-commit-graph.md      ← Graph algorithm + Canvas (depends on 02)
04-frontend.md          ← React architecture (depends on 01)
05-history-view.md      ← History view UI (depends on 02, 03, 04)
06-changes-view.md      ← Changes/staging view (depends on 02, 04)
07-worktrees.md         ← Worktree feature (depends on 02, 04)
08-updates-distribution.md ← Packaging & updates (can be done in parallel with Phase 3)
09-licensing.md         ← One-time purchase + 30-day trial (can be done in parallel with Phase 3)
10-testing.md           ← Testing strategy: Go, Vitest, Playwright, CI (read before writing any feature)
```

---

## 5. Repository Structure (Final)

The monorepo is split into two top-level subdirectories: `app/` for the desktop application and `licenseserver/` for the Go license + payment backend. Both share the same Git repository and GitHub Actions pipeline but are deployed independently.

```
bough/                             # Git repository root
│
├── app/                           # Desktop application (Wails 2 + React)
│   ├── main.go                    # Wails entry point
│   ├── app.go                     # App struct, all Wails bindings exported
│   ├── go.mod
│   ├── go.sum
│   ├── wails.json                 # Wails project config
│   │
│   ├── git/                       # Go backend – all git logic
│   │   ├── repository.go          # Open repo, status, config
│   │   ├── commits.go             # git log, graph layout algorithm
│   │   ├── diff.go                # Diff computation (go-git)
│   │   ├── branches.go            # Branch CRUD
│   │   ├── staging.go             # Stage / unstage hunks and files
│   │   ├── stash.go               # git stash operations
│   │   ├── tags.go                # Tag management
│   │   ├── worktrees.go           # Worktree list / add / remove
│   │   ├── cli.go                 # exec.Command wrapper for CLI-git
│   │   ├── auth.go                # SSH agent / HTTPS credential helpers
│   │   └── watcher.go             # fsnotify: watch all worktree paths
│   │
│   ├── license/                   # License validation (client side)
│   │   ├── types.go               # LicenseStatus struct
│   │   ├── trial.go               # 30-day trial management
│   │   ├── license.go             # Ed25519 offline validation, revocation check
│   │   ├── store.go               # OS keychain read/write
│   │   └── public.key             # Embedded Ed25519 public key (never private!)
│   │
│   ├── update/                    # Auto-update (platform-specific via build tags)
│   │   ├── updater_darwin.go      # Sparkle 2 via CGo (go-sparkle)
│   │   ├── updater_windows.go     # WinSparkle via CGo
│   │   └── updater_linux.go       # AppImageUpdate subprocess call
│   │
│   └── frontend/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           │   ├── Titlebar/
│           │   ├── Toolbar/
│           │   ├── Sidebar/
│           │   │   ├── BranchList.tsx
│           │   │   ├── TagList.tsx
│           │   │   ├── StashList.tsx
│           │   │   └── WorktreeList.tsx
│           │   ├── CommitGraph/
│           │   │   ├── GraphCanvas.tsx   # Canvas 2D renderer
│           │   │   ├── CommitRow.tsx     # Single commit row (DOM)
│           │   │   └── CommitList.tsx    # Virtualised list
│           │   ├── DetailPanel/
│           │   │   ├── CommitDetail.tsx
│           │   │   ├── FileList.tsx
│           │   │   └── DiffViewer.tsx    # Monaco DiffEditor
│           │   ├── ChangesView/
│           │   │   ├── FileStatusList.tsx
│           │   │   ├── ChunkDiff.tsx
│           │   │   └── CommitBox.tsx
│           │   ├── WorktreeManager/
│           │   │   ├── WorktreeItem.tsx
│           │   │   └── NewWorktreeDialog.tsx
│           │   └── shared/
│           │       ├── CommandPalette.tsx
│           │       ├── FlashNotification.tsx
│           │       ├── ContextMenu.tsx
│           │       └── LicenseDialog.tsx
│           ├── stores/
│           │   └── gitStore.ts           # Zustand global store
│           ├── hooks/
│           │   ├── useGitData.ts         # TanStack Query hooks
│           │   ├── useWorktrees.ts
│           │   └── useKeyboard.ts        # Global keyboard shortcuts
│           ├── lib/
│           │   ├── colors.ts             # Branch color palette
│           │   ├── format.ts             # Date, hash, path formatters
│           │   └── graph.ts              # Graph data types (mirrors Go structs)
│           ├── locales/
│           │   ├── en/common.json
│           │   └── de/common.json
│           └── wailsjs/                  # Auto-generated by Wails
│               └── go/main/App.d.ts
│
├── licenseserver/                 # License + payment backend (Go HTTP service)
│   ├── main.go                    # HTTP server entry point
│   ├── go.mod
│   ├── go.sum
│   ├── Dockerfile                 # For Fly.io / Railway deployment
│   ├── fly.toml                   # Fly.io config
│   │
│   ├── handler/
│   │   ├── webhook.go             # POST /webhook — Stripe event handler
│   │   ├── revoked.go             # GET  /revoked — signed revocation list
│   │   └── health.go              # GET  /health  — uptime check
│   │
│   ├── keygen/
│   │   ├── keygen.go              # Ed25519 key generation + signing
│   │   └── revocation.go          # Revocation list management
│   │
│   ├── mailer/
│   │   └── mailer.go              # Send license key email (via Resend API)
│   │
│   └── store/
│       └── db.go                  # SQLite: issued keys, activations, revocations
│
├── docs/                          # Architecture + design documents
├── plans/                         # Implementation plans (this directory)
└── .github/
    └── workflows/
        ├── release.yml            # Build + sign app, publish GitHub Release
        └── licenseserver.yml      # Deploy licenseserver/ to Fly.io on push
```

---

## 6. Design Tokens Quick Reference

All CSS custom properties are defined in `frontend/src/index.css`. The theme switches via `data-theme="dark"` on `<html>`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg-content` | `#FFFFFF` | `#1C1C1E` | Main content area |
| `--bg-sidebar` | `#E8E8E8` | `#202022` | Sidebar |
| `--bg-panel` | `#FAFAFA` | `#252527` | Detail panel |
| `--acc` | `#0066CC` | `#0A84FF` | Accent / primary action |
| `--text-pri` | `#1D1D1F` | `#F5F5F7` | Primary text |
| `--text-sec` | `#6E6E73` | `#AEAEB2` | Secondary text |
| `--success` | `#00875A` | `#30D158` | Staged / added |
| `--danger` | `#D92D20` | `#FF453A` | Deleted / discard |
| `--warn` | `#C4680A` | `#FF9F0A` | Unstaged / warning |
| `--bg-add` | `#E8F8EE` | `#0D2818` | Diff added line bg |
| `--bg-del` | `#FDEDF0` | `#2D0E0E` | Diff removed line bg |

Branch line colors (used for graph swimlanes):

| Variable | Color | Usage |
|---|---|---|
| `--line-main` | `#0066CC` | main / master |
| `--line-feat` | `#00875A` | feature/* |
| `--line-hot` | `#D92D20` | hotfix/* |
| `--line-rel` | `#7C3AED` | release/* |
| `--line-4` | `#C4680A` | chore/*, other |
| `--line-5` | `#0891B2` | Additional |
| `--line-6` | `#BE185D` | Additional |
| `--line-7` | `#15803D` | Additional |

---

## 7. Key Conventions

### Go ↔ TypeScript Naming
- Go structs use `PascalCase` fields; Wails serialises to `camelCase` JSON automatically
- All Go functions exported via Wails start with a capital letter (e.g., `GetCommits`)
- TypeScript interfaces mirror Go structs exactly (use Wails-generated types)

### Error Handling
- Go functions return `(T, error)` — Wails wraps errors as rejected Promises
- Frontend catches errors with TanStack Query's `onError` callback and shows a `FlashNotification`

### i18n
- Every visible string must use the `t()` hook from `react-i18next`
- Key format: `namespace.section.key` e.g., `staging.hunk.stageChunk`
- Never hardcode UI strings in JSX

### Testing
- Tests are written **alongside** the code, not after. Each plan's checklist includes the required tests.
- Go backend: `go test -race ./...` — use `t.TempDir()` to create real git repos for integration tests
- Frontend units/components: Vitest + React Testing Library — all Wails IPC calls mocked via `src/test/wailsmocks/`
- E2E: Playwright against the Vite dev server with `VITE_MOCK_BACKEND=true`
- CI runs all three suites on every pull request; see `10-testing.md` and `.github/workflows/test.yml`
- The Canvas graph renderer is tested at the **data level** (swimlane algorithm in Go) — not pixel level

### Git Operations — When to Use go-git vs CLI
| Operation | Use |
|---|---|
| Read commits, branches, status, diff | go-git |
| Write staging area (index) | go-git |
| Push, pull, fetch, clone | CLI-git |
| Rebase, cherry-pick, merge | CLI-git |
| Worktree add / remove | CLI-git |
| GPG signing, hooks | CLI-git |
| Read `.gitconfig` | go-git |

---

## 8. Prerequisites

Before starting Phase 1, ensure the following are installed:

```bash
# Go 1.22+
go version  # should print go1.22.x or higher

# Node.js 20+ and npm
node --version   # 20.x+
npm --version

# Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails version   # should print v2.x.x

# Platform-specific:
# macOS: Xcode Command Line Tools
xcode-select --install

# Windows: WebView2 Runtime (usually already installed on Win 11)
# Linux: libgtk-3-dev, libwebkit2gtk-4.0-dev
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev  # Ubuntu/Debian
```

---

## 9. Architectural Decisions (Resolved)

All decisions have been confirmed. See `plans/09-licensing.md` for the full licensing implementation plan.

1. **Licensing model** ✅
   **One-time purchase with a 30-day free trial.** No subscription. A `license/` module handles trial expiry and license key validation. See `09-licensing.md`.

2. **SSH key management** ✅
   **System SSH agent only.** Bough does not generate or store SSH keys. Auth is delegated entirely to the OS SSH agent (`ssh-agent` / macOS Keychain SSH / Windows Pageant). Users manage keys via `~/.ssh/` and their system agent as usual.

3. **HTTPS credential storage** ✅
   **Delegate to `git credential` with OS-native auto-configuration.** On first launch, Bough checks `git config --global credential.helper`. If unset, it automatically configures the OS-native helper:
   - macOS → `osxkeychain` (ships with Xcode Command Line Tools)
   - Windows → Git Credential Manager / GCM (ships with Git for Windows)
   - Linux → `git-credential-libsecret` if available (GNOME/KDE), else `git-credential-store`

   If an operation (push/pull/fetch) fails with an authentication error, Bough shows a credential dialog, then writes the result back via `git credential approve`. No credential database inside Bough.

4. **GitHub/GitLab integration (v2)** — deferred to Version 2.
   Will use personal access tokens (simpler than OAuth). OAuth with redirect server is out of scope for v1.

5. **Window count** ✅
   **One window per repository (like Tower).** Each repository opens in its own OS window. A "Welcome" window lists recent repositories. The multi-window approach requires per-window Zustand store instances (see `04-frontend.md`).

6. **Minimum OS versions** ✅
   macOS 12 Monterey, Windows 10 21H2, Linux: any modern distribution (AppImage format — no distro lock-in).
