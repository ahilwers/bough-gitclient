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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wails from '@wailsio/runtime/plugins/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss(), wails('./bindings')],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@bindings': path.resolve(import.meta.dirname, './bindings'),
    },
  },
  server: {
    // Bind to IPv4: the Wails v3 dev proxy (and most tooling) resolves
    // 127.0.0.1 explicitly, while Vite otherwise defaults to ::1 on macOS.
    // The reference template sets this for the same reason.
    host: '127.0.0.1',
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
})
