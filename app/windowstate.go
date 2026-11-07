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

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const (
	defaultWidth  = 1280
	defaultHeight = 800
	minWidth      = 900
	minHeight     = 600
)

type savedWindowState struct {
	Width  int  `json:"width"`
	Height int  `json:"height"`
	X      int  `json:"x"`
	Y      int  `json:"y"`
	HasPos bool `json:"hasPos"` // false on first launch → let the OS centre the window
}

func windowStatePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "Bough", "window.json"), nil
}

// loadWindowState returns the persisted window state, falling back to safe
// defaults if the file does not exist or cannot be parsed.
func loadWindowState() savedWindowState {
	path, err := windowStatePath()
	if err != nil {
		return savedWindowState{Width: defaultWidth, Height: defaultHeight}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return savedWindowState{Width: defaultWidth, Height: defaultHeight}
	}
	var s savedWindowState
	if err := json.Unmarshal(data, &s); err != nil {
		return savedWindowState{Width: defaultWidth, Height: defaultHeight}
	}
	// Clamp dimensions so a corrupted value never creates an unusable window.
	if s.Width < minWidth {
		s.Width = defaultWidth
	}
	if s.Height < minHeight {
		s.Height = defaultHeight
	}
	return s
}

// saveWindowState persists size and position to the config file.
func saveWindowState(width, height, x, y int) error {
	path, err := windowStatePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(savedWindowState{
		Width:  width,
		Height: height,
		X:      x,
		Y:      y,
		HasPos: true,
	})
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
