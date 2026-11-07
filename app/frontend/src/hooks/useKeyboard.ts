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

import { useEffect } from 'react'
import { useGitStore } from '@/stores/gitStore'

export function useKeyboard() {
  const setActiveView = useGitStore((s) => s.setActiveView)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // ⌘K — open command palette
      if (mod && e.key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('palette:open'))
      }
      // ⌘1 — History view
      if (mod && e.key === '1') {
        e.preventDefault()
        setActiveView('history')
      }
      // ⌘2 — Changes view
      if (mod && e.key === '2') {
        e.preventDefault()
        setActiveView('changes')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveView])
}
