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

//go:build darwin && liquidglass && private_mac_apis

package main

import "github.com/wailsapp/wails/v3/pkg/application"

// glassFlagScript marks the document so index.css can switch the window chrome
// to translucent tokens. Wails executes it after the page loaded but before the
// window is shown, so there is no opaque flash.
const glassFlagScript = `document.documentElement.dataset.glass = 'true'`

// applyLiquidGlassWindow opts this build into Apple's Liquid Glass backdrop.
//
// macOS 26+ renders a native NSGlassEffectView; older versions fall back to a
// translucent NSVisualEffectView. The webview only becomes transparent - and
// therefore lets the glass through - when the binary is built with Wails'
// `private_mac_apis` tag, because that needs a private WebKit property. Both
// tags are therefore required: with `liquidglass` alone the window would turn
// its CSS chrome translucent over an opaque webview, which looks broken.
func applyLiquidGlassWindow(opts *application.WebviewWindowOptions) {
	// A transparent native window background is required for the glass layer
	// to be visible around the content.
	opts.BackgroundColour = application.RGBA{}

	opts.Mac.Backdrop = application.MacBackdropLiquidGlass
	opts.Mac.LiquidGlass = application.MacLiquidGlass{
		Style: application.LiquidGlassStyleAutomatic,
		// Matches the window edge radius of the design system (--r-lg).
		CornerRadius: 12,
	}

	// Extend the webview under the titlebar so the top chrome is glass too,
	// while keeping the native traffic lights. Dragging is handled in CSS
	// (--wails-draggable on .app-toolbar) instead of
	// Mac.InvisibleTitleBarHeight, because that one starts a native window
	// drag on every mouse-down in the strip and would swallow clicks on the
	// toolbar controls.
	opts.Mac.TitleBar = application.MacTitleBarHidden

	opts.JS = glassFlagScript
}
