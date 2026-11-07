# AI commit messages — MVP

Implemented in `app/ai.go` and the Changes view's `AICommitAssistant`.

## Usage

1. Stage the changes to describe.
2. Open **AI settings** beside the commit input.
3. Select OpenRouter or OpenAI compatible, configure the API base URL and model ID, supply your own API key, and save.
4. Review the privacy notice, then choose **Generate with AI**.
5. Review the subject/body preview. **Replace input with suggestion** is the only action that changes the existing input. Dismiss leaves it untouched. Commit remains a separate, manual action.

No settings panel existed previously; settings use the same inline panel, token colors, inputs and buttons as the Changes view.

## Data and security

- Only `git diff --cached` is sent, not unstaged/untracked content, repository location, history, or existing message input. External diff and textconv are disabled.
- Diff contents and paths can still contain secrets. The privacy notice asks users to review them first. There is no automatic secret detection.
- Input is bounded at 512 KiB; oversized diffs fail rather than silently truncate. Larger diffs may incur higher costs or exceed a model's context window. Requests have a 45-second overall deadline and 40-second HTTP timeout; responses are bounded at 32 KiB / 8,000 message bytes.
- HTTPS is required except localhost HTTP. HTTP redirects are rejected to avoid credential forwarding.
- API keys use `github.com/zalando/go-keyring` (macOS Keychain, Windows Credential Manager, Linux Secret Service). There is no plaintext fallback. Linux requires an available/unlocked Secret Service session.
- Credentials are scoped to the exact normalized endpoint URL. A new endpoint needs its own saved key. Blank key preserves existing; removal is explicit. Keys never return to the webview or enter settings JSON, localStorage, logs, or error messages.
- Non-secret settings are atomically saved in the platform user configuration directory under `Bough/ai.json`.
- AI output is untrusted plain text, never executed. The request instructs the model to ignore instructions in diffs.

## Verification

- Frontend production build: passed.
- Wails production build: passed on macOS ARM64 (existing deployment-target linker warning).
- `go test -race -cover ./...`: passed, including mock HTTP responses/errors, input/output bounds, cancellation, endpoint validation and real temporary-repository staged-only isolation.
- Frontend: 14 test files, 116 tests passed, including preview/apply isolation, staged gating and key settings behavior.

## Remaining manual verification

- Live paid provider calls and OS keychain prompts were not exercised.
- Windows/Linux keychain integration, cross-platform packaging and large-repository interactive checks remain unverified.
- No streaming, automatic model discovery, retry, manual cancellation, or secret scanner in this MVP.
- A preview reflects the staged snapshot at Generate time; review again if staging changes before applying/committing. Repository/worktree switches discard the assistant's UI state.
