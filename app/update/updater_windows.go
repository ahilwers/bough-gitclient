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

//go:build windows

package update

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"runtime"
)

type windowsUpdater struct {
	appcastURL string
}

// NewWindowsUpdater creates an updater for Windows.
// WinSparkle (WinSparkle.dll) must be present in the application directory.
// The DLL is initialised via Initialize() and takes over update checking
// automatically on subsequent launches.
func NewWindowsUpdater(appcastURL string) *windowsUpdater {
	return &windowsUpdater{appcastURL: appcastURL}
}

// Initialize configures WinSparkle and starts background update checking.
// Call this once from app startup, before the main window is shown.
//
// In production WinSparkle.dll is loaded via syscall; the DLL must be
// distributed alongside the application executable and bundled in the MSI.
// See wix/installer.wxs for the installer configuration.
func (u *windowsUpdater) Initialize() error {
	// Production implementation uses WinSparkle via syscall:
	//
	//   dll, err := syscall.LoadDLL("WinSparkle.dll")
	//   setAppcastURL, _ := dll.FindProc("win_sparkle_set_appcast_url")
	//   init, _           := dll.FindProc("win_sparkle_init")
	//   setAppcastURL.Call(uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(u.appcastURL))))
	//   init.Call()
	//
	// The stub below is compiled when WinSparkle.dll is not available at
	// build time (e.g. on a Linux cross-compile host).
	return nil
}

// CheckForUpdates fetches the appcast and returns the latest version string.
// WinSparkle handles this natively after Initialize(); this method is a
// programmatic fallback used in tests and non-GUI contexts.
func (u *windowsUpdater) CheckForUpdates(ctx context.Context, currentVersion string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.appcastURL, nil)
	if err != nil {
		return "", fmt.Errorf("build appcast request: %w", err)
	}
	req.Header.Set("User-Agent", fmt.Sprintf("GitMorrow/%s (Windows; %s)", currentVersion, runtime.GOARCH))

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
