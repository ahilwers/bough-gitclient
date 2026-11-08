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

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Redirect all @bindings imports to mocks in tests
      '@bindings': path.resolve(import.meta.dirname, 'src/test/wailsmocks/bindings'),
      // The real @wailsio/runtime package initialises browser bridges at import
      // time; tests use a lightweight stub instead.
      '@wailsio/runtime': path.resolve(import.meta.dirname, 'src/test/wailsmocks/wailsio-runtime.ts'),
    },
  },
})
