package store_test

import (
	"testing"

	"bough/licenseserver/store"
)

func openTestDB(t *testing.T) *store.DB {
	t.Helper()
	db, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestSaveAndRetrieve(t *testing.T) {
	db := openTestDB(t)

	const (
		key        = "BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
		email      = "alice@example.com"
		paymentID  = "cs_test_123"
		rawPayload = "alice@example.com\nindie\nperpetual"
		sigHex     = "aabbccdd"
	)

	if err := db.SaveIssuedKey(key, email, paymentID, rawPayload, sigHex); err != nil {
		t.Fatalf("SaveIssuedKey: %v", err)
	}

	gotEmail, gotEdition, gotExpiry, gotPayload, gotSig, err := db.GetKeyDetails(key)
	if err != nil {
		t.Fatalf("GetKeyDetails: %v", err)
	}
	if gotEmail != email {
		t.Errorf("email = %q, want %q", gotEmail, email)
	}
	if gotEdition != "indie" {
		t.Errorf("edition = %q, want indie", gotEdition)
	}
	if gotExpiry != "perpetual" {
		t.Errorf("expiry = %q, want perpetual", gotExpiry)
	}
	if gotPayload != rawPayload {
		t.Errorf("rawPayload = %q, want %q", gotPayload, rawPayload)
	}
	if gotSig != sigHex {
		t.Errorf("sigHex = %q, want %q", gotSig, sigHex)
	}
}

func TestGetKeyDetails_NotFound(t *testing.T) {
	db := openTestDB(t)
	_, _, _, _, _, err := db.GetKeyDetails("BOUGH-NOTEXIST-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX")
	if err == nil {
		t.Fatal("expected error for missing key, got nil")
	}
}

func TestRevokeByPaymentID(t *testing.T) {
	db := openTestDB(t)

	key := "BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
	if err := db.SaveIssuedKey(key, "a@b.com", "ch_test_456", "a@b.com\nindie\nperpetual", "sig"); err != nil {
		t.Fatalf("SaveIssuedKey: %v", err)
	}

	if err := db.RevokeByPaymentID("ch_test_456"); err != nil {
		t.Fatalf("RevokeByPaymentID: %v", err)
	}

	// GetKeyDetails should now return no rows (revoked=TRUE filtered out).
	_, _, _, _, _, err := db.GetKeyDetails(key)
	if err == nil {
		t.Error("expected error after revocation, got nil")
	}

	revoked, err := db.GetRevokedKeys()
	if err != nil {
		t.Fatalf("GetRevokedKeys: %v", err)
	}
	if len(revoked) != 1 || revoked[0] != key {
		t.Errorf("revoked = %v, want [%s]", revoked, key)
	}
}

func TestUnrevokeByPaymentID(t *testing.T) {
	db := openTestDB(t)

	key := "BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
	if err := db.SaveIssuedKey(key, "a@b.com", "ch_test_789", "a@b.com\nindie\nperpetual", "sig"); err != nil {
		t.Fatalf("SaveIssuedKey: %v", err)
	}

	_ = db.RevokeByPaymentID("ch_test_789")
	if err := db.UnrevokeByPaymentID("ch_test_789"); err != nil {
		t.Fatalf("UnrevokeByPaymentID: %v", err)
	}

	// Key should now be accessible again.
	_, _, _, _, _, err := db.GetKeyDetails(key)
	if err != nil {
		t.Errorf("key should be accessible after unrevoke, got: %v", err)
	}

	revoked, _ := db.GetRevokedKeys()
	if len(revoked) != 0 {
		t.Errorf("revoked = %v, want empty", revoked)
	}
}

func TestSaveIssuedKey_Duplicate(t *testing.T) {
	db := openTestDB(t)
	key := "BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
	if err := db.SaveIssuedKey(key, "a@b.com", "ch_001", "payload", "sig"); err != nil {
		t.Fatalf("first save: %v", err)
	}
	if err := db.SaveIssuedKey(key, "a@b.com", "ch_002", "payload", "sig"); err == nil {
		t.Error("expected error on duplicate key insert, got nil")
	}
}
