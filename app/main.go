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
	"embed"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

// version is set at build time via -ldflags
var version = "dev"

func main() {
	svc := NewApp()

	app := application.New(application.Options{
		Name:        "GitMorrow",
		Description: "A beautiful Git GUI client",
		Services: []application.Service{
			application.NewServiceWithOptions(svc, application.ServiceOptions{MarshalError: svc.marshalDiagnosticError}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	// Hand the service the application handle so it can emit events, open
	// dialogs and read the window without a v3 runtime context.
	svc.app = app

	// Native menu bar: "About GitMorrow" lives in the application menu on macOS and
	// in the Help menu elsewhere.
	app.Menu.Set(buildApplicationMenu(app))

	ws := loadWindowState()

	windowOpts := application.WebviewWindowOptions{
		Name:             "main",
		Title:            "GitMorrow",
		Width:            ws.Width,
		Height:           ws.Height,
		MinWidth:         900,
		MinHeight:        600,
		BackgroundColour: application.NewRGB(28, 28, 30),
		Mac: application.MacWindow{
			TitleBar:   application.MacTitleBarDefault,
			Appearance: application.DefaultAppearance,
		},
		Windows: application.WindowsWindow{
			Theme: application.SystemDefault,
		},
		// On Windows/Linux a window only shows the application menu when this
		// is set; macOS always uses the global menu bar.
		UseApplicationMenu: true,
	}
	// Opt-in native macOS Liquid Glass backdrop (`-tags liquidglass`). No-op in
	// regular builds and on other platforms.
	applyLiquidGlassWindow(&windowOpts)

	// Restore a persisted window position (size is set above). On first launch
	// the OS centres the window.
	if ws.HasPos {
		windowOpts.InitialPosition = application.WindowXY
		windowOpts.X = ws.X
		windowOpts.Y = ws.Y
	}
	window := app.Window.NewWithOptions(windowOpts)

	// Save size + position on close so that moving the window without
	// resizing is also persisted (there is no "move" event in the frontend).
	// The event name differs per platform, so register all three; only the
	// active platform's event fires.
	saveState := func() {
		w, h := window.Size()
		x, y := window.Position()
		_ = saveWindowState(w, h, x, y)
	}
	window.OnWindowEvent(events.Mac.WindowShouldClose, func(*application.WindowEvent) { saveState() })
	window.OnWindowEvent(events.Windows.WindowClosing, func(*application.WindowEvent) { saveState() })
	window.OnWindowEvent(events.Linux.WindowDeleteEvent, func(*application.WindowEvent) { saveState() })

	if err := app.Run(); err != nil {
		println("Error:", err.Error())
	}
}
