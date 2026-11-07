# Implementation Plan: Auto-Update & Distribution

## Overview
Bough supports auto-updates on macOS (Sparkle 2), Windows (WinSparkle), and Linux (AppImage + AppImageUpdate). Updates are distributed via GitHub Releases with a signed appcast for security.

**Linux distribution support:** Bough targets all major Linux distributions via the AppImage format (Ubuntu, Fedora, Arch, Debian, openSUSE, and any other distro with FUSE2 or kernel ≥ 5.13). There is no package-manager dependency and no distro lock-in.

---

## Version Embedding

**File:** `Makefile` (in project root)

```makefile
.PHONY: build
VERSION ?= $(shell git describe --tags --always)
BUILD_DATE ?= $(shell date -u +%Y-%m-%d)

build:
	go build \
		-ldflags="-X main.version=$(VERSION) -X main.buildDate=$(BUILD_DATE)" \
		-o bin/Bough \
		./cmd/main.go

build-wails:
	cd app && go tool wails build \
		-ldflags="-X main.version=$(VERSION) -X main.buildDate=$(BUILD_DATE)" \
		-o Bough.app
```

**File:** `cmd/main.go`

```go
package main

import (
	"fmt"
)

var (
	version   = "dev"
	buildDate = "unknown"
)

func main() {
	fmt.Printf("Bough version %s (built %s)\n", version, buildDate)
	// ... rest of app
}
```

Access version in frontend:

```typescript
// In Go backend
func (a *App) GetAppVersion(ctx context.Context) string {
	return version // from build flags
}

// In React
const { data: version } = useQuery({
	queryKey: ['app-version'],
	queryFn: GetAppVersion,
});
```

---

## macOS: Sparkle 2 Integration

**File:** `update/updater_darwin.go`

```go
//go:build darwin

package update

import (
	"context"
	"fmt"
	"os"
)

const (
	// Path to Sparkle framework (included in macOS app bundle)
	SparkleFramework = "Sparkle.framework"
)

type macOSUpdater struct {
	appcastURL string
	publicKey  string
}

// NewMacOSUpdater creates an updater for macOS using Sparkle 2
func NewMacOSUpdater(appcastURL, publicKey string) *macOSUpdater {
	return &macOSUpdater{
		appcastURL: appcastURL,
		publicKey:  publicKey,
	}
}

// CheckForUpdates checks the appcast and returns available updates
func (u *macOSUpdater) CheckForUpdates(ctx context.Context) error {
	// This would normally use Sparkle's native API via CGo
	// For now, we'll use a simpler HTTP approach that Sparkle can call

	// In a real implementation, you'd use:
	// import "github.com/sparkle-project/Sparkle" (via CGo)
	// sparkle.SUUpdater.shared().checkForUpdates()

	return nil
}

// InstallUpdate downloads and installs the update
func (u *macOSUpdater) InstallUpdate(ctx context.Context, downloadURL string) error {
	// Sparkle handles the download and installation automatically
	return nil
}

// SetAutomaticUpdates enables background checking
func (u *macOSUpdater) SetAutomaticUpdates(enabled bool) error {
	// Sparkle configuration
	return nil
}
```

**File:** `update/sparkle.go` (CGo wrapper)

```go
//go:build darwin && cgo

package update

/*
#cgo LDFLAGS: -framework Sparkle
#cgo CFLAGS: -I/path/to/Sparkle.framework/Headers

#import <Foundation/Foundation.h>
#import <Sparkle/Sparkle.h>

void setupSparkle(const char* appcastURL) {
	@autoreleasepool {
		SUUpdater *updater = SUUpdater.sharedUpdater;
		updater.feedURL = [NSURL URLWithString:@(appcastURL)];
		updater.automaticallyChecksForUpdates = YES;
		[updater checkForUpdatesInBackground];
	}
}
*/
import "C"

import (
	"fmt"
	"unsafe"
)

func SetupSparkle(appcastURL string) error {
	cURL := C.CString(appcastURL)
	defer C.free(unsafe.Pointer(cURL))

	C.setupSparkle(cURL)
	return nil
}
```

**File:** `Info.plist` (in macOS app bundle)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Bough</string>
	<key>CFBundleVersion</key>
	<string>1.0.0</string>
	<key>SUFeedURL</key>
	<string>https://releases.example.com/appcast.xml</string>
	<key>SUAllowsAutomaticUpdates</key>
	<true/>
	<key>SUEnableAutomaticChecks</key>
	<true/>
	<key>SUScheduledCheckInterval</key>
	<integer>86400</integer>
	<key>SUPublicEDKey</key>
	<string>YOUR_EDDSA_PUBLIC_KEY_HERE</string>
</dict>
</plist>
```

---

## EdDSA Key Generation & Signing

**Script:** `scripts/generate_keys.sh`

```bash
#!/bin/bash
set -e

KEYS_DIR="${1:-.}"

# Generate EdDSA keypair for Sparkle
openssl genpkey -algorithm ed25519 -out "$KEYS_DIR/sparkle_key" || true

# Extract public key in PEM format
openssl pkey -in "$KEYS_DIR/sparkle_key" -pubout -out "$KEYS_DIR/sparkle_key.pub"

# Convert to base64 for appcast
PUBLIC_KEY=$(openssl pkey -in "$KEYS_DIR/sparkle_key.pub" -text -noout | grep -A2 "pub:" | tail -1 | tr -d '[:space:]')

echo "Generated Sparkle EdDSA keypair"
echo "Public key (for appcast): $PUBLIC_KEY"
```

**Script:** `scripts/sign_update.sh`

Signs a build with EdDSA signature.

```bash
#!/bin/bash
set -e

BUILD_FILE="${1:?Provide build file path}"
KEYS_DIR="${2:-.}"

if [ ! -f "$KEYS_DIR/sparkle_key" ]; then
	echo "Error: sparkle_key not found in $KEYS_DIR"
	exit 1
fi

# Compute EdDSA signature
SIGNATURE=$(openssl dgst -sign "$KEYS_DIR/sparkle_key" -binary "$BUILD_FILE" | base64 | tr -d '\n')

echo "$SIGNATURE"
```

---

## Appcast XML Format

**File:** `appcast.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Bough Updates</title>
    <link>https://github.com/example/bough</link>
    <description>Bough Git GUI client release notes</description>
    <language>en</language>

    <!-- macOS Intel -->
    <item>
      <title>Version 1.0.0</title>
      <description>
        <![CDATA[
          <h3>New Features</h3>
          <ul>
            <li>Commit graph visualization</li>
            <li>Worktree management</li>
            <li>Chunk-level staging</li>
          </ul>
        ]]>
      </description>
      <pubDate>Thu, 27 Mar 2026 12:00:00 +0000</pubDate>
      <enclosure
        url="https://github.com/example/bough/releases/download/v1.0.0/Bough-1.0.0-macos-intel.dmg"
        sparkle:version="1.0.0"
        sparkle:shortVersionString="1.0.0"
        sparkle:signature="EDDSA_SIGNATURE_HERE"
        sparkle:edSignature="EDDSA_SIGNATURE_HERE"
        length="125000000"
        type="application/octet-stream" />
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
    </item>

    <!-- macOS ARM64 -->
    <item>
      <title>Version 1.0.0 (ARM)</title>
      <description>Universal binary for Apple Silicon</description>
      <pubDate>Thu, 27 Mar 2026 12:00:00 +0000</pubDate>
      <enclosure
        url="https://github.com/example/bough/releases/download/v1.0.0/Bough-1.0.0-macos-arm64.dmg"
        sparkle:version="1.0.0"
        sparkle:shortVersionString="1.0.0"
        sparkle:signature="EDDSA_SIGNATURE_HERE"
        sparkle:edSignature="EDDSA_SIGNATURE_HERE"
        length="120000000"
        type="application/octet-stream" />
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
    </item>

    <!-- Windows -->
    <item>
      <title>Version 1.0.0</title>
      <pubDate>Thu, 27 Mar 2026 12:00:00 +0000</pubDate>
      <enclosure
        url="https://github.com/example/bough/releases/download/v1.0.0/Bough-1.0.0-windows-x64.msi"
        sparkle:version="1.0.0"
        sparkle:shortVersionString="1.0.0"
        length="95000000"
        type="application/octet-stream" />
    </item>

    <!-- Linux -->
    <item>
      <title>Version 1.0.0</title>
      <pubDate>Thu, 27 Mar 2026 12:00:00 +0000</pubDate>
      <enclosure
        url="https://github.com/example/bough/releases/download/v1.0.0/Bough-1.0.0-linux-x64.AppImage"
        sparkle:version="1.0.0"
        sparkle:shortVersionString="1.0.0"
        length="88000000"
        type="application/octet-stream" />
    </item>
  </channel>
</rss>
```

---

## Windows: WinSparkle Integration

**File:** `update/updater_windows.go`

```go
//go:build windows

package update

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

const (
	WinSparkleVersion = "0.7.0"
)

type WindowsUpdater struct {
	appcastURL string
}

// NewWindowsUpdater creates an updater for Windows using WinSparkle
func NewWindowsUpdater(appcastURL string) *WindowsUpdater {
	return &WindowsUpdater{
		appcastURL: appcastURL,
	}
}

// CheckForUpdates checks the appcast for available updates
func (u *WindowsUpdater) CheckForUpdates(ctx context.Context) error {
	// WinSparkle.dll should be in the app directory
	// It's called automatically when initialized in main()

	return nil
}

// Initialize sets up WinSparkle (called on app startup)
func (u *WindowsUpdater) Initialize() error {
	// In main(), add:
	// win_sparkle_set_appcast_url(appcastURL)
	// win_sparkle_init()

	return nil
}
```

**File:** `cmd/main.go` (Windows section)

```go
// At app startup
import "bough/update"

func init() {
	if runtime.GOOS == "windows" {
		updater := update.NewWindowsUpdater("https://releases.example.com/appcast.xml")
		updater.Initialize()
	}
}
```

**WinSparkle DLL Placement:**
- Copy `WinSparkle.dll` to the application directory
- Include in MSI installer

**File:** `wix/installer.wxs` (WiX installer config)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product
    Id="*"
    Name="Bough"
    Language="1033"
    Version="1.0.0.0"
    Manufacturer="Bough Project">

    <Package
      InstallerVersion="200"
      Compressed="yes" />

    <!-- Install to Program Files -->
    <StandardDirectory Id="ProgramFilesFolder">
      <Directory Id="INSTALLFOLDER" Name="Bough" />
    </StandardDirectory>

    <!-- Include WinSparkle DLL -->
    <Feature Id="ProductFeature" Title="Bough" Level="1">
      <ComponentRef Id="BoughExe" />
      <ComponentRef Id="WinSparkleDll" />
    </Feature>

    <!-- Components -->
    <DirectoryRef Id="INSTALLFOLDER">
      <Component Id="BoughExe" Guid="*">
        <File Id="BoughExecutable" Source="Bough.exe" />
      </Component>
      <Component Id="WinSparkleDll" Guid="*">
        <File Id="WinSparkleLib" Source="WinSparkle.dll" />
      </Component>
    </DirectoryRef>
  </Product>
</Wix>
```

---

## Linux: AppImage Distribution

AppImage is a self-contained, distribution-agnostic format. The resulting `.AppImage` file runs on any Linux distribution that has FUSE2 or uses AppImage's bundled runtime (Ubuntu, Fedora, Arch, openSUSE, Debian, Mint, Pop!_OS, and others). No root access, no package manager, no distro-specific dependencies required.

The GitHub Actions CI runner (`ubuntu-latest`) is just the build environment — it has no effect on which distributions the AppImage supports.

**File:** `scripts/build_appimage.sh`

```bash
#!/bin/bash
set -e

VERSION="${1:?Provide version}"
APPDIR="Bough.AppDir"

# Create AppDir structure
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons"

# Copy binary
cp build/Bough "$APPDIR/usr/bin/bough"

# Desktop file
cat > "$APPDIR/usr/share/applications/bough.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Bough
Exec=bough
Icon=bough
Categories=Development;
EOF

# Icon
cp assets/icon.png "$APPDIR/usr/share/icons/bough.png"

# .DirIcon (AppImage custom icon)
cp assets/icon.png "$APPDIR/.DirIcon"

# Generate AppImage
appimagetool "$APPDIR" "Bough-${VERSION}-linux-x64.AppImage"

echo "Built Bough-${VERSION}-linux-x64.AppImage"
```

**File:** `update/updater_linux.go`

```go
//go:build linux

package update

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type LinuxUpdater struct {
	appcastURL string
}

// NewLinuxUpdater creates an updater for Linux using AppImageUpdate
func NewLinuxUpdater(appcastURL string) *LinuxUpdater {
	return &LinuxUpdater{
		appcastURL: appcastURL,
	}
}

// CheckForUpdates checks for newer AppImage versions
func (u *LinuxUpdater) CheckForUpdates(ctx context.Context) error {
	// Get current executable path
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Check if running from AppImage
	appImage := os.Getenv("APPIMAGE")
	if appImage == "" {
		return fmt.Errorf("not running from AppImage")
	}

	// Use AppImageUpdate CLI to check for updates
	cmd := exec.CommandContext(ctx, "AppImageUpdate", "--check-for-updates", appImage)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("AppImageUpdate check failed: %w", err)
	}

	return nil
}

// InstallUpdate downloads and installs the update
func (u *LinuxUpdater) InstallUpdate(ctx context.Context, downloadURL string) error {
	appImage := os.Getenv("APPIMAGE")
	if appImage == "" {
		return fmt.Errorf("not running from AppImage")
	}

	// AppImageUpdate automatically handles download and staging
	cmd := exec.CommandContext(ctx, "AppImageUpdate", appImage)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("AppImageUpdate failed: %w", err)
	}

	// Restart the application
	return exec.CommandContext(ctx, appImage).Start()
}
```

---

## GitHub Actions Release Workflow

**File:** `.github/workflows/release.yml`

Complete CI/CD pipeline for building and releasing on all platforms. Requires Go 1.27+ and Node.js 22. Wails v2.17.1 is pinned as a Go tool in `app/go.mod`; download dependencies with `cd app && go mod download`, then run all Wails commands from `app/` using `go tool wails` (no global CLI or older `GOTOOLCHAIN` override). The checked-in workflow is authoritative; the example below outlines the pipeline.

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          # macOS Intel
          - os: macos-12
            arch: x86_64
            target: darwin-amd64
            artifact: Bough-${{ github.ref_name }}-macos-intel.dmg

          # macOS ARM64
          - os: macos-latest
            arch: arm64
            target: darwin-arm64
            artifact: Bough-${{ github.ref_name }}-macos-arm64.dmg

          # Windows
          - os: windows-latest
            arch: x86_64
            target: windows-amd64
            artifact: Bough-${{ github.ref_name }}-windows-x64.msi

          # Linux
          - os: ubuntu-latest
            arch: x86_64
            target: linux-amd64
            artifact: Bough-${{ github.ref_name }}-linux-x64.AppImage

    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version-file: app/go.mod
          cache-dependency-path: app/go.sum

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Download Go dependencies
        run: go mod download
        working-directory: app

      - name: Install dependencies (macOS)
        if: runner.os == 'macOS'
        run: |
          brew install create-dmg

      - name: Install dependencies (Windows)
        if: runner.os == 'Windows'
        run: |
          choco install wix -y

      - name: Install dependencies (Linux)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y appimage-builder

      - name: Install frontend dependencies
        run: npm ci
        working-directory: app/frontend

      - name: Build Wails app
        env:
          VERSION: ${{ github.ref_name }}
          BUILD_DATE: ${{ github.event.created_at }}
        run: |
          go tool wails build -platform ${{ matrix.target }} -o ${{ matrix.artifact }}
        working-directory: app

      - name: Sign binary (macOS)
        if: runner.os == 'macOS'
        env:
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_SIGNING_KEY: ${{ secrets.APPLE_SIGNING_KEY }}
        run: |
          codesign -s - --deep --force build/Bough.app

      - name: Notarize (macOS)
        if: runner.os == 'macOS'
        env:
          NOTARY_USER: ${{ secrets.NOTARY_USER }}
          NOTARY_PASSWORD: ${{ secrets.NOTARY_PASSWORD }}
        run: |
          xcrun notarytool submit build/${{ matrix.artifact }} \
            --apple-id "$NOTARY_USER" \
            --password "$NOTARY_PASSWORD" \
            --team-id ${{ secrets.APPLE_TEAM_ID }} \
            --wait
          xcrun stapler staple build/Bough.app

      - name: Sign binary (Windows)
        if: runner.os == 'Windows'
        env:
          SIGN_CERTIFICATE: ${{ secrets.SIGN_CERTIFICATE }}
          SIGN_PASSWORD: ${{ secrets.SIGN_PASSWORD }}
        run: |
          echo "${{ env.SIGN_CERTIFICATE }}" > cert.pfx
          signtool sign /f cert.pfx /p "${{ env.SIGN_PASSWORD }}" /t http://timestamp.digicert.com "build/${{ matrix.artifact }}"
          del cert.pfx

      - name: Generate signatures
        run: |
          bash scripts/sign_update.sh build/${{ matrix.artifact }} > signature.txt
          echo "${{ matrix.artifact }}" >> release_artifacts.txt
          echo "$(cat signature.txt)" >> release_artifacts.txt

      - name: Upload to release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            build/${{ matrix.artifact }}
            signature.txt
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  appcast:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Download all artifacts
        uses: actions/download-artifact@v3
        with:
          path: artifacts

      - name: Generate appcast
        run: |
          bash scripts/generate_appcast.sh ${{ github.ref_name }}

      - name: Deploy appcast to gh-pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./appcast
          cname: updates.example.com
```

---

## Appcast Generation Script

**File:** `scripts/generate_appcast.sh`

```bash
#!/bin/bash
set -e

VERSION="${1:?Provide version tag}"
REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-example}"
REPO_NAME="${GITHUB_REPOSITORY#*/}"
RELEASE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}"

# Get public key from env or file
PUBLIC_KEY="${SPARKLE_PUBLIC_KEY:-$(cat .sparkle_public_key 2>/dev/null || echo 'YOUR_KEY_HERE')}"

# Create appcast directory
mkdir -p appcast

# Generate appcast.xml
cat > appcast/appcast.xml << 'APPCAST_EOF'
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Bough Updates</title>
    <link>https://github.com/example/bough</link>
    <description>Bough release notes and updates</description>
    <language>en</language>
APPCAST_EOF

# Fetch release information from GitHub API
RELEASE_JSON=$(curl -s "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${VERSION}")
RELEASE_DATE=$(echo "$RELEASE_JSON" | jq -r '.published_at' | sed 's/Z/+0000/')
RELEASE_NOTES=$(echo "$RELEASE_JSON" | jq -r '.body' | head -50)

# Add macOS Intel entry
SIZE=$(curl -sI "${RELEASE_URL}/Bough-${VERSION}-macos-intel.dmg" | grep -i content-length | awk '{print $2}' | tr -d '\r')
SIGNATURE=$(bash scripts/sign_update.sh Bough-${VERSION}-macos-intel.dmg 2>/dev/null || echo "SIGNATURE_HERE")

cat >> appcast/appcast.xml << APPCAST_EOF

    <item>
      <title>Version ${VERSION}</title>
      <description><![CDATA[
        ${RELEASE_NOTES}
      ]]></description>
      <pubDate>$(date -R)</pubDate>
      <enclosure
        url="${RELEASE_URL}/Bough-${VERSION}-macos-intel.dmg"
        sparkle:version="${VERSION}"
        sparkle:shortVersionString="${VERSION}"
        sparkle:edSignature="${SIGNATURE}"
        length="${SIZE}"
        type="application/octet-stream" />
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
    </item>
APPCAST_EOF

# Add macOS ARM entry
SIZE=$(curl -sI "${RELEASE_URL}/Bough-${VERSION}-macos-arm64.dmg" | grep -i content-length | awk '{print $2}' | tr -d '\r')
SIGNATURE=$(bash scripts/sign_update.sh Bough-${VERSION}-macos-arm64.dmg 2>/dev/null || echo "SIGNATURE_HERE")

cat >> appcast/appcast.xml << APPCAST_EOF

    <item>
      <title>Version ${VERSION} (Apple Silicon)</title>
      <description>Universal binary for Apple Silicon</description>
      <pubDate>$(date -R)</pubDate>
      <enclosure
        url="${RELEASE_URL}/Bough-${VERSION}-macos-arm64.dmg"
        sparkle:version="${VERSION}"
        sparkle:shortVersionString="${VERSION}"
        sparkle:edSignature="${SIGNATURE}"
        length="${SIZE}"
        type="application/octet-stream" />
      <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
    </item>
APPCAST_EOF

# Add Windows entry
SIZE=$(curl -sI "${RELEASE_URL}/Bough-${VERSION}-windows-x64.msi" | grep -i content-length | awk '{print $2}' | tr -d '\r')

cat >> appcast/appcast.xml << APPCAST_EOF

    <item>
      <title>Version ${VERSION}</title>
      <pubDate>$(date -R)</pubDate>
      <enclosure
        url="${RELEASE_URL}/Bough-${VERSION}-windows-x64.msi"
        sparkle:version="${VERSION}"
        sparkle:shortVersionString="${VERSION}"
        length="${SIZE}"
        type="application/octet-stream" />
    </item>
APPCAST_EOF

# Add Linux entry
SIZE=$(curl -sI "${RELEASE_URL}/Bough-${VERSION}-linux-x64.AppImage" | grep -i content-length | awk '{print $2}' | tr -d '\r')

cat >> appcast/appcast.xml << APPCAST_EOF

    <item>
      <title>Version ${VERSION}</title>
      <pubDate>$(date -R)</pubDate>
      <enclosure
        url="${RELEASE_URL}/Bough-${VERSION}-linux-x64.AppImage"
        sparkle:version="${VERSION}"
        sparkle:shortVersionString="${VERSION}"
        length="${SIZE}"
        type="application/octet-stream" />
    </item>

  </channel>
</rss>
APPCAST_EOF

echo "Generated appcast.xml for version $VERSION"
```

---

## Update Check in App

**File:** `bough/frontend/src/hooks/useAppUpdates.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { GetAppVersion } from '../wailsjs/go/main/App';
import { useAppStore } from '../store/appStore';

export const useAppUpdates = () => {
  const { showNotification } = useAppStore();

  // Check for updates every hour
  const query = useQuery({
    queryKey: ['app-updates'],
    queryFn: async () => {
      const response = await fetch('https://updates.example.com/appcast.xml');
      const xml = await response.text();

      // Parse XML and compare versions
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const latestItem = doc.querySelector('item');
      const latestVersion = latestItem?.querySelector('title')?.textContent || '';

      return { latestVersion };
    },
    staleTime: 3600000, // 1 hour
    retry: false,
  });

  return query;
};
```

---

## Verification Checklist

- [ ] Version embeds correctly via build flags
- [ ] Appcast XML generates with valid structure
- [ ] EdDSA signatures compute correctly
- [ ] macOS: Sparkle 2 framework integrates (Info.plist)
- [ ] macOS: App is code-signed and notarized
- [ ] macOS: DMG package builds and mounts correctly
- [ ] Windows: WinSparkle DLL included in MSI
- [ ] Windows: MSI installer is Authenticode signed
- [ ] Windows: App runs after MSI installation
- [ ] Linux: AppImage builds and executes
- [ ] Linux: AppImageUpdate binary available
- [ ] GitHub Actions workflow completes all matrix jobs
- [ ] Artifacts uploaded to GitHub Release page
- [ ] Appcast deployed to gh-pages or static host
- [ ] Update check queries appcast without errors
- [ ] Version comparison works (1.0.0 > 0.9.9)
- [ ] Test downloading and installing update manually

---

## Implementation Order

1. Add version embedding to build system (Makefile)
2. Create update package structure (go-update, platform-specific files)
3. Generate EdDSA keypair and add to .gitignore
4. Create appcast.xml template
5. Build appcast generation script
6. Set up macOS Sparkle 2 integration (Info.plist, framework)
7. Create Windows WinSparkle setup (DLL, MSI config)
8. Build AppImage for Linux
9. Create GitHub Actions release workflow (all platforms)
10. Test local builds with version tags
11. Deploy first release to GitHub Releases
12. Verify appcast generation and deployment
13. Test update check in running app
14. Add UI for manual "Check for Updates" button
15. Configure automatic update checking (once per day)

---

## Security Considerations

- EdDSA key stored securely in GitHub Secrets
- Code signing certificates in Secrets (macOS, Windows)
- Appcast signed with EdDSA signature
- All artifacts HTTPS-only
- Public keys embedded in app Info.plist
- No plaintext passwords in version control
- Notarization for macOS (malware scanning)
- Timestamped signatures for Windows
