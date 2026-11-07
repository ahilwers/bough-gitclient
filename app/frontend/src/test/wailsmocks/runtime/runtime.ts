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

import { vi } from 'vitest'

// EventsOn returns an unsubscribe function — default returns a no-op vi.fn()
export const EventsOn = vi.fn((_event: string, _callback: (...data: unknown[]) => void) => vi.fn())
export const EventsOff = vi.fn()
export const EventsEmit = vi.fn()
export const BrowserOpenURL = vi.fn()
export const LogDebug = vi.fn()
export const LogError = vi.fn()
