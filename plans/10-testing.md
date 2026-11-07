# Bough – Plan 10: Testing Strategy

**Phase:** Ongoing — tests are written alongside the feature they cover, not after.
**Prerequisite:** `01-setup.md` complete
**Goal:** Reliable, fast, maintainable test suite covering the Go backend and frontend components. UI tests run without a real Wails build.

---

## 1. Overview

| Layer | Tool | What it tests |
|---|---|---|
| Go backend (`app/git/`, `app/update/`) | `go test` | Git operations, diff parsing, staging, auth, updates |
| Frontend units (`app/frontend/src/lib/`, hooks) | Vitest | Pure functions, Zustand store, TanStack Query hooks |
| Frontend components | Vitest + React Testing Library | UI components with mocked Wails bindings |
| End-to-end flows | Playwright | Full user flows against Vite dev server with mocked backend |
| CI | GitHub Actions | All of the above on every pull request and push to `main` |

---

## 2. Wails and UI Testing — How It Works

Wails does not provide a built-in test runner for the full app window. The WebView is a native OS control (WKWebView / WebView2 / WebKitGTK) and cannot be directly driven by Playwright or Cypress in the normal way.

**The solution:** test the frontend completely independently of Wails.

Wails generates TypeScript bindings from Go methods into `app/frontend/src/wailsjs/go/`. In tests, these are replaced with Vitest mocks or a dedicated `__mocks__` folder. The frontend runs in a normal Vite dev server (`npm run dev`) for Playwright tests, and in jsdom for Vitest unit/component tests. The Wails runtime (`window.runtime`, `window.go`) is never present — we mock it.

This approach tests 95% of what matters. The 5% not covered (native window chrome, OS-level dialogs like the file picker) can be verified manually during release testing.

---

## 3. Go Backend Tests (`app/git/`)

### Setup

Each test that needs a real git repository uses a helper that creates a temporary repo:

```go
// app/git/testutil_test.go
package git_test

import (
    "os"
    "os/exec"
    "path/filepath"
    "testing"
)

// initRepo creates a temporary git repository with an initial commit.
// The repo is automatically cleaned up when the test ends.
func initRepo(t *testing.T) string {
    t.Helper()
    dir := t.TempDir()

    run := func(args ...string) {
        t.Helper()
        cmd := exec.Command("git", args...)
        cmd.Dir = dir
        if out, err := cmd.CombinedOutput(); err != nil {
            t.Fatalf("git %v: %v\n%s", args, err, out)
        }
    }

    run("init")
    run("config", "user.email", "test@example.com")
    run("config", "user.name", "Test")
    run("commit", "--allow-empty", "-m", "Initial commit")
    return dir
}

// addCommit creates a file and commits it in the given repo.
func addCommit(t *testing.T, dir, filename, content, message string) {
    t.Helper()
    path := filepath.Join(dir, filename)
    if err := os.WriteFile(path, []byte(content), 0644); err != nil {
        t.Fatal(err)
    }
    exec := func(args ...string) {
        cmd := exec.Command("git", args...)
        cmd.Dir = dir
        cmd.Run()
    }
    exec("add", filename)
    exec("commit", "-m", message)
}
```

### Repository tests (`app/git/repository_test.go`)

```go
package git_test

import "testing"

func TestOpen(t *testing.T) {
    dir := initRepo(t)
    repo, err := Open(dir)
    if err != nil {
        t.Fatalf("Open: %v", err)
    }
    if repo.Path != dir {
        t.Errorf("Path = %q, want %q", repo.Path, dir)
    }
}

func TestOpen_NotARepo(t *testing.T) {
    _, err := Open(t.TempDir())
    if err != ErrNotARepo {
        t.Errorf("expected ErrNotARepo, got %v", err)
    }
}
```

### Commit tests (`app/git/commits_test.go`)

```go
func TestGetCommits(t *testing.T) {
    dir := initRepo(t)
    addCommit(t, dir, "a.txt", "hello", "second commit")
    addCommit(t, dir, "b.txt", "world", "third commit")

    repo, _ := Open(dir)
    commits, err := repo.GetCommits(100)
    if err != nil {
        t.Fatalf("GetCommits: %v", err)
    }
    if len(commits) != 3 { // initial + 2
        t.Errorf("len(commits) = %d, want 3", len(commits))
    }

    // Verify newest commit is first
    if commits[0].Message != "third commit" {
        t.Errorf("first commit = %q, want %q", commits[0].Message, "third commit")
    }
}

func TestGetCommits_GraphLayout(t *testing.T) {
    dir := initRepo(t)
    addCommit(t, dir, "a.txt", "v1", "feature work")

    repo, _ := Open(dir)
    commits, _ := repo.GetCommits(100)

    for i, c := range commits {
        if c.Hash == "" {
            t.Errorf("commits[%d].Hash is empty", i)
        }
        if c.Column < 0 {
            t.Errorf("commits[%d].Column < 0", i)
        }
        if c.Color < 0 || c.Color > 7 {
            t.Errorf("commits[%d].Color = %d, want 0–7", i, c.Color)
        }
    }
}
```

### Diff tests (`app/git/diff_test.go`)

```go
func TestGetFileDiff(t *testing.T) {
    dir := initRepo(t)
    addCommit(t, dir, "hello.txt", "line one\nline two\n", "add hello")

    repo, _ := Open(dir)
    commits, _ := repo.GetCommits(10)

    diffs, err := repo.GetCommitDiff(commits[0].Hash)
    if err != nil {
        t.Fatalf("GetCommitDiff: %v", err)
    }
    if len(diffs) == 0 {
        t.Fatal("expected at least one diff file")
    }
    if diffs[0].Path != "hello.txt" {
        t.Errorf("Path = %q, want hello.txt", diffs[0].Path)
    }
}
```

### Staging tests (`app/git/staging_test.go`)

```go
func TestStageAndCommit(t *testing.T) {
    dir := initRepo(t)
    repo, _ := Open(dir)

    // Create an untracked file
    os.WriteFile(filepath.Join(dir, "new.txt"), []byte("content"), 0644)

    status, _ := repo.Status()
    if len(status.Unstaged) == 0 {
        t.Fatal("expected unstaged files")
    }

    if err := repo.StageFile("new.txt"); err != nil {
        t.Fatalf("StageFile: %v", err)
    }

    status, _ = repo.Status()
    if len(status.Staged) == 0 {
        t.Fatal("expected staged files after staging")
    }

    hash, err := repo.CreateCommit("test commit")
    if err != nil {
        t.Fatalf("CreateCommit: %v", err)
    }
    if len(hash) != 40 {
        t.Errorf("hash length = %d, want 40", len(hash))
    }
}
```

### Running Go tests

```bash
# All backend tests
cd app && go test ./...

# With coverage report
cd app && go test -cover ./...

# Verbose output for a single package
cd app && go test -v ./git/

# Race detector (important for watcher/goroutine code)
cd app && go test -race ./...
```

---

## 4. Frontend Unit Tests (Vitest)

### Setup (`app/frontend/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      // Redirect all wailsjs imports to our mocks
      '@/wailsjs': path.resolve(__dirname, 'src/test/wailsmocks'),
    },
  },
})
```

### Wails mock setup (`app/frontend/src/test/setup.ts`)

```typescript
// Mock the Wails runtime object that the real app gets from the WebView
Object.defineProperty(window, 'runtime', {
  value: {
    EventsOn: vi.fn(),
    EventsOff: vi.fn(),
    EventsEmit: vi.fn(),
    BrowserOpenURL: vi.fn(),
    LogDebug: vi.fn(),
    LogError: vi.fn(),
  },
  writable: true,
})
```

### Wails IPC mocks (`app/frontend/src/test/wailsmocks/go/main/App.ts`)

This file mirrors the auto-generated `wailsjs/go/main/App.ts` but returns controllable test data:

```typescript
import { vi } from 'vitest'
import type { CommitNode, RepoStatus } from '@/lib/types'

// Default mock implementations — override per-test with vi.mocked(...).mockResolvedValue(...)
export const OpenRepository = vi.fn<[string], Promise<string>>()
  .mockResolvedValue('/tmp/test-repo')

export const GetCommits = vi.fn<[number], Promise<CommitNode[]>>()
  .mockResolvedValue([])

export const GetStatus = vi.fn<[], Promise<RepoStatus>>()
  .mockResolvedValue({ staged: [], unstaged: [], untracked: [] })

export const CreateCommit = vi.fn<[string], Promise<string>>()
  .mockResolvedValue('abc1234')

export const Push = vi.fn<[string, string, boolean], Promise<void>>()
  .mockResolvedValue(undefined)

// ... all other bound methods
```

### Utility function tests (`app/frontend/src/lib/format.test.ts`)

```typescript
import { describe, it, expect } from 'vitest'
import { shortHash } from './format'

describe('shortHash', () => {
  it('returns first 7 chars of a full hash', () => {
    expect(shortHash('abc1234567890')).toBe('abc1234')
  })
  it('returns the full string if shorter than 7', () => {
    expect(shortHash('abc')).toBe('abc')
  })
})
```

### Zustand store tests (`app/frontend/src/stores/gitStore.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { useGitStore } from './gitStore'

beforeEach(() => {
  // Reset store to initial state between tests
  useGitStore.setState(useGitStore.getInitialState())
})

describe('selectedCommit', () => {
  it('updates when setSelectedCommit is called', () => {
    act(() => useGitStore.getState().setSelectedCommit('abc1234'))
    expect(useGitStore.getState().selectedCommit).toBe('abc1234')
  })

  it('clears selected file when commit changes', () => {
    act(() => {
      useGitStore.getState().setSelectedFile('src/main.go')
      useGitStore.getState().setSelectedCommit('new-hash')
    })
    expect(useGitStore.getState().selectedFile).toBeNull()
  })
})
```

### Hook tests (`app/frontend/src/hooks/useCommits.test.ts`)

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { createWrapper } from '../test/queryWrapper'
import { useCommits } from './useCommits'
import { GetCommits } from '@/wailsjs/go/main/App'

describe('useCommits', () => {
  it('returns commits from the backend', async () => {
    vi.mocked(GetCommits).mockResolvedValue([
      { hash: 'abc1234', shortHash: 'abc1234', message: 'Fix bug', author: 'Alice',
        email: 'alice@x.com', date: new Date(), parents: [], refs: [],
        column: 0, color: 0, lines: [] },
    ])

    const { result } = renderHook(() => useCommits('/tmp/repo', 100), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].message).toBe('Fix bug')
  })
})
```

### Running frontend tests

```bash
cd app/frontend

# Run all tests once
npm test

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage
```

`package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 5. End-to-End Tests (Playwright)

E2E tests run the frontend in Vite dev server mode with fully mocked Wails bindings. No Wails build is required.

### Setup (`app/frontend/playwright.config.ts`)

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev:mock',  // Vite server with mock backend
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

The `dev:mock` script sets an env variable that tells the app to use the mock backend instead of real Wails bindings:

```typescript
// app/frontend/src/main.tsx
const isMock = import.meta.env.VITE_MOCK_BACKEND === 'true'
const bindings = isMock
  ? await import('./test/wailsmocks/go/main/App')
  : await import('../wailsjs/go/main/App')
```

### Example E2E test (`app/frontend/e2e/history.spec.ts`)

```typescript
import { test, expect } from '@playwright/test'
import { setupMockBackend } from './helpers'

test.beforeEach(async ({ page }) => {
  await setupMockBackend(page, {
    commits: [
      { hash: 'abc1234', message: 'Add login page', author: 'Alice', date: new Date() },
      { hash: 'def5678', message: 'Fix typo', author: 'Bob', date: new Date() },
    ],
  })
  await page.goto('/')
})

test('shows commit list in history view', async ({ page }) => {
  await expect(page.getByText('Add login page')).toBeVisible()
  await expect(page.getByText('Fix typo')).toBeVisible()
})

test('selecting a commit shows its details', async ({ page }) => {
  await page.getByText('Add login page').click()
  await expect(page.getByTestId('commit-detail')).toBeVisible()
  await expect(page.getByText('Alice')).toBeVisible()
})

test('staging a file enables the commit button', async ({ page }) => {
  await page.getByRole('tab', { name: 'Changes' }).click()
  await page.getByTestId('file-checkbox').first().click()
  await expect(page.getByRole('button', { name: 'Commit' })).toBeEnabled()
})
```

### Running E2E tests

```bash
cd app/frontend

# Install Playwright browsers (once)
npx playwright install

# Run E2E tests
npm run test:e2e

# Interactive UI mode
npx playwright test --ui
```

---

## 6. CI Pipeline (`.github/workflows/test.yml`)

Tests run on pushes to `main` and every pull request. Go 1.27 is selected from `app/go.mod`; Wails v2.17.1 is a pinned Go tool, not a global CLI. In addition to Go tests, macOS CI runs `go tool wails build` from `app/` with Node.js 22 to check binding generation and the production frontend/native build.

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  go-tests:
    name: Go Backend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: app/go.mod
          cache-dependency-path: app/go.sum

      - name: Download Go dependencies
        run: go mod download
        working-directory: app

      - name: Test app backend
        run: go test -race -cover ./git/...
        working-directory: app

  app-tests:
    name: Wails App Tests and Build
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: app/go.mod
          cache-dependency-path: app/go.sum

      - name: Download Go dependencies
        run: go mod download
        working-directory: app

      - name: Prepare embedded assets for Go tests
        run: mkdir -p frontend/dist && touch frontend/dist/.placeholder
        working-directory: app

      - name: Test app bindings
        run: go test -race -cover .
        working-directory: app

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: app/frontend/package-lock.json

      - name: Install frontend dependencies
        run: npm ci
        working-directory: app/frontend

      - name: Build Wails app with generated bindings
        run: go tool wails build
        working-directory: app

  frontend-tests:
    name: Frontend Tests (Vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: app/frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: app/frontend

      - name: Run unit + component tests
        run: npm test
        working-directory: app/frontend

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: app/frontend/coverage/

  e2e-tests:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: app/frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: app/frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: app/frontend

      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: app/frontend

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: app/frontend/playwright-report/
```

---

## 7. Coverage Targets

These are guidelines, not hard gates — pragmatic coverage matters more than hitting a number.

| Package | Target |
|---|---|
| `app/git/` | ≥ 80% |
| Frontend lib/utils | ≥ 90% |
| Frontend components | ≥ 70% (happy path + key error states) |

---

## 8. What Not to Test

- Auto-generated Wails bindings (`wailsjs/`) — these are generated code
- The Canvas 2D graph renderer — pixel-level rendering is not testable in jsdom; test the *data* (swimlane algorithm in Go) instead
- Sparkle/WinSparkle CGo bindings — these are third-party libraries; test the Go wrapper that calls them

---

## 9. Checklist

**Setup:**
- [ ] `go test ./...` passes in `app/` with no failures
- [ ] `vitest.config.ts` with jsdom environment and wailsjs alias
- [ ] `src/test/setup.ts` with `window.runtime` mock
- [ ] `src/test/wailsmocks/` folder with all bound methods mocked
- [ ] `playwright.config.ts` with Vite dev server
- [ ] `dev:mock` npm script with `VITE_MOCK_BACKEND=true`

**Tests written (alongside each plan):**
- [ ] `app/git/repository_test.go` — Open, ErrNotARepo
- [ ] `app/git/commits_test.go` — GetCommits, graph layout fields
- [ ] `app/git/diff_test.go` — GetCommitDiff, GetFileDiff
- [ ] `app/git/staging_test.go` — StageFile, CreateCommit, StageHunk
- [ ] Frontend: `format.test.ts`, `gitStore.test.ts`
- [ ] Frontend: `useCommits.test.ts`, `useBranches.test.ts`
- [ ] Frontend: `CommitBox.test.tsx`
- [ ] E2E: history view, changes view

**CI:**
- [ ] `.github/workflows/test.yml` running on every PR
- [ ] Go race detector enabled (`-race`)
- [ ] macOS production build with binding generation passes (`cd app && go tool wails build`, Go 1.27+, Node.js 22)
- [ ] Playwright report uploaded on failure
