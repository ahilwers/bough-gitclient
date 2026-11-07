# Bough — Release Build & Publishing on GitHub

This document explains the complete workflow to build Bough for **macOS, Windows and Linux**, add
**code-signing / notarization**, and publish it as a **GitHub Release** — so that users can open the
app **without the operating system complaining**.

> A short summary of the "OS complains" issue is in
> ["What prevents the warnings?"](#what-prevents-the-warnings).

---

## 1. Overview

| Platform | Format | Warning without signing | Required for "warning-free" | Cost |
|---|---|---|---|---|
| macOS | `.dmg` | "unidentified developer" / Gatekeeper | Apple Developer ID + **notarization** | $99/year (Apple) |
| Windows | `.exe` (NSIS) | SmartScreen "Unknown publisher" | Sign with an **Authenticode/EV certificate** | ~$90–400/year (CA) |
| Linux | `.AppImage` | none | nothing | — |

The CI workflow (`.github/workflows/release.yml`) always builds all three platforms.
If the signing secrets are not set, it ships the artifact **unsigned** instead.

---

## 2. Prerequisites (one-time)

- The repository is public on GitHub (`origin` → `ahilwers/bough-gitclient`).
- Note: the build runs in **GitHub Actions** (a macOS runner, a Windows runner, a Linux runner).
  You do **not** need a local toolchain for Windows/Linux.

---

## 3. What prevents the warnings?

### macOS — your decisive case
For the app to open **without** "right-click → Open" or **without** going through
*System Settings → Privacy & Security → Open Anyway*, you need three mandatory things:

1. **Apple Developer Program** (paid): `https://developer.apple.com`
2. A **Developer ID Application certificate** (for signing).
3. **Notarization** by Apple (malware scan + a stamp from the system).

Without these three steps, **macOS can never** treat the app as trusted — no matter what you change
in the code. It is not an app setting; **Apple must machine-sign and inspect the app**.

### Windows
SmartScreen flags unsigned installers as "Unknown publisher". Only a **code-signing certificate**
issued by a certificate authority (ideally an **EV** certificate) removes that.

### Linux
No signing required. AppImages run directly. (Caveat: if a user lacks FUSE2, run
`Bough.AppImage --appimage-extract-and-run`.)

---

## 4. Step by step

### 4.1 Apple Developer ID (macOS)

1. Create a **Developer ID Application certificate** in `developer.apple.com`.
   - Xcode → Preferences → Accounts → *Manage Certificates* → **+** → "Developer ID Application".
2. Export it as a `.p12` (Xcode → Keychain → right-click → Export).
   - Set an **export password**.
3. Note the certificate **identity string**, e.g. `Developer ID Application: Achim Hilwers (TEAMID123)`.

For **notarization** (App Store Connect API key):
1. `https://appstoreconnect.apple.com/access/api` → **Keys** → **+**.
2. Create an **App Store Connect API** (Developer) key → download the `.p8` file.
3. Note the **Key ID** and **Issuer ID**.
4. Your **Team ID** is on `developer.apple.com/account` (top-right).

### 4.2 Windows code-signing certificate
- Buy an EV or standard **Authenticode certificate** from a CA (e.g. DigiCert, Sectigo, SSL.com).
- Export it as a `.pfx` (including password).
- **Important for the workflow:** Bough uses a Wails NSIS installer. So the
  `Bough-amd64-installer.exe` is signed, **not** just the raw `.exe` binary.

---

## 5. Configure GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Purpose | Highly recommended |
|---|---|---|
| `APPLE_CERTIFICATE` | base64 of the `.p12` (Developer ID) | yes (otherwise no macOS signing) |
| `APPLE_CERTIFICATE_PASSWORD` | password of the `.p12` | yes |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Achim Hilwers (TEAMID)` | yes |
| `APPLE_API_KEY` | contents of the `.p8` file (notarization) | yes (keeps Gatekeeper away) |
| `APPLE_API_KEY_ID` | App Store Connect API key ID | yes |
| `APPLE_API_ISSUER` | Issuer ID | yes |
| `APPLE_TEAM_ID` | Team ID | yes |
| `SIGN_CERTIFICATE` | base64 of your Windows `.pfx` | optional |
| `SIGN_PASSWORD` | password of the `.pfx` | optional |
| `SPARKLE_PUBLIC_KEY` | base64 EdDSA public key (auto-update) | optional |
| `SPARKLE_PRIVATE_KEY` | contents of `sparkle_key` (auto-update/appcast) | optional |

### Create base64 for secrets (macOS/Linux)
```bash
base64 -i path/to/cert.p12   # for APPLE_CERTIFICATE / SIGN_CERTIFICATE
cat path/to/authkey.p8       # paste the contents directly as APPLE_API_KEY
```

---

## 6. Sparkle key (for auto-update — optional)

If you want to enable the auto-update feature (Sparkle/appcast):

```bash
# Generate an EdDSA key locally (do NOT commit it!)
./scripts/generate_keys.sh .secrets
```

- **`SPARKLE_PRIVATE_KEY`** = contents of `.secrets/sparkle_key` → add as a secret.
- **`SPARKLE_PUBLIC_KEY`** = the base64 "Public key" from the script output → add as a secret and
  insert into `app/build/darwin/Info.plist` (`SUPublicEDKey`).
- The appcast XML is pushed to the `gh-pages` branch by the workflow and needs web hosting at
  `https://updates.bough.app/appcast.xml` before Sparkle can fetch it.
  **This is optional** and does not block the release when the key is missing.

---

## 7. Build & publish a release

1. **Commit the workflow** and push to `main`:
   ```bash
   git add .github/workflows/release.yml
   git commit -m "ci: add release workflow"
   git push
   ```
2. **Create a version tag** and push it — this triggers the release:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. Watch the progress in **GitHub → Actions → Release**.
   - When the build finishes, you will find the files under **Releases**.

The workflow produces these artifacts:
```
Bough-v0.1.0-macos-intel.dmg
Bough-v0.1.0-macos-arm64.dmg
Bough-v0.1.0-windows-x64.exe
Bough-v0.1.0-linux-x86_64.AppImage
```

---

## 8. Verify that "nothing complains"

| Platform | Test |
|---|---|
| macOS | Start the app normally by double-clicking it from the `.dmg` — no Gatekeeper message. Check: `spctl -a -vv Bough.app`, `codesign --verify --deep --strict Bough.app` |
| Windows | Start the installer; SmartScreen shows **no** "Unknown" warning. |
| Linux | `./Bough-v0.1.0-linux-x86_64.AppImage` launches. |

---

## 9. Common issues

- **Old `.p12`/app-specific password:** Notarization here uses an **API key** (not an app-specific
  password). Apple has phased out the app-specific-password variant in favor of API keys.
- **Secrets missing:** The build then continues without signing (the warning remains on macOS/Windows).
  Set the secrets and tag again — a new release will be created.
- **`Bough.app`: "not verified" despite signing:** This only happens when **notarization**
  (`APPLE_API_KEY*` + `APPLE_TEAM_ID`) is missing or failed. `stapler staple` attaches the
  notarization **stamp** required to lift the warning.
- **macOS runners:** Intel builds use `macos-15-intel` (the last remaining Intel label,
  valid until ~Aug 2027) and Apple Silicon uses `macos-latest`. If GitHub changes/retires these,
  update the names in `.github/workflows/release.yml` accordingly.

---

## 10. Quick checklist before the first public release

- [ ] Repository is (or will be) public
- [ ] Apple Developer account + Developer ID certificate + API key present
- [ ] All `APPLE_*` secrets set
- [ ] `npm ci` + `npm run build` green locally (frontend)
- [ ] `cd app && go tool wails build` green locally
- [ ] Tag `v0.1.0` created and pushed
- [ ] Release files under GitHub Releases
- [ ] macOS app opens without a warning (tested)