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

import '@testing-library/jest-dom'
import '../i18n'

// Mock the Wails runtime object that the real app gets injected by the WebView
Object.defineProperty(window, 'runtime', {
  value: {
    EventsOn: vi.fn(),
    EventsOff: vi.fn(),
    EventsEmit: vi.fn(),
    BrowserOpenURL: vi.fn(),
    LogDebug: vi.fn(),
    LogError: vi.fn(),
    LogWarning: vi.fn(),
  },
  writable: true,
})

// Suppress matchMedia not found in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
