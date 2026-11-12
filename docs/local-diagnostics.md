# Local Git failure diagnostics

GitMorrow offers a Details link on Git failure notifications and inline errors. The scrollable dialog explains the operation, exit code and category, offers a safe summary, and opens the local log folder. Diagnostic settings are also accessible through the toolbar settings icon.

Logging defaults to enabled. Disabling it persists across restarts. The log is local only; nothing is uploaded. Only these four fields are written: UTC timestamp, fixed operation enum, integer exit code and fixed category enum. Unknown categories remain generic. Arguments, URLs, environment variables, paths, arbitrary messages and Git output are not log fields. Classification is not a promise to redact arbitrary secrets.

Wails marshaling captures safe metadata but does **not** itself write a record: a returned IPC error can still be swallowed or retried. The notification or inline error component acknowledges actual display, and the backend records that diagnostic at most once. Internal probes, successful operations, strategy-choice handling and swallowed retries do not generate records. Pull conflicts retain their existing result-based control flow and are acknowledged like other displayed failures.

Raw output is bounded to 64 KiB per failure and retained only in backend memory, for at most ten recent failures and five minutes. Expiration also runs while idle. Raw output never enters a rejected IPC message, React Query cache, Zustand state or frontend devtools. After a separate warning and explicit confirmation, a backend-only method copies it directly to the native clipboard, consuming the retained output. Clipboard managers and other applications may retain the user's copy. Safe summaries contain metadata only.

## Storage and protection

- Linux: absolute `XDG_STATE_HOME` followed by `gitmorrow/logs/agent.log`; otherwise `~/.local/state/gitmorrow/logs/agent.log`.
- macOS: `~/Library/Logs/GitMorrow/agent.log`.
- Windows: `%LOCALAPPDATA%\GitMorrow\Logs\agent.log`; absent or non-absolute LOCALAPPDATA disables logging, without another fallback.

The active log plus four archives are each limited to 2 MiB. Empty control files hold the persistent disable setting and an exclusive writer lock; they contain no diagnostic content and are not additional log archives. A second process cannot concurrently bypass rotation bounds. Existing oversized files cause logging to fail closed rather than become oversized archives.

Directory traversal uses rooted handles and rejects symbolic links. Files are checked for regular-file type and hard links. POSIX storage requires current-user ownership, directory mode 0700 and file mode 0600. Windows protection uses an explicit protected DACL with full access only for the current user, SYSTEM and Administrators, then verifies owner, protection, ACE types, rights and principals. Reparse points and multi-link files are rejected. Failure to establish or verify protection disables logging; the settings dialog displays a safe reason and the app continues.

## Verification

Local Linux verification covers race-enabled Git/internal package tests, enum-only persistence, rotation, link refusal, permissions, settings, bounded/expiring raw storage, display acknowledgement, modal copy warning and notification/inline links. Frontend Vitest and production builds are separate gates. Windows-specific ACL tests are included, but cross-compiling their executable is not live Windows verification. Run `go test -race ./internal/diagnostics` on Windows before release. Full Wails integration and native clipboard/folder behavior still need platform runtime checks; Linux GUI builds require GTK4 and WebKitGTK 6 development packages.
