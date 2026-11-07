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
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// version is set at build time via -ldflags
var version = "dev"

func main() {
	app := NewApp()
	ws := loadWindowState()

	err := wails.Run(&options.App{
		Title:            "Bough",
		Width:            ws.Width,
		Height:           ws.Height,
		MinWidth:         900,
		MinHeight:        600,
		BackgroundColour: &options.RGBA{R: 28, G: 28, B: 30, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		// Save size + position on close so that moving the window without
		// resizing is also persisted (there is no "move" event in the frontend).
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			w, h := wailsruntime.WindowGetSize(ctx)
			x, y := wailsruntime.WindowGetPosition(ctx)
			_ = saveWindowState(w, h, x, y)
			return false
		},
		Bind: []interface{}{app},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarDefault(),
			Appearance:           mac.DefaultAppearance,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
