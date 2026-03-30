package license

import (
	"encoding/json"
	"time"
)

const trialDuration = 30 * 24 * time.Hour

type trialRecord struct {
	StartedAt time.Time `json:"startedAt"`
}

// trialStorageBackend mirrors storageBackend but targets the "trial" keychain
// account. Overridable in tests via UseInMemoryTrialStorage.
var trialStorageBackend = struct {
	save   func(string) error
	load   func() (string, error)
	delete func() error
}{
	save:   func(v string) error    { return saveStringForAccount(keychainTrialAccount, v) },
	load:   func() (string, error)  { return loadStringForAccount(keychainTrialAccount) },
	delete: func() error            { return deleteStringForAccount(keychainTrialAccount) },
}

// EnsureTrialStarted records the trial start date the first time it is called.
// Subsequent calls are no-ops. Safe to call on every startup.
func EnsureTrialStarted() error {
	raw, err := trialStorageBackend.load()
	if err != nil || raw != "" {
		return err // already recorded (or load error)
	}
	data, err := json.Marshal(trialRecord{StartedAt: now()})
	if err != nil {
		return err
	}
	return trialStorageBackend.save(string(data))
}

// TrialDaysLeft returns the number of full days remaining in the trial.
// Returns 0 when the trial has expired or was never started.
func TrialDaysLeft() int {
	raw, err := trialStorageBackend.load()
	if err != nil || raw == "" {
		return 0
	}
	var rec trialRecord
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		return 0
	}
	remaining := rec.StartedAt.Add(trialDuration).Sub(now())
	if remaining <= 0 {
		return 0
	}
	return int(remaining.Hours() / 24)
}

// now is a variable so tests can substitute a fake clock.
var now = time.Now
