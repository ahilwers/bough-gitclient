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

// Stand-in for the `@wailsio/runtime` npm package in jsdom tests. The real
// package initialises browser bridges at import time, so tests resolve this
// module instead (see the alias in vitest.config.ts).

// Events.On returns an unsubscribe function — default returns a no-op vi.fn().
export interface WailsEvent { name: string; data: unknown }

export const Events = {
  On: vi.fn((_name: string, _callback: (event: WailsEvent) => void) => vi.fn()),
  OnMultiple: vi.fn(() => vi.fn()),
  Once: vi.fn(() => vi.fn()),
  Off: vi.fn(),
  OffAll: vi.fn(),
  Emit: vi.fn(() => Promise.resolve(false)),
}

export const Call = {
  ByID: vi.fn(),
  ByName: vi.fn(),
}

export const WML = {
  Reload: vi.fn(),
}

export class CancellablePromise<T> extends Promise<T> {}
