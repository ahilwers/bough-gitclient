package handler_test

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"bough/licenseserver/handler"
	"bough/licenseserver/keygen"
	"bough/licenseserver/store"
)

// mockMailer records sent emails without sending anything.
type mockMailer struct {
	Sent []struct{ To, Key string }
}

func (m *mockMailer) SendLicenseKey(to, key string) error {
	m.Sent = append(m.Sent, struct{ To, Key string }{to, key})
	return nil
}

func newTestKeyGen(t *testing.T) *keygen.KeyGen {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return keygen.New(hex.EncodeToString(priv.Seed()))
}

func openDB(t *testing.T) *store.DB {
	t.Helper()
	db, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func post(t *testing.T, h http.Handler, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(b))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestWebhook_CheckoutCompleted(t *testing.T) {
	kg := newTestKeyGen(t)
	ml := &mockMailer{}
	db := openDB(t)
	h := handler.WebhookForTest(kg, ml, db)

	rec := post(t, h, map[string]any{
		"type": "checkout.session.completed",
		"data": map[string]any{
			"object": map[string]any{
				"id": "cs_test_001",
				"customer_details": map[string]any{
					"email": "buyer@example.com",
				},
			},
		},
	})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	if len(ml.Sent) != 1 {
		t.Fatalf("emails sent = %d, want 1", len(ml.Sent))
	}
	if ml.Sent[0].To != "buyer@example.com" {
		t.Errorf("email To = %q, want buyer@example.com", ml.Sent[0].To)
	}
}

func TestWebhook_CheckoutCompleted_NoEmail(t *testing.T) {
	kg := newTestKeyGen(t)
	ml := &mockMailer{}
	db := openDB(t)
	h := handler.WebhookForTest(kg, ml, db)

	rec := post(t, h, map[string]any{
		"type": "checkout.session.completed",
		"data": map[string]any{
			"object": map[string]any{
				"id":               "cs_test_002",
				"customer_details": map[string]any{},
			},
		},
	})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	if len(ml.Sent) != 0 {
		t.Errorf("unexpected email sent for session without email")
	}
}

func TestWebhook_Refund_RevokesKey(t *testing.T) {
	kg := newTestKeyGen(t)
	ml := &mockMailer{}
	db := openDB(t)
	h := handler.WebhookForTest(kg, ml, db)

	// Pre-insert a key linked to this payment.
	if err := db.SaveIssuedKey("BOUGH-REFUND-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX", "a@b.com", "ch_refund_001", "payload", "sig"); err != nil {
		t.Fatalf("SaveIssuedKey: %v", err)
	}

	rec := post(t, h, map[string]any{
		"type": "charge.refunded",
		"data": map[string]any{
			"object": map[string]any{"id": "ch_refund_001"},
		},
	})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	revoked, _ := db.GetRevokedKeys()
	if len(revoked) != 1 {
		t.Fatalf("revoked count = %d, want 1", len(revoked))
	}
	if revoked[0] != "BOUGH-REFUND-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX" {
		t.Errorf("revoked key = %q, unexpected", revoked[0])
	}
}

func TestWebhook_Dispute_RevokesKey(t *testing.T) {
	kg := newTestKeyGen(t)
	ml := &mockMailer{}
	db := openDB(t)
	h := handler.WebhookForTest(kg, ml, db)

	if err := db.SaveIssuedKey("BOUGH-DISPUTE-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX", "a@b.com", "ch_dispute_001", "payload", "sig"); err != nil {
		t.Fatalf("SaveIssuedKey: %v", err)
	}

	rec := post(t, h, map[string]any{
		"type": "charge.dispute.created",
		"data": map[string]any{
			"object": map[string]any{
				"charge": map[string]any{"id": "ch_dispute_001"},
			},
		},
	})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	revoked, _ := db.GetRevokedKeys()
	if len(revoked) != 1 {
		t.Errorf("revoked count = %d, want 1", len(revoked))
	}
}

func TestWebhook_DisputeWon_RestoresKey(t *testing.T) {
	kg := newTestKeyGen(t)
	ml := &mockMailer{}
	db := openDB(t)
	h := handler.WebhookForTest(kg, ml, db)

	if err := db.SaveIssuedKey("BOUGH-WON-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX", "a@b.com", "ch_won_001", "payload", "sig"); err != nil {
		t.Fatalf("SaveIssuedKey: %v", err)
	}
	_ = db.RevokeByPaymentID("ch_won_001")

	rec := post(t, h, map[string]any{
		"type": "charge.dispute.closed",
		"data": map[string]any{
			"object": map[string]any{
				"status": "won",
				"charge": map[string]any{"id": "ch_won_001"},
			},
		},
	})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	revoked, _ := db.GetRevokedKeys()
	if len(revoked) != 0 {
		t.Errorf("revoked count = %d, want 0 after winning dispute", len(revoked))
	}
}
