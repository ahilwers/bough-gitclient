package license

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	keychainService      = "Bough"
	keychainAccount      = "license"
	keychainTrialAccount = "trial"
)

// storageBackend is the set of primitive save/load/delete functions.
// It defaults to OS keychain storage and can be overridden in tests.
var storageBackend = struct {
	save   func(string) error
	load   func() (string, error)
	delete func() error
}{
	save:   saveString,
	load:   loadString,
	delete: deleteString,
}

// SaveLicense persists the activation record to the OS keychain.
// Falls back to a config-directory JSON file when the keychain is unavailable.
func SaveLicense(record *storedRecord) error {
	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("marshal license record: %w", err)
	}
	return storageBackend.save(string(data))
}

// LoadLicense retrieves the stored activation record, or returns nil if no
// license has been activated on this machine.
func LoadLicense() (*storedRecord, error) {
	raw, err := storageBackend.load()
	if err != nil || raw == "" {
		return nil, err
	}
	var rec storedRecord
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		return nil, fmt.Errorf("corrupt license record: %w", err)
	}
	return &rec, nil
}

// DeleteLicense removes the stored activation record from the OS keychain.
func DeleteLicense() error {
	return storageBackend.delete()
}

// ── OS-level string storage ───────────────────────────────────────────────────

// saveString / loadString / deleteString target the license keychain account.
func saveString(value string) error     { return saveStringForAccount(keychainAccount, value) }
func loadString() (string, error)       { return loadStringForAccount(keychainAccount) }
func deleteString() error               { return deleteStringForAccount(keychainAccount) }

func saveStringForAccount(account, value string) error {
	switch runtime.GOOS {
	case "darwin":
		exec.Command("security", "delete-generic-password",
			"-s", keychainService, "-a", account).Run()
		cmd := exec.Command("security", "add-generic-password",
			"-s", keychainService, "-a", account, "-w", value)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("keychain save: %w\n%s", err, out)
		}
		return nil
	case "windows":
		cmd := exec.Command("cmdkey",
			fmt.Sprintf("/generic:%s/%s", keychainService, account),
			fmt.Sprintf("/user:%s", account),
			fmt.Sprintf("/pass:%s", value))
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("credential manager save: %w\n%s", err, out)
		}
		return nil
	default: // Linux — use secret-tool (libsecret/GNOME Keyring)
		cmd := exec.Command("secret-tool", "store",
			"--label", fmt.Sprintf("Bough %s", account),
			"service", keychainService,
			"account", account)
		cmd.Stdin = strings.NewReader(value)
		if _, err := cmd.CombinedOutput(); err != nil {
			return saveLicenseFile(value)
		}
		return nil
	}
}

func loadStringForAccount(account string) (string, error) {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("security", "find-generic-password",
			"-s", keychainService, "-a", account, "-w").Output()
		if err != nil {
			return "", nil // not found
		}
		return strings.TrimSpace(string(out)), nil
	case "windows":
		return loadLicenseFile()
	default: // Linux
		out, err := exec.Command("secret-tool", "lookup",
			"service", keychainService,
			"account", account).Output()
		if err != nil {
			return loadLicenseFile()
		}
		return strings.TrimSpace(string(out)), nil
	}
}

func deleteStringForAccount(account string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("security", "delete-generic-password",
			"-s", keychainService, "-a", account).Run()
	case "windows":
		return exec.Command("cmdkey",
			fmt.Sprintf("/delete:%s/%s", keychainService, account)).Run()
	default:
		exec.Command("secret-tool", "clear",
			"service", keychainService,
			"account", account).Run()
		return deleteLicenseFile()
	}
}

// ── Config-file fallback ──────────────────────────────────────────────────────

func licenseFilePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "Bough", "license.json"), nil
}

func saveLicenseFile(value string) error {
	path, err := licenseFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(value), 0600)
}

func loadLicenseFile() (string, error) {
	path, err := licenseFilePath()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	return string(data), err
}

func deleteLicenseFile() error {
	path, err := licenseFilePath()
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
