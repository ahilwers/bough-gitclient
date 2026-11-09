// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

package git

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"bough/internal/sysproc"
)

// ErrAuthFailed is returned when a CLI-git operation fails due to authentication.
var ErrAuthFailed = errors.New("git: authentication failed")

// EnsureCredentialHelper checks whether a global credential.helper is configured.
// If not, it sets the OS-native default. Called once at app startup.
func EnsureCredentialHelper() error {
	lookup := sysproc.Command("git", "config", "--global", "credential.helper")
	out, _ := lookup.Output()
	current := strings.TrimSpace(string(out))
	if current != "" {
		return nil // already configured
	}

	var helper string
	switch runtime.GOOS {
	case "darwin":
		helper = "osxkeychain"
	case "windows":
		if _, err := exec.LookPath("git-credential-manager"); err == nil {
			helper = "manager"
		} else {
			helper = "wincred"
		}
	default: // linux
		if _, err := exec.LookPath("git-credential-libsecret"); err == nil {
			helper = "libsecret"
		} else {
			helper = "store"
		}
	}

	if helper == "" {
		return nil
	}

	cmd := sysproc.Command("git", "config", "--global", "credential.helper", helper)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("could not set credential helper %q: %w\n%s", helper, err, out)
	}
	return nil
}

// EnsureSSHAgent injects SSH_AUTH_SOCK on macOS .app bundles launched via launchd,
// which do not inherit the SSH agent socket from the user's terminal session.
func EnsureSSHAgent() {
	if os.Getenv("SSH_AUTH_SOCK") != "" {
		return // already set (e.g. launched from terminal)
	}
	out, err := sysproc.Command("launchctl", "getenv", "SSH_AUTH_SOCK").Output()
	if err == nil {
		sock := strings.TrimSpace(string(out))
		if sock != "" {
			os.Setenv("SSH_AUTH_SOCK", sock)
		}
	}
}

// IsAuthError inspects a git CLI error message and returns true if it indicates
// an authentication failure.
func IsAuthError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	triggers := []string{
		"authentication failed",
		"could not read username",
		"could not read password",
		"permission denied (publickey",
		"invalid username or password",
		"http basic: access denied",
		"fatal: repository not found",
		"remote: invalid username",
	}
	for _, t := range triggers {
		if strings.Contains(msg, t) {
			return true
		}
	}
	return false
}

// StoreCredentials writes a username/password pair for a given URL into the
// configured credential helper via `git credential approve`.
func StoreCredentials(repoURL, username, password string) error {
	proto, host := parseURLParts(repoURL)
	if proto == "" || host == "" {
		return nil // SSH URL — no credential storage needed
	}
	input := fmt.Sprintf("protocol=%s\nhost=%s\nusername=%s\npassword=%s\n\n",
		proto, host, username, password)

	cmd := sysproc.Command("git", "credential", "approve")
	cmd.Stdin = strings.NewReader(input)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git credential approve: %w\n%s", err, out)
	}
	return nil
}

// parseURLParts extracts protocol and host from HTTPS remote URLs.
func parseURLParts(rawURL string) (protocol, host string) {
	if strings.HasPrefix(rawURL, "https://") {
		rest := strings.TrimPrefix(rawURL, "https://")
		parts := strings.SplitN(rest, "/", 2)
		return "https", parts[0]
	}
	if strings.HasPrefix(rawURL, "http://") {
		rest := strings.TrimPrefix(rawURL, "http://")
		parts := strings.SplitN(rest, "/", 2)
		return "http", parts[0]
	}
	return "", ""
}
