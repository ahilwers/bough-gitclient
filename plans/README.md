# Bough Git GUI Client - Implementation Plans

Complete, actionable implementation documentation for the Bough Git GUI client project.

## Document Structure

All 6 files are organized by feature area, with real code snippets, exact file paths, commands to run, and verification checklists.

### 03-commit-graph.md (562 lines, 14 code blocks)
**Canvas 2D commit graph renderer**
- GraphCanvas component with scroll sync
- CommitRow DOM layer with branch chips  
- CommitList virtualized rendering (±buffer optimization)
- TanStack Query integration with EventsOn listeners
- Go types: CommitNode, GraphLine
- Color palette and keyboard navigation (j/k)
- Verification: 11-point checklist

### 04-frontend.md (909 lines, 24 code blocks)
**React component architecture, shared components**
- App shell with Titlebar (frameless, macOS traffic lights)
- Toolbar with repo selector, view tabs, action buttons, badges
- Sidebar with collapsible sections (Branches, Remotes, Tags, Stashes, Worktrees)
- FlashNotification with Framer Motion animations
- CommandPalette (⌘K, fuzzy search, keyboard nav)
- Zustand store with theme, view state, selections, notifications
- Custom hooks: useKeyboard, useCommits, useStatus, useBranches, useWorktrees
- CSS custom properties for light/dark theming
- Verification: 12-point checklist

### 05-history-view.md (670 lines, 16 code blocks)
**History view — commit list + detail panel**
- HistoryView container with search bar and "All Branches" toggle
- CommitDetailPanel with tabs (Files / Diff)
- FileList with file rows, status icons, +/- stats
- DiffViewer using Monaco DiffEditor (syntax highlighting, language detection)
- Branch chip rendering inline before commit message
- Go backend: GetCommitDetail, GetCommitFiles, GetFileAtCommit, GetFileAtCommitParent
- TypeScript types: DiffFile, DiffHunk, DiffLine
- Client-side search filtering (hash/message/author)
- Verification: 14-point checklist

### 06-changes-view.md (1033 lines, 18 code blocks)
**Changes view — staging area and chunk diff**
- ChangesView layout (FileStatusList 240px + ChunkDiffPanel flex:1)
- FileStatusList with Unstaged/Staged sections
- File row with status badges (M/A/D/R), path, +/- stats, hover actions
- ChunkDiffPanel with HunkBlock rendering
- HunkBlock with hunk header, diff lines, action buttons
- Line-level staging: Stage/Discard buttons on hover
- CommitBox with textarea, Amend checkbox, Commit button, ⌘+Enter shortcut
- DiffLine display with proper coloring (add/del/ctx)
- diffUtils: buildHunkPatch (constructs unified diff for git apply)
- Go backend: GetStatus, StageFile, UnstageFile, StageHunk, UnstageHunk, DiscardHunk, Commit, AmendCommit
- Verification: 15-point checklist

### 07-worktrees.md (949 lines, 22 code blocks)
**Complete worktree management feature**
- WorktreeList component in sidebar
- WorktreeItem with Layers icon, path (truncated), dirty dot (orange), branch chip
- NewWorktreeDialog with branch selector (searchable), path input (auto-filled), validation
- ContextMenu component (Radix UI) for worktree actions
- Go backend: git/worktrees.go with ListWorktrees, AddWorktree, RemoveWorktree, PruneWorktrees
- App.go bindings: ListWorktrees, AddWorktree, RemoveWorktree, SwitchWorktree
- useWorktrees hook with useMutation for add/remove
- File watcher (fsnotify) for multiple worktree paths simultaneously
- Context menu: Switch, Open in Finder/Explorer, Remove
- Verification: 16-point checklist

### 08-updates-distribution.md (912 lines, 34 code blocks)
**Auto-update + code signing + CI/CD pipeline**
- Version embedding via build flags (-ldflags)
- macOS: Sparkle 2 integration with Info.plist configuration
- macOS: EdDSA key generation and signing (openssl)
- macOS: Code signing and notarization (xcrun commands)
- Windows: WinSparkle DLL integration and MSI packaging (WiX)
- Windows: Authenticode signing (signtool)
- Linux: AppImage build with appimagetool
- Linux: AppImageUpdate for auto-updates
- Appcast XML format with EdDSA signature field
- GitHub Actions release workflow (complete YAML): matrix build for all 3 platforms
- Appcast generation script (bash): reads release artifacts, computes signatures, writes XML
- Update check in app (useAppUpdates hook)
- Verification: 17-point checklist

## Key Technologies

- **Frontend**: React 19, TypeScript 5, Tailwind CSS 4, Zustand, TanStack Query v5
- **UI Components**: Lucide React, Framer Motion, Radix UI (Dialog, ContextMenu)
- **Editors**: Monaco Editor (DiffEditor), react-i18next
- **Backend**: Go 1.22, go-git v5
- **Desktop**: Wails 2 (Electron-like, native Go backend)
- **Distribution**: Sparkle 2, WinSparkle, AppImage, GitHub Actions
- **Security**: EdDSA signatures, Code signing, App notarization

## Design Tokens (CSS Variables)

```css
--bg-content, --bg-sidebar, --bg-panel
--acc: #0066CC (light) / #0A84FF (dark)
--text-pri, --text-sec, --text-ter
--success: #00875A, --danger: #D92D20, --warn: #C4680A
--bg-add, --bg-del, --bg-hunk
--line-0 through --line-7 (branch colors)
```

## Layout Constants

- Titlebar: 40px (custom, frameless)
- Toolbar: 44px
- Sidebar: 200px (History view only)
- Detail panel: 370px (History view)
- File list: 240px (Changes view)
- CommitRow height: 34px
- Sidebar item: 24px

## Go Data Types (git/types.go)

- **CommitNode**: hash, shortHash, message, author, email, date, parents[], refs[], column, color, lines[]
- **GraphLine**: fromCol, toCol, color, isMerge
- **DiffFile**: path, oldPath, hunks[], binary
- **DiffHunk**: header, oldStart, oldLines, newStart, newLines, lines[]
- **DiffLine**: type("add"|"del"|"ctx"), content, oldNo, newNo
- **FileStatus**: path, oldPath, staged, unstaged, added, deleted
- **WorktreeInfo**: path, branch, head, isMain, isDirty, isLinked
- **RepoStatus**: branch, ahead, behind, files[], hasConflicts

## Wails IPC Pattern

```typescript
// Frontend → Go
import { GetCommits } from '../wailsjs/go/main/App'
const commits = await GetCommits(500) // Returns typed Promise<CommitNode[]>

// Go → Frontend (events)
import { EventsOn } from '../wailsjs/runtime'
EventsOn('repo:changed', () => { /* query invalidation */ })
```

## File Structure

```
bough/
├── frontend/src/
│   ├── components/
│   │   ├── Titlebar.tsx
│   │   ├── Toolbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── GraphCanvas.tsx
│   │   ├── CommitRow.tsx
│   │   ├── CommitList.tsx
│   │   ├── CommitDetailPanel.tsx
│   │   ├── FileList.tsx
│   │   ├── DiffViewer.tsx
│   │   ├── FileStatusList.tsx
│   │   ├── ChunkDiffPanel.tsx
│   │   ├── HunkBlock.tsx
│   │   ├── CommitBox.tsx
│   │   ├── WorktreeList.tsx
│   │   ├── NewWorktreeDialog.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── CommandPalette.tsx
│   │   └── FlashNotification.tsx
│   ├── views/
│   │   ├── HistoryView.tsx
│   │   └── ChangesView.tsx
│   ├── hooks/
│   │   ├── useCommits.ts
│   │   ├── useStatus.ts
│   │   ├── useBranches.ts
│   │   ├── useWorktrees.ts
│   │   ├── useKeyboard.ts
│   │   └── useAppUpdates.ts
│   ├── store/
│   │   └── appStore.ts
│   ├── utils/
│   │   └── diffUtils.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── globals.css
├── git/
│   ├── types.go
│   ├── app.go
│   ├── repository.go
│   ├── commits.go
│   ├── diff.go
│   ├── status.go
│   ├── branches.go
│   ├── worktrees.go
│   ├── staging.go
│   ├── watcher.go
│   └── updates.go
├── update/
│   ├── updater_darwin.go
│   ├── updater_windows.go
│   └── updater_linux.go
├── scripts/
│   ├── build_appimage.sh
│   ├── generate_keys.sh
│   ├── sign_update.sh
│   └── generate_appcast.sh
├── .github/workflows/
│   └── release.yml
├── wix/
│   └── installer.wxs
└── Makefile
```

## Implementation Sequence

1. **Setup** (01-setup.md): Project structure, dependencies, build system
2. **Go Backend** (02-git-backend.md): Type system, go-git integration, API methods
3. **Commit Graph** (03-commit-graph.md): Canvas rendering, keyboard nav, sync with DOM
4. **Frontend Architecture** (04-frontend.md): Shared components, routing, state management
5. **History View** (05-history-view.md): Commit list, detail panel, diff viewer
6. **Changes View** (06-changes-view.md): Staging, chunk diff, commit box
7. **Worktrees** (07-worktrees.md): Multi-directory support, context switching
8. **Updates** (08-updates-distribution.md): Distribution, signing, CI/CD

## Verification Strategy

Each file includes a specific checklist of items to verify before considering the feature complete. Run tests on:
- Real Git repositories (100+, 1000+, 10000+ commits)
- Large files (megabytes of diff)
- Binary files
- Merge commits
- Worktree switching
- Cross-platform (macOS x86_64/ARM, Windows, Linux)

## Next Steps

1. Read each file in sequence (03 → 08)
2. Follow code snippets exactly (copy-paste ready)
3. Use provided file paths (absolute, no guessing)
4. Run provided commands verbatim
5. Check verification checklist before moving to next feature
6. Test on real repository after each major feature
7. Platform-test releases before public distribution

---

**Created**: 2026-03-27
**Tech Stack**: Wails 2, Go 1.22, React 19, TypeScript 5, Tailwind CSS 4
**Total Lines**: 5,035 across 6 files
**Total Code Blocks**: 128 (complete, production-ready snippets)
