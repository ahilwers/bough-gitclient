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
	Sig      string   `json:"sig"`      // Ed25519 signature over {issuedAt, revoked} in hex
}

// Revoked handles GET /revoked.
// Returns a signed JSON list of revoked key hashes. The app verifies the
// signature before trusting the list, then checks its own key hash against it.
func Revoked(kg *keygen.KeyGen, db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		keys, err := db.GetRevokedKeys()
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Store hashes of keys rather than the keys themselves (privacy).
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
		w.Header().Set("Cache-Control", "public, max-age=3600")
		json.NewEncoder(w).Encode(resp)
	}
}
