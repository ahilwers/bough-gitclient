<p align="center">
  <img src="logos/gitmorrow-mark.svg" alt="GitMorrow" width="88" height="88">
</p>

<h1 align="center">GitMorrow</h1>

<p align="center">
  <strong>The Git Client Of Tomorrow</strong><br>
  A fast, native Git client for macOS, Windows, and Linux — free to use and built for developers.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg" alt="License: GPL-3.0-or-later"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg" alt="Platforms: macOS, Windows, Linux">
  <img src="https://img.shields.io/badge/status-pre--release-yellow.svg" alt="Status: pre-release">
</p>

---

**GitMorrow** is a cross-platform Git GUI client for macOS (primary), Windows, and Linux — built with
[Wails](https://wails.io) (Go + native WebView), React 19, and TypeScript. Designed for a
first-class working-copy experience: fast, native, and focused on your workflow.

GitMorrow is **free software**: free to use, free to modify, and free to share — your repositories
stay on your machine, and no account is required.

> **Status:** GitMorrow is in active development and still pre-1.0. Preview builds for all three
> platforms are published on the [Releases page](https://github.com/ahilwers/gitmorrow/releases/latest);
> expect breaking changes between versions and please report what breaks.

## Features

- **Visual commit graph** — your entire repository history at a glance. Color-coded swimlanes,
  merge lines, and branch labels, rendered at 60 fps on a native Canvas.
- **Hunk-level staging** — stage individual hunks or even single lines in the Changes view, powered
  by a Monaco diff viewer. Review every change before it goes in.
- **Git worktrees** — work on multiple branches simultaneously without stashing. Create, switch, and
  remove worktrees directly from the UI.
- **No account required** — works with any Git host, or none at all. Local repositories, offline.
- **Native, not Electron** — built with Go and the OS WebView, launched in under a second with a
  fraction of the RAM of Electron apps.
- **Built for performance** — the commit graph layout is computed in Go; history and diffs render
  instantly, even in repositories with thousands of commits.
- **Your credentials stay yours** — authentication is delegated to Git's native helpers: the SSH
  agent, macOS Keychain, and Windows Credential Manager. GitMorrow never stores your credentials.
- **Auto-updates** — Sparkle (macOS), WinSparkle (Windows), and AppImageUpdate (Linux).
- **AI-assisted commit messages** — optional AI-generated commit messages right from the commit box.

## Platform support

| Platform | Minimum | Distribution |
|---|---|---|
| macOS | 12 Monterey | `.dmg` (Intel & Apple Silicon) |
| Windows | 10 21H2 | NSIS installer (`.exe`) |
| Linux | modern distros | AppImage |

## Building from source

**Prerequisites:** Go 1.27+, Node.js 22. Wails v3.0.0 is pinned as a Go tool in `app/go.mod` — use the
`wails3` CLI (`go tool wails3` from `app/`, or `make install-wails3` to put it on PATH).

```bash
# Development (live hot reload, Go + React)
make dev                     # or: cd app && go tool wails3 dev

# Production build → app/bin/GitMorrow
make build-wails             # or: cd app && go tool wails3 build

# Regenerate frontend bindings from the Go service methods
make generate-bindings

# Tests
make test                    # Go backend tests (race detector)
make test-frontend           # Vitest frontend tests
make test-e2e                # Playwright E2E tests
```

Frontend-only workflows run from `app/frontend/`:

```bash
cd app/frontend
npm install
npm run dev      # Vite dev server
npm run build    # Frontend build
npm test         # Vitest unit tests
```

## Repository structure

```
app/          Desktop application (Wails 3 · Go backend · React frontend)
  ├── git/        Go Git backend (go-git reads, CLI-git writes)
  ├── update/     Auto-update integration (Sparkle / WinSparkle / AppImageUpdate)
  ├── build/      Wails v3 build assets (config.yml, per-platform taskfiles)
  └── frontend/   React 19 + TypeScript UI
docs/         Architecture and design documents
scripts/      Build and utility scripts
```

### Git backend split

- **Read operations** (history, diff, status, branches, refs) use [go-git](https://github.com/go-git/go-git/).
- **Write operations** (push, pull, fetch) delegate to the system Git via `exec.Command`, so SSH
  agents, credential helpers, GPG signing, and hooks work exactly as they do on the CLI.
- **Filesystem watching** via `fsnotify` keeps the UI in sync while you edit in your editor.

## Documentation

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution guide (setup, conventions, pull request process)
- [`docs/`](docs/) — architecture and design documents
- [`RELEASE.md`](RELEASE.md) — release build, code signing, and publishing on GitHub
- [`AGENTS.md`](AGENTS.md) — guidance for AI agents and contributors working in this repository

## Contributing

Contributions are welcome! See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution guide —
development setup, commit conventions, testing, and the SPDX license header every source file must
carry.

By contributing, you agree that your contributions are licensed under the same terms as the project
(GPL-3.0-or-later). All user-facing text in this repository is written in English.

## License

Copyright © 2026 Achim Hilwers

GitMorrow is free software: you can redistribute it and/or modify it under the terms of the
**GNU General Public License** as published by the Free Software Foundation, either **version 3** of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, **but WITHOUT ANY WARRANTY**; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
[GNU General Public License](LICENSE) for details.

You should have received a copy of the GNU General Public License along with this program.
If not, see <https://www.gnu.org/licenses/>.
