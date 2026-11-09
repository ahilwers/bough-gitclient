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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { useGitStore } from './gitStore'

beforeEach(() => {
  // Reset store to initial state between tests
  useGitStore.setState({
    activeView: 'history',
    showSidebar: true,
    flash: null,
    activeRepo: null,
    recentRepos: [],
    worktrees: [],
    activeWorktree: null,
    selectedCommit: null,
    selectedFile: null,
  })
})

describe('theme', () => {
  it('toggleTheme cycles light → dark → system → light', () => {
    useGitStore.setState({ theme: 'light' })
    act(() => useGitStore.getState().toggleTheme())
    expect(useGitStore.getState().theme).toBe('dark')

    act(() => useGitStore.getState().toggleTheme())
    expect(useGitStore.getState().theme).toBe('system')

    act(() => useGitStore.getState().toggleTheme())
    expect(useGitStore.getState().theme).toBe('light')
  })

  it('setTheme sets an explicit value and updates resolvedTheme', () => {
    act(() => useGitStore.getState().setTheme('dark'))
    expect(useGitStore.getState().theme).toBe('dark')
    expect(useGitStore.getState().resolvedTheme).toBe('dark')

    act(() => useGitStore.getState().setTheme('light'))
    expect(useGitStore.getState().theme).toBe('light')
    expect(useGitStore.getState().resolvedTheme).toBe('light')
  })

  it('setTheme("system") makes resolvedTheme follow the OS', () => {
    act(() => useGitStore.getState().setTheme('system'))
    expect(useGitStore.getState().theme).toBe('system')
    // jsdom mocks matchMedia with matches: false → resolves to light
    expect(useGitStore.getState().resolvedTheme).toBe('light')
  })

  it('syncSystemTheme re-resolves the system preference on OS changes', () => {
    act(() => useGitStore.getState().setTheme('system'))

    // Simulate the OS switching to dark mode
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    act(() => useGitStore.getState().syncSystemTheme())
    expect(useGitStore.getState().resolvedTheme).toBe('dark')

    // And back to light
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    act(() => useGitStore.getState().syncSystemTheme())
    expect(useGitStore.getState().resolvedTheme).toBe('light')
  })

  it('an explicit preference is not affected by syncSystemTheme', () => {
    act(() => useGitStore.getState().setTheme('dark'))
    act(() => useGitStore.getState().syncSystemTheme())
    expect(useGitStore.getState().resolvedTheme).toBe('dark')
  })
})

describe('theme startup default', () => {
  // jsdom (in this setup) has no window.localStorage; install a minimal fake
  // so we can exercise the store's persistence logic.
  function fakeLocalStorage(entries: Record<string, string> = {}) {
    const data = new Map(Object.entries(entries))
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
        setItem: (k: string, v: string) => { data.set(k, v) },
      },
    })
  }

  it('defaults to "system" when nothing is stored', async () => {
    fakeLocalStorage()
    vi.resetModules()
    const { useGitStore: freshStore } = await import('./gitStore')
    expect(freshStore.getState().theme).toBe('system')
  })

  it('respects an explicitly stored light/dark preference from the previous version', async () => {
    fakeLocalStorage({ theme: 'dark' })
    vi.resetModules()
    const { useGitStore: freshStore } = await import('./gitStore')
    expect(freshStore.getState().theme).toBe('dark')
    expect(freshStore.getState().resolvedTheme).toBe('dark')
  })
})

describe('view', () => {
  it('setView updates activeView', () => {
    act(() => useGitStore.getState().setView('changes'))
    expect(useGitStore.getState().activeView).toBe('changes')
  })
})

describe('selectedCommit', () => {
  it('updates when setSelectedCommit is called', () => {
    act(() => useGitStore.getState().setSelectedCommit('abc1234'))
    expect(useGitStore.getState().selectedCommit).toBe('abc1234')
  })

  it('clears selectedFile when commit changes', () => {
    act(() => {
      useGitStore.getState().setSelectedFile('src/main.go')
      useGitStore.getState().setSelectedCommit('new-hash')
    })
    expect(useGitStore.getState().selectedFile).toBeNull()
  })

  it('can be cleared by passing null', () => {
    act(() => useGitStore.getState().setSelectedCommit('abc1234'))
    act(() => useGitStore.getState().setSelectedCommit(null))
    expect(useGitStore.getState().selectedCommit).toBeNull()
  })
})

describe('selectedFile', () => {
  it('updates when setSelectedFile is called', () => {
    act(() => useGitStore.getState().setSelectedFile('src/main.tsx'))
    expect(useGitStore.getState().selectedFile).toBe('src/main.tsx')
  })

  it('does NOT clear selectedCommit when file changes', () => {
    act(() => useGitStore.getState().setSelectedCommit('hash123'))
    act(() => useGitStore.getState().setSelectedFile('README.md'))
    expect(useGitStore.getState().selectedCommit).toBe('hash123')
  })
})

describe('activeRepo', () => {
  it('setActiveRepo updates activeRepo and prepends to recentRepos', () => {
    act(() => useGitStore.getState().setActiveRepo('/path/to/repo'))
    expect(useGitStore.getState().activeRepo).toBe('/path/to/repo')
    expect(useGitStore.getState().recentRepos[0]).toBe('/path/to/repo')
  })

  it('does not duplicate repos in recentRepos', () => {
    act(() => {
      useGitStore.getState().setActiveRepo('/path/a')
      useGitStore.getState().setActiveRepo('/path/b')
      useGitStore.getState().setActiveRepo('/path/a')
    })
    const recent = useGitStore.getState().recentRepos
    expect(recent[0]).toBe('/path/a')
    expect(recent.filter(r => r === '/path/a').length).toBe(1)
  })

  it('caps recentRepos at 10 entries', () => {
    act(() => {
      for (let i = 0; i < 15; i++) {
        useGitStore.getState().setActiveRepo(`/repo/${i}`)
      }
    })
    expect(useGitStore.getState().recentRepos.length).toBe(10)
  })
})

describe('showSidebar', () => {
  it('defaults to true', () => {
    expect(useGitStore.getState().showSidebar).toBe(true)
  })

  it('setShowSidebar toggles visibility', () => {
    act(() => useGitStore.getState().setShowSidebar(false))
    expect(useGitStore.getState().showSidebar).toBe(false)
    act(() => useGitStore.getState().setShowSidebar(true))
    expect(useGitStore.getState().showSidebar).toBe(true)
  })
})

describe('setActiveView', () => {
  it('is an alias for setView', () => {
    act(() => useGitStore.getState().setActiveView('changes'))
    expect(useGitStore.getState().activeView).toBe('changes')
  })
})

describe('flash', () => {
  it('showFlash sets the flash message', () => {
    act(() => useGitStore.getState().showFlash('Committed!'))
    const flash = useGitStore.getState().flash
    expect(flash?.message).toBe('Committed!')
    expect(flash?.type).toBe('success') // default type
  })

  it('showFlash accepts an explicit type', () => {
    act(() => useGitStore.getState().showFlash('Error occurred', 'danger'))
    expect(useGitStore.getState().flash?.type).toBe('danger')
  })

  it('clearFlash removes the message', () => {
    act(() => useGitStore.getState().showFlash('hello'))
    act(() => useGitStore.getState().clearFlash())
    expect(useGitStore.getState().flash).toBeNull()
  })
})
