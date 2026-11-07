.PHONY: build build-wails dev test test-frontend clean

# Embed version from the nearest git tag (falls back to commit hash).
VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_DATE ?= $(shell date -u +%Y-%m-%d)
LDFLAGS  := -X main.version=$(VERSION) -X main.buildDate=$(BUILD_DATE)

# ── Development ───────────────────────────────────────────────────────────────

## dev: Start Wails dev server with hot reload (Go + React).
dev:
	cd app && go tool wails dev

# ── Production builds ─────────────────────────────────────────────────────────

## build-wails: Build the full Wails application (outputs to app/build/bin/).
build-wails:
	cd app && go tool wails build -ldflags "$(LDFLAGS)"

## build: Build the Go binary only (no frontend embedding), useful for backend tests.
build:
	cd app && go build -ldflags "$(LDFLAGS)" -o ../bin/bough ./...

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

## appimage: Build a Linux AppImage for the current version.
appimage:
	./scripts/build_appimage.sh $(VERSION)

## appcast: Generate appcast.xml for the current git tag.
appcast:
	./scripts/generate_appcast.sh $(VERSION)

# ── Housekeeping ──────────────────────────────────────────────────────────────

## clean: Remove build output and AppDir staging directories.
clean:
	rm -rf app/build/bin bin *.AppImage Bough.AppDir appcast

help:
	@grep -E '^## ' Makefile | sed 's/## /  /'
