package license

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

const trialDuration = 30 * 24 * time.Hour

type trialRecord struct {
	StartedAt time.Time `json:"startedAt"`
}

func trialFilePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "Bough", "trial.json"), nil
}

// EnsureTrialStarted records the trial start date the first time it is called.
// Subsequent calls are no-ops. Safe to call on every startup.
func EnsureTrialStarted() error {
	path, err := trialFilePath()
	if err != nil {
		return err
	}
	if _, err := os.Stat(path); err == nil {
		return nil // already recorded
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.Marshal(trialRecord{StartedAt: now()})
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

// TrialDaysLeft returns the number of full days remaining in the trial.
// Returns 0 when the trial has expired or was never started.
func TrialDaysLeft() int {
	path, err := trialFilePath()
	if err != nil {
		return 0
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	var rec trialRecord
	if err := json.Unmarshal(data, &rec); err != nil {
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
