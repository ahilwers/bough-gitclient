# Build Directory

This directory contains the Wails v3 build assets for the application.

The structure is:

* bin - Output directory (by default `app/bin`)
* darwin - macOS specific files
* windows - Windows specific files
* linux - Linux specific files
* docker - Cross-compilation Dockerfiles
* config.yml - Project configuration used by the `wails3` CLI and by
  `wails3 update build-assets` to regenerate the platform assets.
  After editing, run `wails3 task common:update:build-assets` from `app/`.
* Taskfile.yml - Common tasks shared by the per-platform Taskfiles.

## Mac

The `darwin` directory holds files specific to macOS builds:

- `Info.plist` - used for release builds via `wails3 build`/`package`.
- `Info.dev.plist` - used for the dev bundle created by `wails3 task run`.
- `icons.icns`, `Assets.car`, `dmg-*` - application icon and DMG artwork.

**Version handling:** the committed plists and `windows/info.json` carry a
placeholder version from `config.yml`. Release builds pass
`VERSION=<tag>` (see the `Makefile` and the release workflow); the
`darwin:patch:app:version` and `windows:generate:syso` tasks then write
that version into the *packaged* bundle/exe, leaving the committed files
untouched so custom keys (e.g. the Sparkle `SUPublicEDKey`) survive.
Do not run `wails3 update build-assets` without re-applying those custom
keys — it regenerates the plists from the templates and overwrites them.

## Windows

The `windows` directory contains the manifest, icon and NSIS/MSIX packaging
files used by the `wails3` build and packaging tasks.

- `icon.ico` - The application icon.
- `info.json` - Application details used for Windows builds.
- `wails.exe.manifest` - The application manifest.
- `nsis/` - NSIS installer template used by `wails3 task package`.

## Linux

The `linux` directory contains the desktop entry, AppImage script and nfpm
(debian/rpm/aur) packaging configuration used by the `wails3` build tasks.
