# Code signing policy

Bough ships its Windows build as an NSIS installer, `Bough-<version>-windows-x64.exe`. This document
describes which artifacts are signed, how they are built, who approves a signing request, and how
users can verify a released binary.

> **Status:** Bough is applying to the [SignPath Foundation](https://signpath.org/) for free
> open-source code signing. Until that application is approved, Windows installers are published
> **unsigned** — see [Installing an unsigned build](#installing-an-unsigned-build).

Free code signing provided by [SignPath.io](https://signpath.io), certificate by
[SignPath Foundation](https://signpath.org).

## What is signed

- Only the Windows installer produced by the release workflow
  ([`.github/workflows/release.yml`](.github/workflows/release.yml)) for a version tag (`v*.*.*`)
  pushed to this repository.
- The artifact is built on **GitHub-hosted runners** from the tagged commit by a **public** GitHub
  Actions workflow. No artifact built anywhere else — not on a maintainer's machine, not in a fork,
  not by a third party — is ever submitted for signing.
- The installer is signed as a whole (Authenticode, SHA-256, timestamped by a public timestamp
  authority), so the signature stays valid after the certificate expires.

Nothing else is signed: macOS builds are signed and notarized separately with an Apple Developer ID
(see [`RELEASE.md`](RELEASE.md)), and Linux AppImages are not signed.

## Team and roles

Bough is maintained by a single person, so all signing-related roles are held by the same
maintainer:

| Role | Who | Responsibility |
|---|---|---|
| Author / committer | Achim Hilwers | Writes code, owns the repository |
| Reviewer | Achim Hilwers | Reviews every change that arrives as a pull request before it is merged |
| Release approver | Achim Hilwers | Manually approves each signing request in the SignPath dashboard |

- Multi-factor authentication is enabled on both the GitHub account and the SignPath account.
- Changes to build scripts and workflow files are treated with the same scrutiny as application
  code: they are committed to the public repository and are part of the reviewed history.
- Every signing request is approved by hand for the specific release it belongs to. A green CI run
  alone does not sign anything.

## Build provenance

Every release can be traced back to its source:

1. The release tag (`v*.*.*`) and the workflow run URL are linked from the GitHub Release page.
2. The workflow checks out exactly that tag (`actions/checkout` with `fetch-depth: 0`), so the
   artifact is built from a commit whose SHA is public.
3. Anyone can rebuild the same installer from source — see the build instructions in
   [`README.md`](README.md) and [`RELEASE.md`](RELEASE.md).
4. The released installer and its SHA-256 checksum are published together (`SHA256SUMS` in every
   release).

SignPath verifies this provenance independently: the signing request carries GitHub-provided origin
metadata (workflow, commit, artifact), and all jobs leading up to the request run on GitHub-hosted
agents.

## How to verify a signature

On Windows, with the installer downloaded:

```powershell
Get-AuthenticodeSignature .\Bough-v0.1.0-windows-x64.exe | Format-List Status, SignerCertificate
```

or, with the Windows SDK installed:

```bat
signtool verify /pa /v Bough-v0.1.0-windows-x64.exe
```

The status must be `Valid`. You can also check the file's properties in Explorer → *Digital
Signatures*. Compare the SHA-256 against `SHA256SUMS` from the same release to confirm the download
is intact.

## Privacy

Bough contains **no telemetry, no analytics, and no crash reporting**. It does not contact any
service unless you ask it to:

- **Update check** — when the app checks for a new version it fetches the appcast file from
  `updates.bough.app`. The request carries only a user agent containing the app version and
  platform; no identifiers, no repository data.
- **AI-assisted commit messages** — disabled by default and only used when you trigger it. Bough
  then sends the staged diff to the API endpoint *you* configured (default:
  `https://openrouter.ai/api/v1`) with *your* API key, which is stored in the operating system's
  credential store (Keychain, Credential Manager, Secret Service) — never in the app's config file
  and never in the webview.
- **Git operations** — reads and writes happen locally. Pushing and fetching talk to the remote you
  configured, exactly as the `git` CLI would.

No repository content is transferred anywhere unless you explicitly trigger one of the two actions
above.

## System changes and uninstallation

- The installer installs Bough for the current user (or for all users, if you choose elevation) and
  registers a standard uninstaller. It adds no services, drivers, or background agents.
- Uninstall via *Settings → Apps → Bough → Uninstall*, or via `uninstall.exe` in the installation
  directory. Uninstalling removes the application; your Git repositories, credentials, and settings
  are untouched.

## Installing an unsigned build

While the SignPath application is in review, the Windows installer is unsigned. Windows will show
**"Windows protected your PC"** the first time you run it:

1. Click **More info**.
2. Click **Run anyway**.

The installer is still built by the public CI workflow described above. Verify it against the
`SHA256SUMS` file published with the same release (`Get-FileHash .\Bough-*.exe -Algorithm SHA256`)
before running it.

## Contact

Questions about signing, or a report of a build that appears to be signed but was not produced by
this repository: open an issue at
<https://github.com/ahilwers/bough-gitclient/issues>.
