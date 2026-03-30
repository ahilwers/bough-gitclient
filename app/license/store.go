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
	keychainService = "Bough"
	keychainAccount = "license"
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

func saveString(value string) error {
	switch runtime.GOOS {
	case "darwin":
		// Delete any existing entry first (ignore error if absent).
		exec.Command("security", "delete-generic-password",
			"-s", keychainService, "-a", keychainAccount).Run()
		cmd := exec.Command("security", "add-generic-password",
			"-s", keychainService, "-a", keychainAccount, "-w", value)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("keychain save: %w\n%s", err, out)
		}
		return nil
	case "windows":
		// Use cmdkey for Windows Credential Manager.
		cmd := exec.Command("cmdkey",
			fmt.Sprintf("/generic:%s", keychainService),
			fmt.Sprintf("/user:%s", keychainAccount),
			fmt.Sprintf("/pass:%s", value))
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("credential manager save: %w\n%s", err, out)
		}
		return nil
	default: // Linux — use secret-tool (libsecret/GNOME Keyring)
		cmd := exec.Command("secret-tool", "store",
			"--label", "Bough License",
			"service", keychainService,
			"account", keychainAccount)
		cmd.Stdin = strings.NewReader(value)
		if _, err := cmd.CombinedOutput(); err != nil {
			// Fallback: persist to a config-directory file.
			return saveLicenseFile(value)
		}
		return nil
	}
}

func loadString() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("security", "find-generic-password",
			"-s", keychainService, "-a", keychainAccount, "-w").Output()
		if err != nil {
			return "", nil // not found = no license
		}
		return strings.TrimSpace(string(out)), nil
	case "windows":
		// Windows Credential Manager does not expose a simple CLI read.
		// Fall back to file storage; TODO: replace with wincred binding.
		return loadLicenseFile()
	default: // Linux
		out, err := exec.Command("secret-tool", "lookup",
			"service", keychainService,
			"account", keychainAccount).Output()
		if err != nil {
			return loadLicenseFile()
		}
		return strings.TrimSpace(string(out)), nil
	}
}

func deleteString() error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("security", "delete-generic-password",
			"-s", keychainService, "-a", keychainAccount).Run()
	case "windows":
		return exec.Command("cmdkey",
			fmt.Sprintf("/delete:%s", keychainService)).Run()
	default:
		exec.Command("secret-tool", "clear",
			"service", keychainService,
			"account", keychainAccount).Run()
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
