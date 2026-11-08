# README

## About

Bough is a Wails v3 desktop application (Go backend + React/TypeScript frontend).

The Wails v3 project configuration lives in `build/config.yml`. The `wails3` CLI
(`wails3 dev`, `wails3 build`, `wails3 generate bindings`, …) is pinned as a Go
tool in `go.mod` (`tool github.com/wailsapp/wails/v3/cmd/wails3`). From this
directory you can always run `go tool wails3 …`; the top-level `Makefile`
builds that same CLI into `$(go env GOPATH)/bin` so the Taskfiles' nested
`wails3` invocations resolve from PATH.

## Live Development

To run in live development mode with hot reload of both Go and React:

```bash
wails3 dev
```

(or `make dev` from the repository root). This starts the Vite dev server and a
watch task that rebuilds and reruns the app on changes; the frontend
dev-server URL is injected via the `FRONTEND_DEVSERVER_URL` environment
variable.

## Building

To build a redistributable, production-mode package:

```bash
wails3 build
wails3 package          # .app bundle (macOS) / NSIS installer (Windows)
```

Binaries are written to `bin/` from this directory.
