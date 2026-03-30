package license

import (
	"crypto/ed25519"
	"sync"
	"time"
)

// SetTestPublicKey replaces the embedded public key used for verification and
// returns the previous key so the caller can restore it.
// Only compiled into test binaries.
func SetTestPublicKey(pub ed25519.PublicKey) ed25519.PublicKey {
	old := publicKey()
	publicKey = func() ed25519.PublicKey { return pub }
	return old
}

// SetTestActivationURL overrides the activation server URL. Returns the old URL.
func SetTestActivationURL(url string) string {
	old := activationURL
	activationURL = url
	return old
}

// SetTestNow overrides the clock used by trial and revocation logic.
// Returns a restore function.
func SetTestNow(fn func() time.Time) func() {
	old := now
	now = fn
	return func() { now = old }
}

// ActivateWithURL calls activateWithURL directly (bypasses the package-level URL var).
func ActivateWithURL(key, serverURL string) error {
	return activateWithURL(key, serverURL)
}

// UseInMemoryStorage replaces the OS keychain with a simple in-memory map.
// Returns a restore function. Ideal for tests that need isolation.
func UseInMemoryStorage() func() {
	var mu sync.Mutex
	var stored string
	old := storageBackend
	storageBackend.save = func(v string) error { mu.Lock(); stored = v; mu.Unlock(); return nil }
	storageBackend.load = func() (string, error) { mu.Lock(); defer mu.Unlock(); return stored, nil }
	storageBackend.delete = func() error { mu.Lock(); stored = ""; mu.Unlock(); return nil }
	return func() { storageBackend = old }
}

// UseInMemoryTrialStorage replaces the trial keychain entry with a simple
// in-memory value. Returns a restore function.
func UseInMemoryTrialStorage() func() {
	var mu sync.Mutex
	var stored string
	old := trialStorageBackend
	trialStorageBackend.save = func(v string) error { mu.Lock(); stored = v; mu.Unlock(); return nil }
	trialStorageBackend.load = func() (string, error) { mu.Lock(); defer mu.Unlock(); return stored, nil }
	trialStorageBackend.delete = func() error { mu.Lock(); stored = ""; mu.Unlock(); return nil }
	return func() { trialStorageBackend = old }
}
