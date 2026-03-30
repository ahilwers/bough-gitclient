package keygen

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"fmt"
)

// KeyGen holds an Ed25519 key pair used to sign license keys and revocation lists.
type KeyGen struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
}

// New creates a KeyGen from a hex-encoded 32-byte Ed25519 seed.
// Panics if the hex string is malformed or the wrong length — this is a
// programming error (bad environment variable), not a recoverable condition.
func New(privateKeyHex string) *KeyGen {
	seed, err := hex.DecodeString(privateKeyHex)
	if err != nil || len(seed) != ed25519.SeedSize {
		panic("PRIVATE_KEY_HEX must be a 64-char hex string (32-byte Ed25519 seed)")
	}
	priv := ed25519.NewKeyFromSeed(seed)
	return &KeyGen{
		privateKey: priv,
		publicKey:  priv.Public().(ed25519.PublicKey),
	}
}

// Generate creates a new license key for the given email, edition, and expiry.
// expiry should be "perpetual" for a time-unlimited license, or "YYYY-MM-DD".
//
// Key format: BOUGH-<8 base32 chars of payload hash>-<10>-<10>-<10>
// The human-visible key is a short receipt; the full signature and payload are
// returned separately for storage in the database and returned to the app on activation.
func (kg *KeyGen) Generate(email, edition, expiry string) (key, rawPayload, sigHex string, err error) {
	rawPayload = fmt.Sprintf("%s\n%s\n%s", email, edition, expiry)
	sig := ed25519.Sign(kg.privateKey, []byte(rawPayload))
	sigHex = hex.EncodeToString(sig)

	b32 := base32.StdEncoding.WithPadding(base32.NoPadding)

	h := sha256.Sum256([]byte(rawPayload))
	prefix := b32.EncodeToString(h[:5]) // 8 chars

	part1 := b32.EncodeToString(sig[:6])   // 10 chars
	part2 := b32.EncodeToString(sig[6:12]) // 10 chars
	part3 := b32.EncodeToString(sig[12:18]) // 10 chars

	key = fmt.Sprintf("BOUGH-%s-%s-%s-%s", prefix, part1, part2, part3)
	return key, rawPayload, sigHex, nil
}

// SignRevocationList signs a JSON payload of revoked key hashes so the app can
// verify the list wasn't tampered with.
func (kg *KeyGen) SignRevocationList(payload []byte) []byte {
	return ed25519.Sign(kg.privateKey, payload)
}

// PublicKeyBytes returns the raw 32-byte Ed25519 public key for embedding in the app.
func (kg *KeyGen) PublicKeyBytes() []byte {
	return kg.publicKey
}
