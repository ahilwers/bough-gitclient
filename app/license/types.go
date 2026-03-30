package license

import "time"

// LicenseStatus summarises the current license state for the frontend.
// This struct is serialised by Wails to JSON for the TypeScript layer.
type LicenseStatus struct {
	State       string    `json:"state"`       // "trial" | "active" | "expired" | "invalid"
	DaysLeft    int       `json:"daysLeft"`    // full days remaining in trial (0 if not in trial)
	LicenseKey  string    `json:"licenseKey"`  // masked key, e.g. "BOUGH-ABCDEFGH-****-****-****"
	ActivatedAt time.Time `json:"activatedAt"` // zero if not yet activated
	Email       string    `json:"email"`       // registered email address
}

// LicensePayload is the decoded content of a validated license.
type LicensePayload struct {
	Email   string
	Edition string    // "indie" | "pro" | "team"
	Expiry  time.Time // zero = perpetual
}

// storedRecord is the full activation record persisted in the OS keychain.
// It holds everything needed for offline validation after the first activation.
type storedRecord struct {
	Key         string    `json:"key"`
	RawPayload  string    `json:"rawPayload"`  // "email\nedition\nexpiry" — signed by server
	SigHex      string    `json:"sigHex"`      // full 64-byte Ed25519 signature (hex)
	ActivatedAt time.Time `json:"activatedAt"`
	Email       string    `json:"email"`
	Edition     string    `json:"edition"`
	Expiry      string    `json:"expiry"` // "perpetual" or "YYYY-MM-DD"
}
