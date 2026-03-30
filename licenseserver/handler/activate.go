package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"bough/licenseserver/store"
)

// activateRequest is the JSON body sent by the app when activating a license.
type activateRequest struct {
	Key string `json:"key"`
}

// activateResponse is returned to the app on a successful activation.
type activateResponse struct {
	Email      string `json:"email"`
	Edition    string `json:"edition"`
	Expiry     string `json:"expiry"`
	RawPayload string `json:"rawPayload"`
	SigHex     string `json:"sigHex"`
}

// Activate handles POST /activate.
// The app sends the user-entered key; if valid and not revoked, the server
// returns the full signed record so the app can store it for offline validation.
func Activate(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req activateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Key == "" {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		email, edition, expiry, rawPayload, sigHex, err := db.GetKeyDetails(req.Key)
		if err == sql.ErrNoRows {
			http.Error(w, "key not found or revoked", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		resp := activateResponse{
			Email:      email,
			Edition:    edition,
			Expiry:     expiry,
			RawPayload: rawPayload,
			SigHex:     sigHex,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
