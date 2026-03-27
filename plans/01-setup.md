# Bough – Plan 01: Project Setup & Scaffold

**Phase:** 1 (Weeks 1–2)
**Prerequisite:** `00-overview.md` read and understood
**Goal:** A running Wails 2 application with the correct directory structure, all dependencies installed, and the full design token system in place.

---

## 1. Create the Wails Project

```bash
# In your development directory (e.g. ~/code/)
wails init -n bough -t react-ts

cd bough
```

Wails creates this initial structure:
```
bough/
├── main.go
├── app.go
├── wails.json
├── go.mod
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── App.css
```

---

## 2. Configure `wails.json`

Replace the generated `wails.json` with:

```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "Bough",
  "outputfilename": "Bough",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "info": {
    "companyName": "Your Company",
    "productName": "Bough",
    "productVersion": "0.1.0",
    "copyright": "Copyright 2026",
    "comments": "A beautiful Git GUI client"
  },
  "nsisType": "multiple",
  "obfuscated": false,
  "garbleargs": ""
}
```

---

## 3. Install Go Dependencies

```bash
# Core git library
go get github.com/go-git/go-git/v5

# Filesystem watcher
go get github.com/fsnotify/fsnotify

# Run go mod tidy to clean up
go mod tidy
```

Verify `go.mod` now contains:
```
require (
    github.com/go-git/go-git/v5 v5.x.x
    github.com/fsnotify/fsnotify v1.x.x
    github.com/wailsapp/wails/v2 v2.x.x
)
```

---

## 4. Create the Go Directory Structure

```bash
mkdir -p git update
```

Create placeholder files so the build succeeds from day one:

**`git/repository.go`** (stub):
```go
package git

import (
    gogit "github.com/go-git/go-git/v5"
)

// Repository wraps a go-git repository with Bough-specific helpers.
type Repository struct {
    repo *gogit.Repository
    Path string
}

// Open opens a Git repository at the given path.
func Open(path string) (*Repository, error) {
    repo, err := gogit.PlainOpenWithOptions(path, &gogit.PlainOpenOptions{
        DetectDotGit:          true,
        EnableDotGitCommonDir: true,
    })
    if err != nil {
        return nil, err
    }
    return &Repository{repo: repo, Path: path}, nil
}
```

**`git/cli.go`** (stub):
```go
package git

import (
    "bytes"
    "fmt"
    "os/exec"
)

// CLI runs a git command in the given working directory and returns stdout.
func CLI(dir string, args ...string) (string, error) {
    cmd := exec.Command("git", args...)
    cmd.Dir = dir
    var stdout, stderr bytes.Buffer
    cmd.Stdout = &stdout
    cmd.Stderr = &stderr
    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("git %v: %w\n%s", args, err, stderr.String())
    }
    return stdout.String(), nil
}
```

---

## 5. Update `app.go`

Replace the generated `app.go` with a clean structure:

```go
package main

import (
    "context"

    gitpkg "bough/git"
)

// App holds application state and exposes methods to the frontend via Wails IPC.
type App struct {
    ctx context.Context
}

func NewApp() *App {
    return &App{}
}

// startup is called when the app starts. Save the context for later use.
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
}

// --- Repository ---

// OpenRepository opens a git repository and returns its path.
// Returns an error string if the path is not a valid git repo.
func (a *App) OpenRepository(path string) (string, error) {
    repo, err := gitpkg.Open(path)
    if err != nil {
        return "", err
    }
    return repo.Path, nil
}
```

---

## 6. Update `main.go`

```go
package main

import (
    "embed"

    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
    "github.com/wailsapp/wails/v2/pkg/options/mac"
    "github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

// version is set at build time via -ldflags
var version = "dev"

func main() {
    app := NewApp()

    err := wails.Run(&options.App{
        Title:            "Bough",
        Width:            1280,
        Height:           800,
        MinWidth:         900,
        MinHeight:        600,
        Frameless:        true, // custom titlebar
        BackgroundColour: &options.RGBA{R: 28, G: 28, B: 30, A: 255}, // matches --bg-window dark
        AssetServer: &assetserver.Options{
            Assets: assets,
        },
        OnStartup: app.startup,
        Bind:      []interface{}{app},
        Mac: &mac.Options{
            TitleBar:             mac.TitleBarHiddenInset(),
            Appearance:           mac.DefaultAppearance,
            WebviewIsTransparent: false,
            WindowIsTranslucent:  false,
        },
        Windows: &windows.Options{
            WebviewIsTransparent: false,
            WindowIsTranslucent:  false,
        },
    })
    if err != nil {
        println("Error:", err.Error())
    }
}
```

---

## 7. Install Frontend Dependencies

```bash
cd frontend

# Core framework + Vite already installed by Wails

# Tailwind CSS 4
npm install -D tailwindcss@latest @tailwindcss/vite

# shadcn/ui dependencies
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-scroll-area @radix-ui/react-tooltip
npm install @radix-ui/react-context-menu @radix-ui/react-popover

# State management
npm install zustand

# Async data
npm install @tanstack/react-query

# Icons
npm install lucide-react

# i18n
npm install react-i18next i18next

# Animations
npm install framer-motion

# Monaco Editor
npm install @monaco-editor/react monaco-editor

cd ..
```

---

## 8. Configure Vite (`frontend/vite.config.ts`)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## 9. Configure Tailwind (`frontend/tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        ui:   ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        acc: 'var(--acc)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warn: 'var(--warn)',
      },
    },
  },
} satisfies Config
```

---

## 10. Global CSS Tokens (`frontend/src/index.css`)

```css
@import "tailwindcss";

@layer base {
  :root {
    /* Backgrounds */
    --bg-window:      #ECECEC;
    --bg-titlebar:    #E2E2E2;
    --bg-toolbar:     #F0F0F0;
    --bg-sidebar:     #E8E8E8;
    --bg-content:     #FFFFFF;
    --bg-panel:       #FAFAFA;
    --bg-panel2:      #F4F4F4;
    --bg-hover:       rgba(0,0,0,0.05);
    --bg-sel:         rgba(0,102,204,0.09);
    --bg-sel-row:     rgba(0,102,204,0.07);
    --bg-input:       #FFFFFF;
    --bg-badge:       #E0E0E0;

    /* Diff */
    --bg-add:         #E8F8EE;
    --bg-del:         #FDEDF0;
    --bg-add-str:     #C4EFCE;
    --bg-del-str:     #F9C0CA;
    --bg-hunk:        rgba(0,102,204,0.06);

    /* Staging */
    --bg-staged-sec:  #F0F7FF;
    --bg-unstaged-sec:#FFF9F0;

    /* Text */
    --text-pri:       #1D1D1F;
    --text-sec:       #6E6E73;
    --text-ter:       #AEAEB2;
    --text-acc:       #0066CC;
    --text-add:       #1A7F37;
    --text-del:       #CF222E;

    /* Borders */
    --border-sub:     rgba(0,0,0,0.07);
    --border:         rgba(0,0,0,0.13);
    --border-str:     rgba(0,0,0,0.20);

    /* Semantic */
    --acc:            #0066CC;
    --acc-hov:        #0055B0;
    --acc-soft:       rgba(0,102,204,0.10);
    --acc-border:     rgba(0,102,204,0.25);
    --danger:         #D92D20;
    --danger-soft:    rgba(217,45,32,0.10);
    --danger-border:  rgba(217,45,32,0.25);
    --warn:           #C4680A;
    --success:        #00875A;
    --success-soft:   rgba(0,135,90,0.10);
    --success-border: rgba(0,135,90,0.25);

    /* Shadows */
    --shadow:         0 2px 10px rgba(0,0,0,0.12);
    --shadow-lg:      0 8px 30px rgba(0,0,0,0.18);

    /* Branch line colors */
    --line-0: #0066CC;
    --line-1: #00875A;
    --line-2: #D92D20;
    --line-3: #7C3AED;
    --line-4: #C4680A;
    --line-5: #0891B2;
    --line-6: #BE185D;
    --line-7: #15803D;

    /* Radius */
    --r-sm: 4px;
    --r-md: 6px;
    --r-lg: 10px;
  }

  [data-theme="dark"] {
    --bg-window:      #1C1C1E;
    --bg-titlebar:    #2C2C2E;
    --bg-toolbar:     #252527;
    --bg-sidebar:     #202022;
    --bg-content:     #1C1C1E;
    --bg-panel:       #252527;
    --bg-panel2:      #2A2A2C;
    --bg-hover:       rgba(255,255,255,0.05);
    --bg-sel:         rgba(10,132,255,0.16);
    --bg-sel-row:     rgba(10,132,255,0.09);
    --bg-input:       #2C2C2E;
    --bg-badge:       #3A3A3C;

    --bg-add:         #0D2818;
    --bg-del:         #2D0E0E;
    --bg-add-str:     #1A4D2E;
    --bg-del-str:     #5C1A1A;
    --bg-hunk:        rgba(10,132,255,0.08);

    --bg-staged-sec:  #0A1929;
    --bg-unstaged-sec:#1A1000;

    --text-pri:       #F5F5F7;
    --text-sec:       #AEAEB2;
    --text-ter:       #6E6E73;
    --text-acc:       #0A84FF;
    --text-add:       #30D158;
    --text-del:       #FF453A;

    --border-sub:     rgba(255,255,255,0.07);
    --border:         rgba(255,255,255,0.13);
    --border-str:     rgba(255,255,255,0.20);

    --acc:            #0A84FF;
    --acc-hov:        #409CFF;
    --acc-soft:       rgba(10,132,255,0.15);
    --acc-border:     rgba(10,132,255,0.30);
    --danger:         #FF453A;
    --danger-soft:    rgba(255,69,58,0.15);
    --danger-border:  rgba(255,69,58,0.30);
    --warn:           #FF9F0A;
    --success:        #30D158;
    --success-soft:   rgba(48,209,88,0.15);
    --success-border: rgba(48,209,88,0.30);

    --shadow:         0 2px 10px rgba(0,0,0,0.40);
    --shadow-lg:      0 8px 30px rgba(0,0,0,0.60);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    color: var(--text-pri);
    background: var(--bg-window);
    -webkit-font-smoothing: antialiased;
    user-select: none;
    overflow: hidden;
  }

  /* Custom scrollbars */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--border-str); }

  /* Allow text selection in diff/code areas */
  .selectable { user-select: text; }
}
```

---

## 11. i18n Setup

**`frontend/src/i18n.ts`**:
```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from './locales/en/common.json'
import deCommon from './locales/de/common.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    de: { common: deCommon },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
```

**`frontend/src/locales/en/common.json`** (starter):
```json
{
  "app": {
    "name": "Bough"
  },
  "toolbar": {
    "fetch": "Fetch",
    "pull": "Pull",
    "push": "Push",
    "branch": "Branch",
    "stash": "Stash",
    "tag": "Tag"
  },
  "views": {
    "history": "History",
    "changes": "Changes"
  },
  "sidebar": {
    "branches": "Branches",
    "remotes": "Remote",
    "tags": "Tags",
    "stashes": "Stashes",
    "worktrees": "Worktrees",
    "newWorktree": "New Worktree"
  },
  "staging": {
    "unstaged": "Unstaged",
    "staged": "Staged",
    "stageAll": "Stage All",
    "unstageAll": "Unstage All",
    "stageChunk": "Stage chunk",
    "discardChunk": "Discard",
    "unstageChunk": "Unstage",
    "commitMessage": "Commit message (⌘ + Enter to commit)…",
    "amend": "Amend",
    "commit": "Commit"
  },
  "commits": {
    "selectPrompt": "Select a commit",
    "files": "Files",
    "diff": "Diff",
    "author": "Author",
    "date": "Date",
    "parents": "Parents"
  },
  "worktrees": {
    "switchTo": "Switch to this worktree",
    "openInFinder": "Open in Finder",
    "openInExplorer": "Open in Explorer",
    "openInNewWindow": "Open in new window",
    "remove": "Remove worktree",
    "newBranch": "Branch",
    "newPath": "Path",
    "create": "Create Worktree",
    "cancel": "Cancel"
  },
  "errors": {
    "notARepo": "Not a git repository",
    "generic": "An error occurred"
  }
}
```

**`frontend/src/locales/de/common.json`** (starter):
```json
{
  "app": { "name": "Bough" },
  "toolbar": {
    "fetch": "Aktualisieren",
    "pull": "Pull",
    "push": "Push",
    "branch": "Branch",
    "stash": "Stash",
    "tag": "Tag"
  },
  "views": { "history": "Historie", "changes": "Änderungen" },
  "sidebar": {
    "branches": "Branches",
    "remotes": "Remote",
    "tags": "Tags",
    "stashes": "Stashes",
    "worktrees": "Worktrees",
    "newWorktree": "Neuer Worktree"
  },
  "staging": {
    "unstaged": "Nicht gestaged",
    "staged": "Gestaged",
    "stageAll": "Alle stagen",
    "unstageAll": "Alle entstagen",
    "stageChunk": "Chunk stagen",
    "discardChunk": "Verwerfen",
    "unstageChunk": "Entstagen",
    "commitMessage": "Commit-Nachricht (⌘ + Enter zum Committen)…",
    "amend": "Amend",
    "commit": "Commit"
  },
  "commits": {
    "selectPrompt": "Commit auswählen",
    "files": "Dateien",
    "diff": "Diff",
    "author": "Autor",
    "date": "Datum",
    "parents": "Eltern"
  },
  "worktrees": {
    "switchTo": "Zu diesem Worktree wechseln",
    "openInFinder": "In Finder öffnen",
    "openInExplorer": "In Explorer öffnen",
    "openInNewWindow": "In neuem Fenster öffnen",
    "remove": "Worktree entfernen",
    "newBranch": "Branch",
    "newPath": "Pfad",
    "create": "Worktree erstellen",
    "cancel": "Abbrechen"
  },
  "errors": {
    "notARepo": "Kein Git-Repository",
    "generic": "Ein Fehler ist aufgetreten"
  }
}
```

---

## 12. Entry Point (`frontend/src/main.tsx`)

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

---

## 13. App Shell (`frontend/src/App.tsx`)

```tsx
import { useEffect } from 'react'
import { useGitStore } from '@/stores/gitStore'
import Titlebar from '@/components/Titlebar/Titlebar'
import Toolbar from '@/components/Toolbar/Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import HistoryView from '@/components/HistoryView/HistoryView'
import ChangesView from '@/components/ChangesView/ChangesView'
import FlashNotification from '@/components/shared/FlashNotification'

export default function App() {
  const { activeView, theme } = useGitStore()

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden"
         style={{ background: 'var(--bg-window)' }}>
      <Titlebar />
      <Toolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar only shown in History view */}
        {activeView === 'history' && <Sidebar />}

        {activeView === 'history' ? <HistoryView /> : <ChangesView />}
      </div>

      <FlashNotification />
    </div>
  )
}
```

---

## 14. Zustand Store Skeleton (`frontend/src/stores/gitStore.ts`)

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type View = 'history' | 'changes'
export type Theme = 'light' | 'dark'

interface GitStore {
  // App state
  theme: Theme
  activeView: View
  flash: { message: string; type: 'success' | 'danger' | 'info' } | null

  // Repository state
  activeRepo: string | null
  recentRepos: string[]

  // Actions
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setView: (v: View) => void
  setActiveRepo: (path: string) => void
  showFlash: (message: string, type?: 'success' | 'danger' | 'info') => void
  clearFlash: () => void
}

export const useGitStore = create<GitStore>()(
  devtools(
    (set, get) => ({
      theme: (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      activeView: 'history',
      flash: null,
      activeRepo: null,
      recentRepos: [],

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setView: (activeView) => set({ activeView }),
      setActiveRepo: (path) => set((s) => ({
        activeRepo: path,
        recentRepos: [path, ...s.recentRepos.filter(r => r !== path)].slice(0, 10),
      })),
      showFlash: (message, type = 'success') => {
        set({ flash: { message, type } })
        setTimeout(() => get().clearFlash(), 2100)
      },
      clearFlash: () => set({ flash: null }),
    }),
    { name: 'BoughStore' }
  )
)
```

---

## 15. Verify the Build

```bash
# From the project root:
wails dev

# You should see:
# - The Wails dev server starting
# - A native window opening with the React app
# - No console errors

# For production build:
wails build
# Output: build/bin/Bough.app (macOS), build/bin/Bough.exe (Windows)
```

---

## 16. Font Loading

Add Google Fonts to `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <title>Bough</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

> **Note for production:** Bundle the fonts locally (download the woff2 files and serve them from `frontend/public/fonts/`) to avoid network dependency and eliminate font flash. Add a `@font-face` block in `index.css` pointing to the local files.

---

## 17. Checklist

After completing this phase, verify:

- [ ] `wails dev` starts without errors
- [ ] Native window opens on the correct OS
- [ ] Dark mode activates when system is in dark mode
- [ ] Custom titlebar replaces the native one (macOS: traffic lights still visible)
- [ ] `wails build` produces a runnable binary
- [ ] All npm packages installed without errors
- [ ] `go mod tidy` runs clean
- [ ] Fonts load correctly (Inter, JetBrains Mono)

**Next step:** `02-git-backend.md`
