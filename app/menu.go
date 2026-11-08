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
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// aboutEvent is emitted when the user picks "About Bough" from the native menu.
// The frontend listens for it and opens the in-app About dialog, which can show
// the version (the native about panel cannot).
const aboutEvent = "app:about"

// buildApplicationMenu installs the native menu bar. "About Bough" lives in the
// application menu on macOS (the menu named after the app, as platform
// convention dictates) and in the Help menu on Windows and Linux, where there
// is no application menu.
func buildApplicationMenu(app *application.App) *application.Menu {
	menu := app.Menu.New()
	showAbout := func(*application.Context) {
		app.Event.Emit(aboutEvent)
	}

	if runtime.GOOS == "darwin" {
		appMenu := menu.AddSubmenu(app.Config().Name)
		appMenu.Add("About Bough").OnClick(showAbout)
		appMenu.AddSeparator()
		appMenu.AddRole(application.ServicesMenu)
		appMenu.AddSeparator()
		appMenu.AddRole(application.Hide)
		appMenu.AddRole(application.HideOthers)
		appMenu.AddRole(application.UnHide)
		appMenu.AddSeparator()
		appMenu.AddRole(application.Quit)
	}

	menu.AddRole(application.FileMenu)
	menu.AddRole(application.EditMenu)
	menu.AddRole(application.ViewMenu)
	menu.AddRole(application.WindowMenu)

	help := menu.AddSubmenu("Help")
	if runtime.GOOS != "darwin" {
		help.Add("About Bough").OnClick(showAbout)
		help.AddSeparator()
	}
	help.Add("Keyboard Shortcuts").OnClick(func(*application.Context) {
		app.Event.Emit("app:keyboard-shortcuts")
	})
	help.Add("Bough Website").OnClick(func(*application.Context) {
		app.Browser.OpenURL("https://bough.app")
	})
	help.Add("Report an Issue").OnClick(func(*application.Context) {
		app.Browser.OpenURL("https://github.com/ahilwers/bough-gitclient/issues")
	})

	return menu
}
