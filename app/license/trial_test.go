package license_test

import (
	"testing"
	"time"

	"bough/license"
)

func TestTrialDaysLeft_NotStarted(t *testing.T) {
	withTempConfig(t)

	// No trial file exists yet — TrialDaysLeft should return 0.
	if got := license.TrialDaysLeft(); got != 0 {
		t.Errorf("TrialDaysLeft before start = %d, want 0", got)
	}
}

func TestEnsureTrialStarted_CreatesFile(t *testing.T) {
	withTempConfig(t)

	if err := license.EnsureTrialStarted(); err != nil {
		t.Fatalf("EnsureTrialStarted: %v", err)
	}
	// Confirm the file exists by reading it back through TrialDaysLeft.
	days := license.TrialDaysLeft()
	if days < 28 || days > 30 {
		t.Errorf("TrialDaysLeft after first start = %d, want 28-30", days)
	}
}

func TestEnsureTrialStarted_Idempotent(t *testing.T) {
	withTempConfig(t)

	if err := license.EnsureTrialStarted(); err != nil {
		t.Fatalf("first call: %v", err)
	}
	if err := license.EnsureTrialStarted(); err != nil {
		t.Fatalf("second call: %v", err)
	}
	// Should still show ~30 days.
	days := license.TrialDaysLeft()
	if days < 28 || days > 30 {
		t.Errorf("TrialDaysLeft after double-start = %d, want 28-30", days)
	}
}

func TestTrialDaysLeft_ActiveTrial(t *testing.T) {
	withTempConfig(t)

	_ = license.EnsureTrialStarted()
	days := license.TrialDaysLeft()
	if days < 28 || days > 30 {
		t.Errorf("TrialDaysLeft = %d, want 28-30", days)
	}
}

func TestTrialDaysLeft_SimulatedClock(t *testing.T) {
	withTempConfig(t)

	// Start trial at a fixed point in time.
	trialStart := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	restore := license.SetTestNow(func() time.Time { return trialStart })
	defer restore()

	_ = license.EnsureTrialStarted()

	// Advance clock to day 10 — 20 days should remain.
	license.SetTestNow(func() time.Time { return trialStart.Add(10 * 24 * time.Hour) })
	if got := license.TrialDaysLeft(); got != 20 {
		t.Errorf("day 10: TrialDaysLeft = %d, want 20", got)
	}

	// Advance clock past day 30 — trial expired.
	license.SetTestNow(func() time.Time { return trialStart.Add(31 * 24 * time.Hour) })
	if got := license.TrialDaysLeft(); got != 0 {
		t.Errorf("day 31: TrialDaysLeft = %d, want 0", got)
	}
}

// withTempConfig redirects the OS config dir to a temp directory and returns
// the temp dir path.
func withTempConfig(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("AppData", dir) // Windows
	return dir
}
