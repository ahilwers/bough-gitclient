# Contributing to Bough

Thanks for your interest in contributing! Bough is free software, and every contribution — from a
typo fix to a new feature — is welcome.

Please take a moment to read this guide and the repository's
[AGENTS.md](AGENTS.md), which contains high-signal guidance for anyone working in this codebase.

## Table of contents

- [Getting started](#getting-started)
- [Finding work](#finding-work)
- [Reporting bugs](#reporting-bugs)
- [Feature requests](#feature-requests)
- [Development setup](#development-setup)
- [Pull request process](#pull-request-process)
- [Code conventions](#code-conventions)
- [Tests and verification](#tests-and-verification)
- [License and sign-off](#license-and-sign-off)

## Getting started

1. Fork the repository and clone it locally.
2. Set up your environment — see [Development setup](#development-setup).
3. Read [`AGENTS.md`](AGENTS.md) for high-signal guidance on working in this codebase.
4. Create a branch from `main`, make your changes, and open a pull request.

## Finding work

Bough uses GitHub Issues for bug reports, feature requests, and planned work — the issue tracker is
the roadmap:

- Issues labeled `good first issue` are a great starting point.
- Issues labeled `bug` are prioritized — it is worth asking in the issue before starting to avoid
  overlapping with someone else's work.
- If you plan a larger feature, discuss it in an issue first so the approach can be agreed upon
  before you invest time.

## Reporting bugs

A good bug report lets a maintainer reproduce the problem quickly. Please include:

- Bough version (from **Help → About**, or the build tag / release version) and operating system
  (macOS / Windows / Linux, including version and architecture).
- Steps to reproduce, with as much precision as possible.
- Expected behavior and what actually happened.
- A stack trace, log output, or console output if available.
- Whether the bug affects a specific repository size, shape, or Git host (e.g. submodules,
  shallow clones, large histories).

## Feature requests

Describe the problem you are trying to solve and why existing behavior is insufficient. Concrete
proposals are appreciated, but an idea or discussion-first approach is fine — roadmap decisions are
made in the issue discussion before implementation.

## Development setup

**Prerequisites:** Go 1.27+, Node.js 22. Wails v2.17.1 is pinned as a Go tool in `app/go.mod` — use
`go tool wails` from `app/`, **not** a globally installed CLI.

Platform-specific system packages (Xcode Command Line Tools on macOS, `libgtk-3-dev` and
`libwebkit2gtk-4.0-dev` on Ubuntu/Debian, WebView2 on Windows) are required to build the Wails app.

```bash
# Development server with hot reload (Go + React)
make dev                     # or: cd app && go tool wails dev

# Production build → app/build/bin/Bough.app
make build-wails             # or: cd app && go tool wails build

# Tests
make test                    # Go backend (race detector)
make test-frontend           # Vitest frontend tests
make test-e2e                # Playwright E2E tests
```

For frontend-only work, run commands from `app/frontend/` (`npm install`, `npm run dev`,
`npm run build`, `npm test`).

## Pull request process

1. **Branch naming** — use conventional prefixes: `feat/…`, `fix/…`, `chore/…`, `docs/…`,
   `refactor/…`. For example `feat/stash-untracked`.
2. **Commit messages** — use [Conventional Commits](https://www.conventionalcommits.org/), for
   example `feat(staging): support staging a single line`, `fix(diff): crash on binary files`,
   `docs: expand the README`. The existing history follows this style.
3. **Keep PRs small and focused** — one logical change per PR. Link the issue it addresses.
4. **Write tests alongside code** — backend behavior has Go tests, UI behavior has Vitest
   component tests. The repo convention is tests written with the code, not after.
5. **Run the verification steps** below before pushing.
6. **Rebase** on the latest `main` and resolve conflicts before requesting review.

## Code conventions

- **Language:** all user-facing and in-repository text is **English**, unless it is a deliberately
  localized UI string (see `app/frontend/src/locales/`).
- **Git backend split:** reads use `go-git` (history, diff, status, branches, refs); writes use
  `exec.Command git` (push/pull/fetch, rebase, cherry-pick, hooks).
- **Type system:** canonical Go types live in `app/git/types.go` and are mirrored as TypeScript
  interfaces in the frontend. Go `PascalCase` fields serialize to `camelCase` via Wails.
- **i18n:** every user-visible string must use the `t()` hook from `react-i18next` — never hard-code
  UI strings in JSX. Key format: `namespace.section.key`.
- **Buttons:** use the shared `app/frontend/src/components/shared/Button.tsx` for every application
  button. Do **not** add raw `<button>` elements outside this component.
- **State and data:** Zustand for app state, TanStack Query v5 for async data.
- **New files:** every new source file must carry the project's license header (see below).

### SPDX license header

All source files carry the project license header. New files must include it (adjust for the file's
comment syntax — `//`, `#`, or `/* … */`):

```go
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
```

## Tests and verification

Run these before opening a pull request:

```bash
cd app && go build ./...          # backend compiles
cd app && go test -race ./...     # backend tests
cd app/frontend && npm run build  # frontend builds
cd app/frontend && npm test       # frontend unit tests
```

Larger changes should also be verified against real Git repositories (the README and plans mention
testing with 100+, 1000+, and 10000+ commit repositories) and, ideally, on more than one platform.

## License and sign-off

Bough is licensed under the **GNU General Public License v3.0 or later** — see the
[LICENSE](LICENSE) file.

By opening a pull request, you agree that your contribution is licensed under the same terms as the
project (GPL-3.0-or-later). There is no separate CLA to sign; submitting a pull request constitutes
this acknowledgment.
