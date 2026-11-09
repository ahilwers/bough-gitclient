// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

//go:build linux

package update

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"

	"gitmorrow/internal/sysproc"
)

type linuxUpdater struct {
	appcastURL string
}

// NewLinuxUpdater creates an updater for Linux using AppImageUpdate.
// The app must be running from an AppImage (APPIMAGE env var set by the runtime).
func NewLinuxUpdater(appcastURL string) *linuxUpdater {
	return &linuxUpdater{appcastURL: appcastURL}
}

// IsAppImage reports whether the process is running from an AppImage.
func IsAppImage() bool {
	return os.Getenv("APPIMAGE") != ""
}

// CheckForUpdates uses AppImageUpdate to check whether a newer version of the
// AppImage is available. Returns the latest version string from the appcast,
// or an empty string when already up to date.
func (u *linuxUpdater) CheckForUpdates(ctx context.Context, currentVersion string) (string, error) {
	// If AppImageUpdate binary is available, prefer its delta-update check.
	if IsAppImage() {
		appImage := os.Getenv("APPIMAGE")
		cmd := sysproc.CommandContext(ctx, "AppImageUpdate", "--check-for-updates", appImage)
		if err := cmd.Run(); err != nil {
			// Exit code 1 means "update available", 0 means "up to date".
			if cmd.ProcessState != nil && cmd.ProcessState.ExitCode() == 1 {
				// Fall through to HTTP check to get the version string.
			} else {
				return "", fmt.Errorf("AppImageUpdate check failed: %w", err)
			}
		}
	}

	// Fall back to HTTP appcast check to obtain the version string.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.appcastURL, nil)
	if err != nil {
		return "", fmt.Errorf("build appcast request: %w", err)
	}
	req.Header.Set("User-Agent", fmt.Sprintf("GitMorrow/%s (Linux; %s)", currentVersion, runtime.GOARCH))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch appcast: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("read appcast: %w", err)
	}

	return parseLatestVersion(body)
}

// InstallUpdate downloads and applies the AppImage update in-place using
// AppImageUpdate. The updated AppImage replaces the running one on disk;
// the user must restart the application.
func (u *linuxUpdater) InstallUpdate(ctx context.Context) error {
	appImage := os.Getenv("APPIMAGE")
	if appImage == "" {
		return fmt.Errorf("not running from an AppImage")
	}
	cmd := sysproc.CommandContext(ctx, "AppImageUpdate", appImage)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("AppImageUpdate failed: %w", err)
	}
	return nil
}

// appcastRSS is a minimal struct for parsing the appcast XML.
type appcastRSS struct {
	Items []struct {
		Enclosure struct {
			Version string `xml:"version,attr"`
		} `xml:"enclosure"`
	} `xml:"channel>item"`
}

func parseLatestVersion(data []byte) (string, error) {
	var feed appcastRSS
	if err := xml.Unmarshal(data, &feed); err != nil {
		return "", fmt.Errorf("parse appcast XML: %w", err)
	}
	if len(feed.Items) == 0 {
		return "", nil
	}
	return feed.Items[0].Enclosure.Version, nil
}
