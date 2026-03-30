package license

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// embeddedPublicKeyBytes is the Ed25519 public key baked in at compile time.
// Replace app/license/public.key with the real production key before shipping.
//
//go:embed public.key
var embeddedPublicKeyBytes []byte

// publicKey returns the active Ed25519 public key.
// Tests can override this via testSetPublicKey (see export_test.go).
var publicKey = func() ed25519.PublicKey {
	return ed25519.PublicKey(embeddedPublicKeyBytes)
}

// activationURL is the license server endpoint used during first activation.
// Overridable in tests.
var activationURL = "https://license.boughapp.com/activate"

const (
	revocationURL     = "https://license.boughapp.com/revoked"
	disputeWindowDays = 120
	checkBufferDays   = 10
)

var (
	ErrInvalidFormat  = errors.New("invalid license key format")
	ErrInvalidSig     = errors.New("license signature verification failed")
	ErrExpiredLicense = errors.New("license has expired")
)

// ── Validation ────────────────────────────────────────────────────────────────

// Validate verifies the Ed25519 signature of the stored activation record
// completely offline. Call LoadLicense() to obtain the record first.
func Validate(record *storedRecord) (*LicensePayload, error) {
	sigBytes, err := hex.DecodeString(record.SigHex)
	if err != nil || len(sigBytes) != ed25519.SignatureSize {
		return nil, ErrInvalidSig
	}
	if !ed25519.Verify(publicKey(), []byte(record.RawPayload), sigBytes) {
		return nil, ErrInvalidSig
	}

	p, err := parseRawPayload(record.RawPayload)
	if err != nil {
		return nil, ErrInvalidFormat
	}
	if !p.Expiry.IsZero() && now().After(p.Expiry) {
		return nil, ErrExpiredLicense
	}
	return p, nil
}

// parseRawPayload decodes "email\nedition\nexpiry" strings.
func parseRawPayload(raw string) (*LicensePayload, error) {
	parts := strings.SplitN(raw, "\n", 3)
	if len(parts) != 3 {
		return nil, ErrInvalidFormat
	}
	p := &LicensePayload{
		Email:   parts[0],
		Edition: parts[1],
	}
	if parts[2] != "perpetual" {
		t, err := time.Parse("2006-01-02", parts[2])
		if err != nil {
			return nil, ErrInvalidFormat
		}
		p.Expiry = t
	}
	return p, nil
}

// GetStatus returns the current license state. This is the single function
// the rest of the app calls to decide read-only vs full-access mode.
func GetStatus() LicenseStatus {
	record, err := LoadLicense()
	if err == nil && record != nil {
		_, err := Validate(record)
		if err == nil {
			return LicenseStatus{
				State:       "active",
				LicenseKey:  maskKey(record.Key),
				ActivatedAt: record.ActivatedAt,
				Email:       record.Email,
			}
		}
		if errors.Is(err, ErrExpiredLicense) {
			return LicenseStatus{State: "expired"}
		}
		return LicenseStatus{State: "invalid"}
	}

	days := TrialDaysLeft()
	if days > 0 {
		return LicenseStatus{State: "trial", DaysLeft: days}
	}
	return LicenseStatus{State: "expired"}
}

func maskKey(key string) string {
	parts := strings.Split(key, "-")
	if len(parts) != 5 {
		return key
	}
	return strings.Join([]string{parts[0], parts[1], "****", "****", "****"}, "-")
}

// ── Activation ────────────────────────────────────────────────────────────────

// activateResponse is the JSON body returned by POST /activate on the license server.
type activateResponse struct {
	Email      string `json:"email"`
	Edition    string `json:"edition"`
	Expiry     string `json:"expiry"`     // "perpetual" or "YYYY-MM-DD"
	RawPayload string `json:"rawPayload"` // "email\nedition\nexpiry"
	SigHex     string `json:"sigHex"`     // full 64-byte Ed25519 signature as hex
}

// ActivateWithServer contacts the license server to exchange a user-entered key
// for a full activation record, then stores it in the OS keychain.
// Subsequent validation calls are fully offline.
func ActivateWithServer(key string) error {
	return activateWithURL(key, activationURL)
}

func activateWithURL(key, serverURL string) error {
	if err := validateKeyFormat(key); err != nil {
		return err
	}

	body, _ := json.Marshal(map[string]string{"key": key})
	req, err := http.NewRequest(http.MethodPost, serverURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build activation request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Bough/"+version)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("activation request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		return ErrInvalidSig
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("activation server error (HTTP %d)", resp.StatusCode)
	}

	var ar activateResponse
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return fmt.Errorf("parse activation response: %w", err)
	}

	record := &storedRecord{
		Key:         key,
		RawPayload:  ar.RawPayload,
		SigHex:      ar.SigHex,
		ActivatedAt: now(),
		Email:       ar.Email,
		Edition:     ar.Edition,
		Expiry:      ar.Expiry,
	}

	// Verify the signature before storing — reject tampered server responses.
	if _, err := Validate(record); err != nil {
		return fmt.Errorf("server returned invalid signature: %w", err)
	}

	return SaveLicense(record)
}

// version is injected by main.go via ldflags; package-level reference for User-Agent.
var version = "dev"

// validateKeyFormat checks that a key has the correct BOUGH-X-X-X-X structure.
func validateKeyFormat(key string) error {
	parts := strings.Split(key, "-")
	if len(parts) != 5 || parts[0] != "BOUGH" {
		return ErrInvalidFormat
	}
	for _, p := range parts[1:] {
		if len(p) == 0 {
			return ErrInvalidFormat
		}
	}
	return nil
}

// ── Revocation ────────────────────────────────────────────────────────────────

// RevocationCheckState persists whether the one-time post-dispute check has run.
type revocationCheckState struct {
	ActivatedAt  time.Time `json:"activatedAt"`
	CheckDoneAt  time.Time `json:"checkDoneAt"`  // zero = not yet performed
	CheckOutcome string    `json:"checkOutcome"` // "ok" | "revoked" | ""
}

func revocationStatePath() string {
	dir, _ := os.UserConfigDir()
	return filepath.Join(dir, "Bough", "revcheck.json")
}

func loadRevocationState() revocationCheckState {
	data, err := os.ReadFile(revocationStatePath())
	if err != nil {
		return revocationCheckState{}
	}
	var s revocationCheckState
	json.Unmarshal(data, &s)
	return s
}

func saveRevocationState(s revocationCheckState) {
	path := revocationStatePath()
	os.MkdirAll(filepath.Dir(path), 0700)
	data, _ := json.Marshal(s)
	os.WriteFile(path, data, 0600)
}

// MaybeCheckRevocation performs the one-time revocation check that runs
// 130 days after activation. It is a no-op if already done or not yet due.
// Safe to call on every startup — only ever makes one network request.
func MaybeCheckRevocation(currentKey string, activatedAt time.Time) {
	state := loadRevocationState()
	if !state.CheckDoneAt.IsZero() {
		return // already done
	}

	checkAfter := activatedAt.AddDate(0, 0, disputeWindowDays+checkBufferDays)
	if now().Before(checkAfter) {
		return // not yet due
	}

	resp, err := http.Get(revocationURL)
	if err != nil {
		return // network unavailable — retry on next startup
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

	// Verify the server's signature before trusting the revocation list.
	rawForSig, _ := json.Marshal(map[string]any{
		"issuedAt": payload.IssuedAt,
		"revoked":  payload.Revoked,
	})
	sigBytes, _ := hex.DecodeString(payload.Sig)
	if !ed25519.Verify(publicKey(), rawForSig, sigBytes) {
		return // tampered or wrong key — ignore
	}

	h := sha256.Sum256([]byte(currentKey))
	ourHash := hex.EncodeToString(h[:])
	outcome := "ok"
	for _, revoked := range payload.Revoked {
		if revoked == ourHash {
			outcome = "revoked"
			DeleteLicense()
			break
		}
	}

	saveRevocationState(revocationCheckState{
		ActivatedAt:  activatedAt,
		CheckDoneAt:  now(),
		CheckOutcome: outcome,
	})
}
