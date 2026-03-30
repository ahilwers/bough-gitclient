package keygen_test

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"testing"

	"bough/licenseserver/keygen"
)

func newTestKeyGen(t *testing.T) *keygen.KeyGen {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	return keygen.New(hex.EncodeToString(priv.Seed()))
}

func TestGenerate_Format(t *testing.T) {
	kg := newTestKeyGen(t)
	key, _, _, err := kg.Generate("test@example.com", "indie", "perpetual")
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	parts := strings.Split(key, "-")
	if len(parts) != 5 {
		t.Fatalf("key has %d segments, want 5: %q", len(parts), key)
	}
	if parts[0] != "BOUGH" {
		t.Errorf("prefix = %q, want BOUGH", parts[0])
	}
	if len(parts[1]) == 0 {
		t.Error("payload hash segment is empty")
	}
}

func TestGenerate_Deterministic(t *testing.T) {
	kg := newTestKeyGen(t)
	k1, _, _, _ := kg.Generate("a@b.com", "indie", "perpetual")
	k2, _, _, _ := kg.Generate("a@b.com", "indie", "perpetual")
	if k1 != k2 {
		t.Error("Generate is not deterministic for identical inputs")
	}
}

func TestGenerate_DifferentEmails(t *testing.T) {
	kg := newTestKeyGen(t)
	k1, _, _, _ := kg.Generate("alice@example.com", "indie", "perpetual")
	k2, _, _, _ := kg.Generate("bob@example.com", "indie", "perpetual")
	if k1 == k2 {
		t.Error("same key produced for different emails")
	}
}

func TestGenerate_DifferentEditions(t *testing.T) {
	kg := newTestKeyGen(t)
	k1, _, _, _ := kg.Generate("a@b.com", "indie", "perpetual")
	k2, _, _, _ := kg.Generate("a@b.com", "pro", "perpetual")
	if k1 == k2 {
		t.Error("same key produced for different editions")
	}
}

func TestGenerate_SigHexLength(t *testing.T) {
	kg := newTestKeyGen(t)
	_, _, sigHex, _ := kg.Generate("a@b.com", "indie", "perpetual")
	// Ed25519 sig = 64 bytes = 128 hex chars.
	if len(sigHex) != 128 {
		t.Errorf("sigHex length = %d, want 128", len(sigHex))
	}
}

func TestSignRevocationList(t *testing.T) {
	kg := newTestKeyGen(t)
	payload := []byte(`{"issuedAt":1,"revoked":[]}`)
	sig := kg.SignRevocationList(payload)
	if len(sig) != ed25519.SignatureSize {
		t.Errorf("sig length = %d, want %d", len(sig), ed25519.SignatureSize)
	}

	pub := kg.PublicKeyBytes()
	if !ed25519.Verify(pub, payload, sig) {
		t.Error("revocation list signature does not verify")
	}
}

func TestPublicKeyBytes_Length(t *testing.T) {
	kg := newTestKeyGen(t)
	pub := kg.PublicKeyBytes()
	if len(pub) != ed25519.PublicKeySize {
		t.Errorf("public key length = %d, want %d", len(pub), ed25519.PublicKeySize)
	}
}

func TestNew_InvalidHex(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic for invalid hex, got none")
		}
	}()
	keygen.New("not-valid-hex")
}

func TestNew_WrongLength(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic for wrong-length key, got none")
		}
	}()
	keygen.New("deadbeef") // 8 chars = 4 bytes, not 32
}
