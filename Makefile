.PHONY: build build-wails build-wails-glass dev install-wails3 test test-frontend test-e2e clean generate-bindings help

# Embed version from the nearest git tag (falls back to commit hash).
VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_DATE ?= $(shell date -u +%Y-%m-%d)

# wails3 is pinned as a Go tool in app/go.mod. Wails v3's CLI resolves nested
# `wails3` invocations from PATH (its Taskfiles call `wails3 ...` directly), so
# we build the pinned CLI into GOPATH/bin and prepend it to PATH.
GO_BIN := $(shell go env GOPATH)/bin
export PATH := $(GO_BIN):$(PATH)

# The version ldflags are folded into the platform Taskfiles via the
# LD_FLAGS variable (defaults to "-w -s" strip flags).
LD_FLAGS := -w -s -X main.version=$(VERSION) -X main.buildDate=$(BUILD_DATE)

# Extra Go build tags forwarded to Wails, e.g.
#   make build-wails EXTRA_TAGS=liquidglass,private_mac_apis
EXTRA_TAGS ?=

## install-wails3: Build the wails3 CLI pinned in app/go.mod into GOPATH/bin.
install-wails3:
	@if [ ! -x "$(GO_BIN)/wails3" ] || [ "$$(wails3 version 2>/dev/null)" != "v3.0.0" ]; then \
		cd app && go build -o "$(GO_BIN)/wails3" github.com/wailsapp/wails/v3/cmd/wails3; \
	fi

# ── Development ───────────────────────────────────────────────────────────────

## dev: Start the Wails v3 dev server with hot reload (Go + React).
dev: install-wails3
	cd app && EXTRA_TAGS="$(EXTRA_TAGS)" wails3 dev

# ── Production builds ─────────────────────────────────────────────────────────

## build-wails: Build the full Wails v3 application (outputs to app/bin/).
build-wails: install-wails3
	cd app && wails3 build VERSION="$(VERSION)" LD_FLAGS="$(LD_FLAGS)" $(if $(EXTRA_TAGS),EXTRA_TAGS="$(EXTRA_TAGS)")

## build-wails-glass: macOS build with the native Liquid Glass backdrop.
## Requires the private WebKit API for webview transparency, so this build is
## not suitable for the Mac App Store.
build-wails-glass:
	$(MAKE) build-wails EXTRA_TAGS=liquidglass,private_mac_apis

## build: Build the Go binary only (no frontend embedding), useful for backend tests.
build:
	cd app && go build -ldflags "-X main.version=$(VERSION)" -o ../bin/bough ./...

# ── Bindings ──────────────────────────────────────────────────────────────────

## generate-bindings: Regenerate the frontend bindings from the Go services.
generate-bindings: install-wails3
	cd app && wails3 generate bindings -ts -i -clean

# ── Tests ─────────────────────────────────────────────────────────────────────

## test: Run Go backend tests with the race detector.
test:
	cd app && go test -race -cover ./...

## test-frontend: Run Vitest unit and component tests.
test-frontend:
	cd app/frontend && npm test

## test-e2e: Run Playwright end-to-end tests.
test-e2e:
	cd app/frontend && npm run test:e2e

# ── Release utilities ─────────────────────────────────────────────────────────

## generate-keys: Generate an EdDSA keypair for signing update artifacts.
generate-keys:
	./scripts/generate_keys.sh .secrets

## appimage: Build a Linux AppImage via the Wails v3 Linux task (run on Linux).
appimage: install-wails3
	cd app && wails3 task linux:create:appimage GOOS=linux ARCH=amd64

## appcast: Generate appcast.xml for the current git tag.
appcast:
	./scripts/generate_appcast.sh $(VERSION)

# ── Housekeeping ──────────────────────────────────────────────────────────────

## clean: Remove build output and AppDir staging directories.
clean:
	rm -rf app/bin app/build/bin bin *.AppImage Bough.AppDir appcast

help:
	@grep -E '^## ' Makefile | sed 's/## /  /'
