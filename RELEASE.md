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
| Windows | `.exe` (NSIS) | SmartScreen "Unknown publisher" | Authenticode signature: SignPath Foundation (free for OSS) or a paid OV certificate | 0 € (SignPath) / ~$10–300/year (CA) |
| Linux | `.AppImage` | none | nothing | — |

The CI workflow (`.github/workflows/release.yml`) always builds all three platforms.
If the signing secrets are not set, it ships the artifact **unsigned** instead.

Windows has two signing paths in the workflow, in this order of precedence:

1. **SignPath Foundation** (free for open-source projects) — used when `SIGNPATH_API_TOKEN` and the
   `SIGNPATH_ORGANIZATION_ID` repository variable are set.
2. **PFX certificate** — used when `SIGN_CERTIFICATE`/`SIGN_PASSWORD` are set (paid CA certificate).

With neither, the installer is published unsigned and the workflow emits a warning annotation.

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
SmartScreen flags unsigned installers as "Unknown publisher". A **code-signing certificate from a
CA** removes that message; whether the SmartScreen *warning* also disappears depends on the
certificate's accumulated reputation.

Since Microsoft removed the EV-specific OIDs from the Trusted Root Program in 2024, **no certificate
type grants instant SmartScreen trust anymore** — including EV. Reputation accrues per publisher over
consecutive releases, so the important thing is to sign every release with the same identity.

The cheapest options:

| Option | Cost | Notes |
|---|---|---|
| **SignPath Foundation** | 0 € | Free for OSI-licensed OSS; certificate is issued to *SignPath Foundation* (they become the listed publisher). No token, no Windows machine — signing happens in CI. Requires MFA, a published [code signing policy](CODE_SIGNING.md), and a manual approval per release. |
| Azure Trusted Signing | ~$10/month | Organizations only, in US/CA/EU/UK with 3 years of verifiable business history; individuals only in US/CA. Not usable by an individual in the EU. |
| Certum Open Source | ~58 $/year (cloud) or 69 € (card + reader) | Certificate in your own name ("Open Source Developer …"). Cloud variant needs the SimplySign app and a phone confirmation per signing session, which does not fit an unattended CI pipeline; the card variant needs a Windows machine with a card reader for activation. |
| OV certificate (DigiCert, Sectigo, …) | ~$150–300/year | Traditional route, hardware token or cloud HSM required by the CA/Browser Forum. |

A self-signed certificate does **not** help for public distribution — Windows does not trust it.

For Bough, **SignPath Foundation** is the intended path; see
[§4.2](#42-windows-code-signing) for onboarding and [`CODE_SIGNING.md`](CODE_SIGNING.md) for the
public policy page it requires.

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

### 4.2 Windows code signing

Bough uses a Wails NSIS installer, so the `Bough-amd64-installer.exe` is signed — not just the raw
`.exe` binary inside it.

#### Option A — SignPath Foundation (free, recommended)

1. **Apply** at <https://signpath.org/apply> with: project name, repository URL, license
   (GPL-3.0-or-later), a short description, evidence of activity (release history), and the CI
   system (GitHub Actions, link to the release workflow). Mention
   [`CODE_SIGNING.md`](CODE_SIGNING.md) — the policy page the Foundation requires.
2. **Enable MFA** on the GitHub account (Settings → Password and authentication) and on the SignPath
   account once it exists. This is a hard requirement.
3. After acceptance, in the SignPath dashboard create:
   - a **project** with the GitHub.com trusted build system linked (install the SignPath GitHub App on
     the repository — the connector needs it for origin verification and the audit log),
   - a **signing policy** (e.g. `release-signing`) that requires manual approval,
   - an **artifact configuration** (e.g. `nsis-installer`) with a root element of type *ZIP* that
     contains `Bough-amd64-installer.exe` as the single `<pe-file>` to sign. `actions/upload-artifact`
     always wraps uploads in a ZIP, which is why the root element is a ZIP and not a file.
4. Create an **API token** for the project and store the settings on GitHub:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `SIGNPATH_API_TOKEN` | API token from the SignPath dashboard |
   | Variable | `SIGNPATH_ORGANIZATION_ID` | Organization ID (required — enables the path) |
   | Variable | `SIGNPATH_PROJECT_SLUG` | optional, defaults to `bough-gitclient` |
   | Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | optional, defaults to `release-signing` |
   | Variable | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | optional, defaults to `nsis-installer` |

5. The release workflow then uploads the unsigned installer as a workflow artifact, submits the
   signing request, waits for it, and writes the signed installer back to `app/bin`. **Each release
   needs one manual approval click** in the SignPath dashboard — the workflow waits for it (10 min
   default timeout; raise `wait-for-completion-timeout-in-seconds` if you need longer).
   If the artifact configuration declares parameters (e.g. `version` for the signature description),
   pass them via a `parameters:` block on the `signpath/github-action-submit-signing-request` step;
   the workflow deliberately omits it, because unknown parameters make the request fail.

#### Option B — Your own PFX certificate

- Buy an OV (or EV) Authenticode certificate from a CA (DigiCert, Sectigo, SSL.com, Certum).
- Export it as a `.pfx` including the password, `base64` it, and store it as `SIGN_CERTIFICATE` plus
  `SIGN_PASSWORD` (see §5).
- The workflow signs with `signtool` and a DigiCert timestamp; this path takes precedence over
  SignPath when both are configured.

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
| `SIGN_CERTIFICATE` | base64 of your Windows `.pfx` | optional (alternative to SignPath) |
| `SIGN_PASSWORD` | password of the `.pfx` | optional |
| `SIGNPATH_API_TOKEN` | SignPath API token (Windows signing via the Foundation) | optional |
| `SPARKLE_PUBLIC_KEY` | base64 EdDSA public key (auto-update) | optional |
| `SPARKLE_PRIVATE_KEY` | contents of `sparkle_key` (auto-update/appcast) | optional |

Repository **variables** (Settings → Secrets and variables → Actions → *Variables*) for SignPath:
`SIGNPATH_ORGANIZATION_ID` (required), `SIGNPATH_PROJECT_SLUG`,
`SIGNPATH_SIGNING_POLICY_SLUG`, `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` (all optional, with defaults —
see §4.2).

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
SHA256SUMS
```

`SHA256SUMS` is generated from the published files, so users can verify a download
(`sha256sum -c SHA256SUMS` on Linux/macOS, `Get-FileHash` on Windows). The unsigned installer
uploaded for a SignPath signing request is excluded from the release.

The tag is the single source of truth for the released version: CI passes it to the build as
`VERSION=…`, which the packaging tasks write into the macOS `Info.plist`
(`CFBundleShortVersionString`/`CFBundleVersion`) and the Windows exe version metadata, in addition
to embedding it in the binary (`-X main.version`). The values committed under `app/build/` are only
placeholders for development builds.

---

## 8. Verify that "nothing complains"

| Platform | Test |
|---|---|
| macOS | Start the app normally by double-clicking it from the `.dmg` — no Gatekeeper message. Check: `spctl -a -vv Bough.app`, `codesign --verify --deep --strict Bough.app` |
| Windows | `Get-AuthenticodeSignature .\Bough-v0.1.0-windows-x64.exe` → `Status: Valid`; then run the installer and confirm SmartScreen shows no *"Unknown publisher"*. Note: on a fresh signature the *"Windows protected your PC"* screen can still appear until the publisher has accumulated reputation. |
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
- **SignPath step fails with "artifact not found" / timeout:** check that the `upload-artifact` step
  before it succeeded, that `SIGNPATH_ORGANIZATION_ID` is set (otherwise the step is skipped
  entirely), and that the artifact configuration in the dashboard matches the uploaded file. The
  signing request itself also waits for the manual approval — a workflow that looks stuck is usually
  waiting for that click.
- **SignPath signs a ZIP instead of the `.exe`:** `actions/upload-artifact` always uploads a ZIP, so
  the artifact configuration needs a ZIP root element with `<pe-file>` entries for the files inside.
  The action extracts the signed ZIP into `output-artifact-directory` by default
  (`skip-decompress: false`).
- **Windows installer signed but SmartScreen still warns:** expected for a new publisher identity.
  Reputation builds per publisher over releases; signed-but-new is still better than unsigned (no
  "Unknown publisher", no enterprise blocklist on the hash).
- **macOS runners:** Intel builds use `macos-15-intel` (the last remaining Intel label,
  valid until ~Aug 2027) and Apple Silicon uses `macos-latest`. If GitHub changes/retires these,
  update the names in `.github/workflows/release.yml` accordingly.

---

## 10. Quick checklist before the first public release

- [ ] Repository is (or will be) public
- [ ] Apple Developer account + Developer ID certificate + API key present
- [ ] All `APPLE_*` secrets set
- [ ] SignPath Foundation application submitted; `SIGNPATH_API_TOKEN` secret + `SIGNPATH_ORGANIZATION_ID` variable set after acceptance
- [ ] Code signing policy page published ([`CODE_SIGNING.md`](CODE_SIGNING.md)) and linked from the README
- [ ] MFA enabled on GitHub (and on SignPath)
- [ ] `npm ci` + `npm run build` green locally (frontend)
- [ ] `cd app && go tool wails3 build` green locally
- [ ] Tag `v0.1.0` created and pushed
- [ ] Release files under GitHub Releases, including `SHA256SUMS`
- [ ] macOS app opens without a warning (tested)
- [ ] Windows installer signature verified with `Get-AuthenticodeSignature`