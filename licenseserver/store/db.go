package store

import (
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)

// DB wraps a SQLite database for license key management.
type DB struct{ db *sql.DB }

// Open opens (or creates) the SQLite database at path.
// Use ":memory:" for tests.
func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS issued_keys (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			key         TEXT NOT NULL UNIQUE,
			email       TEXT NOT NULL,
			payment_id  TEXT NOT NULL,
			raw_payload TEXT NOT NULL,
			sig_hex     TEXT NOT NULL,
			issued_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			revoked     BOOLEAN NOT NULL DEFAULT FALSE,
			revoked_at  DATETIME
		)`); err != nil {
		return nil, err
	}
	return &DB{db: db}, nil
}

// Close closes the underlying database connection.
func (d *DB) Close() error { return d.db.Close() }

// SaveIssuedKey records a newly generated license key.
func (d *DB) SaveIssuedKey(key, email, paymentID, rawPayload, sigHex string) error {
	_, err := d.db.Exec(
		`INSERT INTO issued_keys (key, email, payment_id, raw_payload, sig_hex)
		 VALUES (?, ?, ?, ?, ?)`,
		key, email, paymentID, rawPayload, sigHex,
	)
	return err
}

// GetKeyDetails retrieves the full activation data for a key.
// Returns sql.ErrNoRows when the key is not found.
func (d *DB) GetKeyDetails(key string) (email, edition, expiry, rawPayload, sigHex string, err error) {
	row := d.db.QueryRow(
		`SELECT email, raw_payload, sig_hex FROM issued_keys
		 WHERE key = ? AND revoked = FALSE`,
		key,
	)
	var raw string
	if err = row.Scan(&email, &raw, &sigHex); err != nil {
		return
	}
	rawPayload = raw

	// Parse edition and expiry from rawPayload ("email\nedition\nexpiry").
	parts := splitN(raw, "\n", 3)
	if len(parts) == 3 {
		edition = parts[1]
		expiry = parts[2]
	}
	return
}

func splitN(s, sep string, n int) []string {
	result := make([]string, 0, n)
	for i := 0; i < n-1; i++ {
		idx := -1
		for j := 0; j < len(s); j++ {
			if s[j:j+len(sep)] == sep {
				idx = j
				break
			}
		}
		if idx == -1 {
			break
		}
		result = append(result, s[:idx])
		s = s[idx+len(sep):]
	}
	result = append(result, s)
	return result
}

// RevokeByPaymentID marks all keys associated with a payment ID as revoked.
func (d *DB) RevokeByPaymentID(paymentID string) error {
	_, err := d.db.Exec(
		`UPDATE issued_keys SET revoked = TRUE, revoked_at = ?
		 WHERE payment_id = ?`,
		time.Now(), paymentID,
	)
	return err
}

// UnrevokeByPaymentID re-enables a previously revoked key (e.g. dispute won).
func (d *DB) UnrevokeByPaymentID(paymentID string) error {
	_, err := d.db.Exec(
		`UPDATE issued_keys SET revoked = FALSE, revoked_at = NULL
		 WHERE payment_id = ?`,
		paymentID,
	)
	return err
}

// GetRevokedKeys returns the license keys that are currently marked as revoked.
func (d *DB) GetRevokedKeys() ([]string, error) {
	rows, err := d.db.Query(`SELECT key FROM issued_keys WHERE revoked = TRUE`)
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
