# Bough – Plan 09: Licensing & Trial

**Phase:** 3 (Weeks 15–22, parallel with other Phase 3 work)
**Prerequisite:** `01-setup.md` complete
**Goal:** Implement a 30-day free trial with one-time purchase activation. No subscription, no server dependency for day-to-day use.

---

## 1. Model Overview

| Aspect | Decision |
|---|---|
| Purchase model | One-time purchase (perpetual license) |
| Trial period | 30 days from first launch |
| Trial restrictions | Full functionality — no feature gating during trial |
| After trial expires | Read-only mode (can view repos/history, cannot commit/push/pull) |
| License format | Ed25519-signed license key (offline validation) |
| License storage | OS Keychain (macOS: `security`, Windows: DPAPI, Linux: Secret Service) |
| License server | Required only once: a single revocation check ~130 days after activation |
| Multi-seat | 1 license = 2 activations (e.g. work + personal machine) |

---

## 2. File Structure

```
license/
├── license.go        ← Core validation logic
├── store.go          ← OS keychain read/write
├── trial.go          ← Trial start date storage and expiry check
└── types.go          ← LicenseState struct
```

---

## 3. Data Types (`license/types.go`)

```go
package license

import "time"

// LicenseStatus summarises the current license state for the frontend.
type LicenseStatus struct {
    State       string    `json:"state"`       // "trial" | "active" | "expired" | "invalid"
    DaysLeft    int       `json:"daysLeft"`    // days remaining in trial (0 if not in trial)
    LicenseKey  string    `json:"licenseKey"`  // masked key, e.g. "BOUGH-XXXX-****-****"
    ActivatedAt time.Time `json:"activatedAt"` // zero if not activated
    Email       string    `json:"email"`       // registered email (from activation)
}
```

---

## 4. Trial Management (`license/trial.go`)

The trial start date is stored on first launch. We record it in a small JSON file in the OS config dir so it survives app updates.

```go
package license

import (
    "encoding/json"
    "os"
    "path/filepath"
    "time"
)

const trialDuration = 30 * 24 * time.Hour

type trialRecord struct {
    StartedAt time.Time `json:"startedAt"`
}

func trialFilePath() (string, error) {
    dir, err := os.UserConfigDir() // ~/.config on Linux, ~/Library/Application Support on macOS
    if err != nil {
        return "", err
    }
    return filepath.Join(dir, "Bough", "trial.json"), nil
}

// EnsureTrialStarted records the trial start date if not already set.
// Call once on first launch.
func EnsureTrialStarted() error {
    path, err := trialFilePath()
    if err != nil {
        return err
    }
    if _, err := os.Stat(path); err == nil {
        return nil // already recorded
    }
    _ = os.MkdirAll(filepath.Dir(path), 0700)
    data, _ := json.Marshal(trialRecord{StartedAt: time.Now()})
    return os.WriteFile(path, data, 0600)
}

// TrialDaysLeft returns the number of full days remaining in the trial.
// Returns 0 if the trial has expired or was never started.
func TrialDaysLeft() int {
    path, err := trialFilePath()
    if err != nil {
        return 0
    }
    data, err := os.ReadFile(path)
    if err != nil {
        return 0
    }
    var rec trialRecord
    if err := json.Unmarshal(data, &rec); err != nil {
        return 0
    }
    remaining := time.Until(rec.StartedAt.Add(trialDuration))
    if remaining <= 0 {
        return 0
    }
    return int(remaining.Hours() / 24)
}
```

---

## 5. License Validation (`license/license.go`)

License keys are Ed25519-signed tokens. Validation happens entirely offline — no network call needed after activation.

### Key Format

A Bough license key is a base32-encoded Ed25519 signature over a payload string:

```
Payload:  "<email>\n<edition>\n<expiry-YYYY-MM-DD>"
Key:      "BOUGH-<base32(payload[:8])>-<base32(sig[:6])>-<base32(sig[6:12])>-<base32(sig[12:18])>"
```

For a perpetual (no-expiry) license the expiry field is `"perpetual"`.

### Validation

```go
package license

import (
    "crypto/ed25519"
    _ "embed"
    "encoding/base32"
    "errors"
    "strings"
    "time"
)

// publicKey is embedded at build time (never the private key).
//go:embed public.key
var publicKeyBytes []byte

var (
    ErrInvalidFormat  = errors.New("invalid license key format")
    ErrInvalidSig     = errors.New("license signature verification failed")
    ErrExpiredLicense = errors.New("license has expired")
)

type LicensePayload struct {
    Email   string
    Edition string    // "indie" | "pro" | "team"
    Expiry  time.Time // zero value = perpetual
}

// Validate parses and cryptographically verifies a license key.
// Returns the decoded payload if valid.
func Validate(key string) (*LicensePayload, error) {
    parts := strings.Split(key, "-")
    if len(parts) != 5 || parts[0] != "BOUGH" {
        return nil, ErrInvalidFormat
    }

    b32 := base32.StdEncoding.WithPadding(base32.NoPadding)

    payloadPart, err := b32.DecodeString(parts[1])
    if err != nil {
        return nil, ErrInvalidFormat
    }
    sigPart1, _ := b32.DecodeString(parts[2])
    sigPart2, _ := b32.DecodeString(parts[3])
    sigPart3, _ := b32.DecodeString(parts[4])

    sig := append(append(sigPart1, sigPart2...), sigPart3...)
    _ = payloadPart // used to locate matching payload in sig

    // The full payload is stored in the license record retrieved from the store.
    // Here we just verify that the signature is valid for the stored payload.
    stored, err := loadStoredLicense()
    if err != nil {
        return nil, err
    }

    pubKey := ed25519.PublicKey(publicKeyBytes)
    if !ed25519.Verify(pubKey, []byte(stored.rawPayload), sig) {
        return nil, ErrInvalidSig
    }

    if !stored.Expiry.IsZero() && time.Now().After(stored.Expiry) {
        return nil, ErrExpiredLicense
    }

    return &stored.LicensePayload, nil
}
```

---

## 6. OS Keychain Storage (`license/store.go`)

Store and retrieve the activated license key from the OS keychain so it survives reinstalls.

```go
package license

import (
    "fmt"
    "os/exec"
    "runtime"
    "strings"
)

const keychainService = "Bough"
const keychainAccount = "license"

// SaveLicense stores the license key in the OS keychain.
func SaveLicense(key string) error {
    switch runtime.GOOS {
    case "darwin":
        // Delete old entry first (ignore error if not present)
        exec.Command("security", "delete-generic-password",
            "-s", keychainService, "-a", keychainAccount).Run()
        cmd := exec.Command("security", "add-generic-password",
            "-s", keychainService, "-a", keychainAccount, "-w", key)
        if out, err := cmd.CombinedOutput(); err != nil {
            return fmt.Errorf("keychain save: %w\n%s", err, out)
        }
        return nil
    case "windows":
        // Use cmdkey.exe for Windows Credential Manager
        cmd := exec.Command("cmdkey",
            fmt.Sprintf("/generic:%s", keychainService),
            fmt.Sprintf("/user:%s", keychainAccount),
            fmt.Sprintf("/pass:%s", key))
        if out, err := cmd.CombinedOutput(); err != nil {
            return fmt.Errorf("credential manager save: %w\n%s", err, out)
        }
        return nil
    default: // Linux — use secret-tool (libsecret)
        cmd := exec.Command("secret-tool", "store",
            "--label", "Bough License",
            "service", keychainService,
            "account", keychainAccount)
        cmd.Stdin = strings.NewReader(key)
        if out, err := cmd.CombinedOutput(); err != nil {
            // Fall back to config-file storage if secret-tool unavailable
            return saveLicenseToFile(key)
        }
        _ = out
        return nil
    }
}

// LoadLicense retrieves the license key from the OS keychain.
func LoadLicense() (string, error) {
    switch runtime.GOOS {
    case "darwin":
        out, err := exec.Command("security", "find-generic-password",
            "-s", keychainService, "-a", keychainAccount, "-w").Output()
        if err != nil {
            return "", nil // not found = no license
        }
        return strings.TrimSpace(string(out)), nil
    case "windows":
        // Windows doesn't have a simple cmdkey /get; use a helper or the Go wincred library
        // For now, fall back to file storage (TODO: replace with wincred CGo binding)
        return loadLicenseFromFile()
    default: // Linux
        out, err := exec.Command("secret-tool", "lookup",
            "service", keychainService,
            "account", keychainAccount).Output()
        if err != nil {
            return loadLicenseFromFile()
        }
        return strings.TrimSpace(string(out)), nil
    }
}
```

---

## 7. License State Check (`license/license.go` — continued)

```go
// GetStatus returns the current LicenseStatus for the frontend.
// This is the single function the rest of the app calls.
func GetStatus() LicenseStatus {
    key, err := LoadLicense()
    if err == nil && key != "" {
        payload, err := Validate(key)
        if err == nil {
            masked := maskKey(key)
            return LicenseStatus{
                State:      "active",
                LicenseKey: masked,
                Email:      payload.Email,
            }
        }
        if errors.Is(err, ErrExpiredLicense) {
            return LicenseStatus{State: "expired"}
        }
        return LicenseStatus{State: "invalid"}
    }

    // No valid license — check trial
    days := TrialDaysLeft()
    if days > 0 {
        return LicenseStatus{State: "trial", DaysLeft: days}
    }
    return LicenseStatus{State: "expired", DaysLeft: 0}
}

func maskKey(key string) string {
    parts := strings.Split(key, "-")
    if len(parts) != 5 {
        return key
    }
    return strings.Join([]string{parts[0], parts[1], "****", "****", "****"}, "-")
}
```

---

## 8. Wiring into `app.go`

```go
import licensepkg "bough/license"

func (a *App) startup(ctx context.Context) {
    // ... existing startup code ...
    _ = licensepkg.EnsureTrialStarted()
}

// GetLicenseStatus is called by the frontend on load and after activation.
func (a *App) GetLicenseStatus() licensepkg.LicenseStatus {
    return licensepkg.GetStatus()
}

// ActivateLicense stores and validates a license key entered by the user.
func (a *App) ActivateLicense(key string) (licensepkg.LicenseStatus, error) {
    // Validate before storing
    _, err := licensepkg.Validate(key)
    if err != nil {
        return licensepkg.LicenseStatus{State: "invalid"}, err
    }
    if err := licensepkg.SaveLicense(key); err != nil {
        return licensepkg.LicenseStatus{}, err
    }
    return licensepkg.GetStatus(), nil
}
```

---

## 9. Read-Only Mode Enforcement

When `LicenseStatus.State` is `"expired"`, Bough enters read-only mode:

**Go side:** The following `app.go` methods return an error when called in expired state:
- `CreateCommit`, `AmendCommit`
- `Push`, `Pull`, `Fetch`
- `StageFile`, `UnstageFile`, `StageHunk`, `DiscardHunk`

Add a guard at the top of each:

```go
func (a *App) requireLicense() error {
    status := license.GetStatus()
    if status.State == "expired" || status.State == "invalid" {
        return errors.New("license:expired")
    }
    return nil
}

// Example:
func (a *App) CreateCommit(message string) (string, error) {
    if err := a.requireLicense(); err != nil {
        return "", err
    }
    // ... existing logic
}
```

**Frontend side:** TanStack Query's `onError` checks for `"license:expired"` and opens the `LicenseDialog` (in `components/shared/LicenseDialog.tsx`).

Read operations (`GetCommits`, `GetStatus`, `GetCommitDiff`, etc.) are **never** blocked — the user can always browse the repository history.

---

## 10. License Dialog (`components/shared/LicenseDialog.tsx`)

Shows when:
- Trial expires (on next launch after day 30)
- `requireLicense()` rejects a write operation

Contains:
- Trial days remaining banner (while in trial)
- "Buy Bough" button → opens purchase URL in system browser via `runtime.BrowserOpenURL`
- "Enter License Key" input field → calls `ActivateLicense(key)` → updates Zustand store
- "Continue in Read-Only Mode" link (dismisses dialog until next launch)

```typescript
// In gitStore.ts (add to state):
interface GitState {
  // ... existing fields
  licenseStatus: LicenseStatus | null;
}

// On app load (App.tsx useEffect):
const status = await GetLicenseStatus();
useGitStore.setState({ licenseStatus: status });
```

---

## 11. License Server (`licenseserver/`)

The license server lives in `licenseserver/` in the same Git repo as the app. It is a small standalone Go HTTP service deployed separately to Fly.io.

### 11.1 Responsibilities

| Endpoint | Purpose |
|---|---|
| `POST /webhook` | Receives Stripe events, generates + emails license keys |
| `GET /revoked` | Returns signed revocation list for the app to check daily |
| `GET /health` | Uptime / load balancer check |

The **private Ed25519 key** lives only in this server's environment — it is never committed to the repo or embedded in the app binary.

---

### 11.2 Entry Point (`licenseserver/main.go`)

```go
package main

import (
    "log"
    "net/http"
    "os"

    "bough/licenseserver/handler"
    "bough/licenseserver/keygen"
    "bough/licenseserver/mailer"
    "bough/licenseserver/store"
)

func main() {
    db, err := store.Open("bough-licenses.db")
    if err != nil {
        log.Fatalf("db: %v", err)
    }

    kg := keygen.New(mustEnv("PRIVATE_KEY_HEX"))
    ml := mailer.New(mustEnv("RESEND_API_KEY"), mustEnv("FROM_EMAIL"))

    mux := http.NewServeMux()
    mux.HandleFunc("POST /webhook", handler.Webhook(kg, ml, db, mustEnv("STRIPE_WEBHOOK_SECRET")))
    mux.HandleFunc("GET /revoked", handler.Revoked(kg, db))
    mux.HandleFunc("GET /health", handler.Health)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    log.Printf("Listening on :%s", port)
    log.Fatal(http.ListenAndServe(":"+port, mux))
}

func mustEnv(key string) string {
    v := os.Getenv(key)
    if v == "" {
        log.Fatalf("required env var %s is not set", key)
    }
    return v
}
```

---

### 11.3 Stripe Webhook Handler (`licenseserver/handler/webhook.go`)

```go
package handler

import (
    "encoding/json"
    "io"
    "log"
    "net/http"

    "bough/licenseserver/keygen"
    "bough/licenseserver/mailer"
    "bough/licenseserver/store"
    "github.com/stripe/stripe-go/v78"
    "github.com/stripe/stripe-go/v78/webhook"
)

func Webhook(kg *keygen.KeyGen, ml *mailer.Mailer, db *store.DB, secret string) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        body, err := io.ReadAll(io.LimitReader(r.Body, 65536))
        if err != nil {
            http.Error(w, "read error", http.StatusBadRequest)
            return
        }

        // Verify Stripe webhook signature — rejects any fake requests
        event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), secret)
        if err != nil {
            log.Printf("webhook signature invalid: %v", err)
            http.Error(w, "invalid signature", http.StatusBadRequest)
            return
        }

        switch event.Type {

        case "checkout.session.completed":
            // New purchase — generate and send license key
            var session stripe.CheckoutSession
            if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
                http.Error(w, "parse error", http.StatusBadRequest)
                return
            }
            email := session.CustomerDetails.Email
            if email == "" {
                log.Printf("checkout.session.completed: no email in session %s", session.ID)
                w.WriteHeader(http.StatusOK)
                return
            }

            key, err := kg.Generate(email, "indie", "perpetual")
            if err != nil {
                log.Printf("keygen failed for %s: %v", email, err)
                http.Error(w, "keygen error", http.StatusInternalServerError)
                return
            }

            if err := db.SaveIssuedKey(key, email, session.ID); err != nil {
                log.Printf("db.SaveIssuedKey failed: %v", err)
                // Non-fatal: still try to send the email
            }

            if err := ml.SendLicenseKey(email, key); err != nil {
                log.Printf("mailer failed for %s: %v", email, err)
                http.Error(w, "mail error", http.StatusInternalServerError)
                return
            }
            log.Printf("license key sent to %s", email)

        case "charge.refunded":
            // Voluntary refund — revoke the key associated with this charge
            var charge stripe.Charge
            if err := json.Unmarshal(event.Data.Raw, &charge); err == nil {
                if err := db.RevokeByPaymentID(charge.ID); err != nil {
                    log.Printf("revoke on refund failed for charge %s: %v", charge.ID, err)
                }
            }

        case "charge.dispute.created":
            // Chargeback — immediately revoke
            var dispute stripe.Dispute
            if err := json.Unmarshal(event.Data.Raw, &dispute); err == nil {
                if err := db.RevokeByPaymentID(dispute.Charge.ID); err != nil {
                    log.Printf("revoke on dispute failed for charge %s: %v", dispute.Charge.ID, err)
                }
                log.Printf("chargeback received for charge %s — key revoked", dispute.Charge.ID)
            }

        case "charge.dispute.closed":
            // If we won the dispute, un-revoke the key
            var dispute stripe.Dispute
            if err := json.Unmarshal(event.Data.Raw, &dispute); err == nil {
                if dispute.Status == "won" {
                    if err := db.UnrevokeByPaymentID(dispute.Charge.ID); err != nil {
                        log.Printf("unrevoke failed for charge %s: %v", dispute.Charge.ID, err)
                    }
                    log.Printf("dispute won for charge %s — key restored", dispute.Charge.ID)
                }
            }
        }

        w.WriteHeader(http.StatusOK)
    }
}
```

---

### 11.4 Key Generation (`licenseserver/keygen/keygen.go`)

```go
package keygen

import (
    "crypto/ed25519"
    "crypto/sha256"
    "encoding/base32"
    "encoding/hex"
    "fmt"
)

type KeyGen struct {
    privateKey ed25519.PrivateKey
    publicKey  ed25519.PublicKey
}

func New(privateKeyHex string) *KeyGen {
    seed, err := hex.DecodeString(privateKeyHex)
    if err != nil || len(seed) != ed25519.SeedSize {
        panic("PRIVATE_KEY_HEX must be a 64-char hex string (32 bytes Ed25519 seed)")
    }
    priv := ed25519.NewKeyFromSeed(seed)
    return &KeyGen{privateKey: priv, publicKey: priv.Public().(ed25519.PublicKey)}
}

// Generate creates and signs a new license key for the given email/edition/expiry.
func (kg *KeyGen) Generate(email, edition, expiry string) (string, error) {
    payload := fmt.Sprintf("%s\n%s\n%s", email, edition, expiry)
    sig := ed25519.Sign(kg.privateKey, []byte(payload))

    b32 := base32.StdEncoding.WithPadding(base32.NoPadding)

    // Hash the payload to a short prefix so keys for the same email differ per edition
    h := sha256.Sum256([]byte(payload))
    prefix := b32.EncodeToString(h[:5])          // 8 base32 chars

    part1 := b32.EncodeToString(sig[:6])          // 10 chars
    part2 := b32.EncodeToString(sig[6:12])         // 10 chars
    part3 := b32.EncodeToString(sig[12:18])        // 10 chars

    return fmt.Sprintf("BOUGH-%s-%s-%s-%s", prefix, part1, part2, part3), nil
}

// SignRevocationList signs a JSON payload (list of revoked key hashes) so the app
// can verify it wasn't tampered with.
func (kg *KeyGen) SignRevocationList(payload []byte) []byte {
    return ed25519.Sign(kg.privateKey, payload)
}

// PublicKeyBytes returns the public key for embedding in the app binary.
func (kg *KeyGen) PublicKeyBytes() []byte {
    return kg.publicKey
}
```

---

### 11.5 Revocation List Endpoint (`licenseserver/handler/revoked.go`)

```go
package handler

import (
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "net/http"
    "time"

    "bough/licenseserver/keygen"
    "bough/licenseserver/store"
)

type revocationResponse struct {
    IssuedAt int64    `json:"issuedAt"` // Unix timestamp
    Revoked  []string `json:"revoked"`  // SHA-256 hashes of revoked keys (hex)
    Sig      string   `json:"sig"`      // Ed25519 signature over JSON(issuedAt+revoked) in hex
}

func Revoked(kg *keygen.KeyGen, db *store.DB) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        keys, err := db.GetRevokedKeys()
        if err != nil {
            http.Error(w, "db error", http.StatusInternalServerError)
            return
        }

        // Store hashes of keys, not the keys themselves (privacy)
        hashes := make([]string, 0, len(keys))
        for _, k := range keys {
            h := sha256.Sum256([]byte(k))
            hashes = append(hashes, hex.EncodeToString(h[:]))
        }

        now := time.Now().Unix()
        payload, _ := json.Marshal(map[string]any{
            "issuedAt": now,
            "revoked":  hashes,
        })
        sig := kg.SignRevocationList(payload)

        resp := revocationResponse{
            IssuedAt: now,
            Revoked:  hashes,
            Sig:      hex.EncodeToString(sig),
        }

        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Cache-Control", "public, max-age=3600") // CDN-cacheable for 1h
        json.NewEncoder(w).Encode(resp)
    }
}
```

---

### 11.6 Email Sending (`licenseserver/mailer/mailer.go`)

Uses [Resend](https://resend.com) — simple REST API, free tier covers ~3,000 emails/month.

```go
package mailer

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type Mailer struct {
    apiKey   string
    fromAddr string
}

func New(apiKey, fromAddr string) *Mailer {
    return &Mailer{apiKey: apiKey, fromAddr: fromAddr}
}

func (m *Mailer) SendLicenseKey(toEmail, licenseKey string) error {
    body := map[string]any{
        "from":    m.fromAddr,
        "to":      []string{toEmail},
        "subject": "Your Bough License Key",
        "html": fmt.Sprintf(`
<h2>Thank you for purchasing Bough!</h2>
<p>Here is your license key:</p>
<pre style="font-size:18px;letter-spacing:2px;padding:16px;background:#f5f5f5;border-radius:8px">%s</pre>
<p>To activate:</p>
<ol>
  <li>Open Bough</li>
  <li>Go to <strong>Bough → License</strong></li>
  <li>Paste your key and click <strong>Activate</strong></li>
</ol>
<p>Your license covers 2 machines. You can use it on your work and personal computer.</p>
<p>If you need help, reply to this email.</p>
`, licenseKey),
    }

    data, _ := json.Marshal(body)
    req, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(data))
    req.Header.Set("Authorization", "Bearer "+m.apiKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return fmt.Errorf("resend request: %w", err)
    }
    defer resp.Body.Close()
    if resp.StatusCode >= 300 {
        return fmt.Errorf("resend status %d", resp.StatusCode)
    }
    return nil
}
```

---

### 11.7 Database (`licenseserver/store/db.go`)

SQLite via `modernc.org/sqlite` (pure Go, no CGo).

```go
package store

import (
    "database/sql"
    "time"

    _ "modernc.org/sqlite"
)

type DB struct{ db *sql.DB }

func Open(path string) (*DB, error) {
    db, err := sql.Open("sqlite", path)
    if err != nil {
        return nil, err
    }
    _, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS issued_keys (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            key        TEXT NOT NULL UNIQUE,
            email      TEXT NOT NULL,
            payment_id TEXT NOT NULL,
            issued_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked    BOOLEAN NOT NULL DEFAULT FALSE,
            revoked_at DATETIME
        )`)
    if err != nil {
        return nil, err
    }
    return &DB{db: db}, nil
}

func (d *DB) SaveIssuedKey(key, email, paymentID string) error {
    _, err := d.db.Exec(
        `INSERT INTO issued_keys (key, email, payment_id) VALUES (?, ?, ?)`,
        key, email, paymentID,
    )
    return err
}

func (d *DB) RevokeByPaymentID(paymentID string) error {
    _, err := d.db.Exec(
        `UPDATE issued_keys SET revoked=TRUE, revoked_at=? WHERE payment_id=?`,
        time.Now(), paymentID,
    )
    return err
}

func (d *DB) UnrevokeByPaymentID(paymentID string) error {
    _, err := d.db.Exec(
        `UPDATE issued_keys SET revoked=FALSE, revoked_at=NULL WHERE payment_id=?`,
        paymentID,
    )
    return err
}

func (d *DB) GetRevokedKeys() ([]string, error) {
    rows, err := d.db.Query(`SELECT key FROM issued_keys WHERE revoked=TRUE`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var keys []string
    for rows.Next() {
        var k string
        if err := rows.Scan(&k); err == nil {
            keys = append(keys, k)
        }
    }
    return keys, rows.Err()
}
```

---

### 11.8 Revocation Check in the App (`app/license/license.go` — addition)

#### Timing rationale

Stripe's chargeback window for card payments is **120 days**. After that, no dispute is possible. Bough therefore performs exactly **one** revocation check, triggered the first time the app launches after **130 days** since activation. Before that point and after a successful check, the app operates fully offline — no background calls, no daily pings.

```
Day 0          Day 30         Day 130                  Forever
│──── Trial ───│──── Active ──│── One-time check ──────│── Never checks again ──
```

```go
const (
    disputeWindowDays = 120
    checkBufferDays   = 10   // small buffer beyond the window
    revocationURL     = "https://license.boughapp.com/revoked"
)

// RevocationCheckState tracks whether we've done the post-dispute check.
type RevocationCheckState struct {
    ActivatedAt    time.Time `json:"activatedAt"`
    CheckDoneAt    time.Time `json:"checkDoneAt"`    // zero = not yet done
    CheckOutcome   string    `json:"checkOutcome"`   // "ok" | "revoked" | ""
}

func revocationStatePath() string {
    dir, _ := os.UserConfigDir()
    return filepath.Join(dir, "Bough", "revcheck.json")
}

func loadRevocationState() RevocationCheckState {
    data, err := os.ReadFile(revocationStatePath())
    if err != nil {
        return RevocationCheckState{}
    }
    var s RevocationCheckState
    json.Unmarshal(data, &s)
    return s
}

func saveRevocationState(s RevocationCheckState) {
    path := revocationStatePath()
    os.MkdirAll(filepath.Dir(path), 0700)
    data, _ := json.Marshal(s)
    os.WriteFile(path, data, 0600)
}

// MaybeCheckRevocation runs the one-time post-dispute revocation check if due.
// It is a no-op if the check has already been completed or is not yet needed.
// Safe to call on every startup — it will only perform a network request once.
func MaybeCheckRevocation(currentKey string, activatedAt time.Time) {
    state := loadRevocationState()

    // Already checked — nothing to do
    if !state.CheckDoneAt.IsZero() {
        return
    }

    // Not yet past the dispute window
    checkAfter := activatedAt.AddDate(0, 0, disputeWindowDays+checkBufferDays)
    if time.Now().Before(checkAfter) {
        return
    }

    // Time to do the check — attempt network request
    resp, err := http.Get(revocationURL)
    if err != nil {
        // Network unavailable — do not penalise the user.
        // Retry on next startup until the check eventually succeeds.
        return
    }
    defer resp.Body.Close()

    var payload struct {
        IssuedAt int64    `json:"issuedAt"`
        Revoked  []string `json:"revoked"`
        Sig      string   `json:"sig"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
        return
    }

    // Verify the server's Ed25519 signature before trusting the list
    rawForSig, _ := json.Marshal(map[string]any{
        "issuedAt": payload.IssuedAt,
        "revoked":  payload.Revoked,
    })
    sigBytes, _ := hex.DecodeString(payload.Sig)
    if !ed25519.Verify(embeddedPublicKey, rawForSig, sigBytes) {
        return // tampered or wrong key — ignore silently
    }

    // Check whether our key is in the revocation list
    h := sha256.Sum256([]byte(currentKey))
    ourHash := hex.EncodeToString(h[:])
    outcome := "ok"
    for _, revoked := range payload.Revoked {
        if revoked == ourHash {
            outcome = "revoked"
            clearStoredLicense()
            break
        }
    }

    // Mark check as done — never check again regardless of outcome
    saveRevocationState(RevocationCheckState{
        ActivatedAt:  activatedAt,
        CheckDoneAt:  time.Now(),
        CheckOutcome: outcome,
    })
}
```

Called from `app.go` startup (non-blocking):
```go
func (a *App) startup(ctx context.Context) {
    // ... existing startup code ...

    go func() {
        status := license.GetStatus()
        if status.State == "active" {
            license.MaybeCheckRevocation(status.rawKey, status.ActivatedAt)
            // If the check just revoked the key, notify the frontend
            newStatus := license.GetStatus()
            if newStatus.State != "active" {
                runtime.EventsEmit(ctx, "license:revoked")
            }
        }
    }()
}
```

---

### 11.9 Chargeback Handling Summary

| Event | Stripe Webhook | Server Action | App Effect |
|---|---|---|---|
| Voluntary refund | `charge.refunded` | Key added to revocation DB | App enters read-only at day-130 check |
| Chargeback opened | `charge.dispute.created` | Key immediately revoked in DB | Same — read-only at day-130 check |
| Chargeback won (you) | `charge.dispute.closed` (status=`won`) | Revocation removed from DB | Check passes, stays active |
| Chargeback lost | `charge.dispute.closed` (status=`lost`) | Key stays revoked in DB | Read-only at day-130 check |

**Why this model works well:**

Stripe's chargeback window is 120 days for standard card payments. Bough waits 130 days, does the check once, and then permanently trusts the result. This means:

- **Days 0–130:** App works fully offline — no network calls, no tracking, no pings. Customers who pay honestly never notice the licensing system at all.
- **Day 130+:** One silent background request on next startup. If the check succeeds (not revoked), a flag is written locally and the check never runs again.
- **If offline at day 130:** The check is simply deferred to the next startup where internet is available. The user is never penalised for being offline — the app keeps working normally until the check can complete.
- **Determined bad actors:** Someone who does a chargeback and then blocks all network access will get ~unlimited use. This is an acceptable trade-off for a developer tool with honest customers. Aggressive DRM would hurt paying customers far more than it would stop pirates.

---

### 11.10 Deployment (`licenseserver/`)

**Fly.io** is the recommended host (€2–3/month, simple CLI deployment, automatic TLS).

`licenseserver/fly.toml`:
```toml
app = "bough-licenseserver"
primary_region = "fra"  # Frankfurt

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true

[env]
  PORT = "8080"

# Secrets (set via `fly secrets set KEY=value` — never committed to repo):
# PRIVATE_KEY_HEX, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, FROM_EMAIL
```

`licenseserver/Dockerfile`:
```dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o licenseserver .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /data
COPY --from=builder /app/licenseserver /usr/local/bin/licenseserver
VOLUME ["/data"]   # SQLite database persists here
EXPOSE 8080
CMD ["licenseserver"]
```

Initial setup:
```bash
# Generate Ed25519 key pair (once only — store private.key securely, NEVER commit it)
openssl genpkey -algorithm ed25519 -out private.key
openssl pkey -in private.key -pubout -outform DER | tail -c 32 | xxd -p -c 32 > private.hex
openssl pkey -in private.key -pubout -outform DER | tail -c 32 > app/license/public.key

# Deploy
cd licenseserver
fly launch
fly secrets set \
  PRIVATE_KEY_HEX=$(cat ../private.hex) \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  FROM_EMAIL="Bough <license@boughapp.com>"
fly deploy

# Register the webhook URL in Stripe Dashboard:
# https://bough-licenseserver.fly.dev/webhook
# Events: checkout.session.completed, charge.refunded,
#         charge.dispute.created, charge.dispute.closed
```

---

## 12. GitHub Actions: License Server Deploy (`.github/workflows/licenseserver.yml`)

```yaml
name: Deploy License Server

on:
  push:
    branches: [main]
    paths: [licenseserver/**]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        working-directory: licenseserver
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

The app release pipeline (`.github/workflows/release.yml`) remains unchanged — the two pipelines are fully independent.

---

## 13. Checklist

**App side (`app/license/`):**
- [ ] `types.go` — `LicenseStatus` struct
- [ ] `trial.go` — `EnsureTrialStarted()`, `TrialDaysLeft()`
- [ ] `store.go` — `SaveLicense()`, `LoadLicense()` for macOS / Windows / Linux
- [ ] `license.go` — `Validate()`, `GetStatus()`, `maskKey()`, `MaybeCheckRevocation()`
- [ ] `revcheck.json` state file: `ActivatedAt`, `CheckDoneAt`, `CheckOutcome`
- [ ] `public.key` generated and committed (only the public key!)
- [ ] `app.go` wiring: `GetLicenseStatus()`, `ActivateLicense()`, background `MaybeCheckRevocation()` goroutine
- [ ] `requireLicense()` guard on all write operations
- [ ] `LicenseDialog.tsx` component
- [ ] Zustand `licenseStatus` state + `license:revoked` event listener

**License server (`licenseserver/`):**
- [ ] `main.go` + `go.mod`
- [ ] `handler/webhook.go` — `checkout.session.completed`, `charge.refunded`, `charge.dispute.*`
- [ ] `handler/revoked.go` — signed revocation list endpoint
- [ ] `keygen/keygen.go` — Ed25519 sign + revocation list signing
- [ ] `mailer/mailer.go` — Resend API integration + license email template
- [ ] `store/db.go` — SQLite: issued keys, revocations
- [ ] `Dockerfile` + `fly.toml`
- [ ] `.github/workflows/licenseserver.yml`

**Infrastructure:**
- [ ] Ed25519 key pair generated, `private.key` stored in password manager
- [ ] `public.key` committed to `app/license/`
- [ ] Fly.io app created, secrets set
- [ ] Stripe webhook registered for all 4 event types
- [ ] Resend domain verified (for `@boughapp.com` sender)
- [ ] End-to-end test: Stripe test payment → email received → key validates in app
- [ ] Revocation test: revoke a test key → set system clock to day 131 → app enters read-only on next startup
- [ ] Offline test: block network at day 131 → app stays active, retries on next online startup
