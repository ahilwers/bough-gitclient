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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGitStore } from '@/stores/gitStore'
import App from './App'

// The real sidebar is under test here, the views are not.
vi.mock('@/components/HistoryView/HistoryView', () => ({ default: () => <div>History view</div> }))
vi.mock('@/components/ChangesView/ChangesView', () => ({ default: () => <div>Changes view</div> }))
vi.mock('@/components/shared/CommandPalette', () => ({ default: () => null }))

const STORAGE_KEY = 'sidebar-width'

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><App /></QueryClientProvider>)
}

function sidebar(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-panel="sidebar"]')!
}

function splitter(): HTMLElement {
  return screen.getByRole('separator', { name: 'Resize sidebar' })
}

describe('sidebar width', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitStore.setState({ activeView: 'history', activeRepo: '/repo', recentRepos: [], flash: null, showSidebar: true })
  })

  afterEach(() => cleanup())

  it('defaults to 200px and can be resized by dragging the splitter', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderApp()
    expect(sidebar().style.width).toBe('200px')

    fireEvent.mouseDown(splitter(), { clientX: 200 })
    act(() => { fireEvent.mouseMove(document, { clientX: 260 }) })
    act(() => { fireEvent.mouseUp(document) })

    expect(sidebar().style.width).toBe('260px')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('260')
  })

  it('resizes with the keyboard and resets on Home', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderApp()

    fireEvent.keyDown(splitter(), { key: 'ArrowRight' })
    expect(sidebar().style.width).toBe('216px')
    fireEvent.keyDown(splitter(), { key: 'ArrowLeft' })
    expect(sidebar().style.width).toBe('200px')

    fireEvent.keyDown(splitter(), { key: 'ArrowRight' })
    fireEvent.keyDown(splitter(), { key: 'Home' })
    expect(sidebar().style.width).toBe('200px')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('200')
  })

  it('clamps the width to the allowed range', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderApp()

    fireEvent.mouseDown(splitter(), { clientX: 200 })
    act(() => { fireEvent.mouseMove(document, { clientX: 5000 }) })
    act(() => { fireEvent.mouseUp(document) })
    expect(sidebar().style.width).toBe('420px')

    fireEvent.mouseDown(splitter(), { clientX: 200 })
    act(() => { fireEvent.mouseMove(document, { clientX: -5000 }) })
    act(() => { fireEvent.mouseUp(document) })
    expect(sidebar().style.width).toBe('160px')
  })

  it('restores a stored width and falls back to the default for garbage', () => {
    localStorage.setItem(STORAGE_KEY, '248')
    renderApp()
    expect(sidebar().style.width).toBe('248px')
    cleanup()

    localStorage.setItem(STORAGE_KEY, 'oops')
    renderApp()
    expect(sidebar().style.width).toBe('200px')
  })

  it('has no splitter while the sidebar is hidden', () => {
    localStorage.removeItem(STORAGE_KEY)
    useGitStore.setState({ showSidebar: false })
    renderApp()

    expect(document.querySelector('[data-panel="sidebar"]')).toBeNull()
    expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).not.toBeInTheDocument()
  })
})
