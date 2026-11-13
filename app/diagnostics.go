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

package main

import (
	"encoding/json"
	"errors"
	"os"
	"runtime"

	"gitmorrow/internal/diagnostics"
	"gitmorrow/internal/sysproc"
)

func (a *App) diagnosticService() *diagnostics.Service {
	a.diagnosticOnce.Do(func() {
		home, _ := os.UserHomeDir()
		a.diagnosticDir = diagnostics.Directory(runtime.GOOS, home, os.Getenv("XDG_STATE_HOME"), os.Getenv("LOCALAPPDATA"))
		a.diagnostics = diagnostics.NewService(a.diagnosticDir)
	})
	return a.diagnostics
}

// MarshalError captures safe metadata for returned errors, without logging.
// ReportDiagnostic acknowledges actual display, excluding swallowed IPC retries.
// Git Failure.Error() is safe too: Wails independently sends it
// in CallError.Message, regardless of the custom cause marshaler.
func (a *App) marshalDiagnosticError(err error) []byte {
	info := a.diagnosticService().Capture(err)
	if info == nil {
		return nil
	}
	data, _ := json.Marshal(info)
	return data
}
func (a *App) ReportDiagnostic(id string)                { a.diagnosticService().Display(id) }
func (a *App) GetDiagnostic(id string) *diagnostics.Info { return a.diagnosticService().Get(id) }
func (a *App) GetDiagnosticSettings() diagnostics.Status { return a.diagnosticService().Status() }
func (a *App) SetDiagnosticLogging(enabled bool) error {
	return a.diagnosticService().SetEnabled(enabled)
}

// No raw diagnostic ever crosses IPC, including when copied. Clipboard managers
// may retain copied text; the UI must warn before asking for this one-shot action.
func (a *App) CopyRawDiagnostic(id string, confirmed bool) error {
	return a.diagnosticService().Copy(id, confirmed, func(raw string) bool {
		return a.app != nil && a.app.Clipboard.SetText(raw)
	})
}
func (a *App) OpenDiagnosticFolder() error {
	service := a.diagnosticService()
	if service.Status().Reason == "protection" || a.diagnosticDir == "" {
		return errors.New("protected log folder unavailable")
	}
	var name string
	var args []string
	switch runtime.GOOS {
	case "windows":
		name = "explorer.exe"
		args = []string{a.diagnosticDir}
	case "darwin":
		name = "open"
		args = []string{a.diagnosticDir}
	default:
		name = "xdg-open"
		args = []string{a.diagnosticDir}
	}
	if err := sysproc.Command(name, args...).Run(); err != nil {
		return errors.New("could not open log folder")
	}
	return nil
}
