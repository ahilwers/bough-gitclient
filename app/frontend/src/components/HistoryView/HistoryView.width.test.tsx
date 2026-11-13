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

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HistoryView from './HistoryView'

const STORAGE_KEY = 'history-split-left'

// jsdom has no ResizeObserver; the commit list only needs it to measure itself.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

afterEach(() => cleanup())

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  client.setQueryData(['status'], { branch: 'main', ahead: 0, behind: 0, files: [], hasConflicts: false })
  return render(<QueryClientProvider client={client}><HistoryView /></QueryClientProvider>)
}

function commitList(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-panel="history-commitlist"]')!
}

function splitter(): HTMLElement {
  return screen.getByRole('separator', { name: 'Resize commit list' })
}

describe('history view commit list width', () => {
  it('defaults to 500px and can be resized by dragging the splitter', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()
    expect(commitList().style.width).toBe('500px')

    fireEvent.mouseDown(splitter(), { clientX: 600 })
    act(() => { fireEvent.mouseMove(document, { clientX: 660 }) })
    act(() => { fireEvent.mouseUp(document) })

    expect(commitList().style.width).toBe('560px')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('560')
  })

  it('resizes with the keyboard and resets on Home', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()

    fireEvent.keyDown(splitter(), { key: 'ArrowRight' })
    expect(commitList().style.width).toBe('516px')
    fireEvent.keyDown(splitter(), { key: 'ArrowLeft' })
    expect(commitList().style.width).toBe('500px')

    fireEvent.keyDown(splitter(), { key: 'ArrowRight' })
    fireEvent.keyDown(splitter(), { key: 'Home' })
    expect(commitList().style.width).toBe('500px')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('500')
  })

  it('clamps the width to the allowed range', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()

    fireEvent.mouseDown(splitter(), { clientX: 600 })
    act(() => { fireEvent.mouseMove(document, { clientX: 5000 }) })
    act(() => { fireEvent.mouseUp(document) })
    expect(commitList().style.width).toBe('700px')

    fireEvent.mouseDown(splitter(), { clientX: 600 })
    act(() => { fireEvent.mouseMove(document, { clientX: -5000 }) })
    act(() => { fireEvent.mouseUp(document) })
    expect(commitList().style.width).toBe('220px')
  })

  it('restores a stored width and falls back to the default for garbage', () => {
    localStorage.setItem(STORAGE_KEY, '420')
    renderView()
    expect(commitList().style.width).toBe('420px')
    cleanup()

    localStorage.setItem(STORAGE_KEY, 'not-a-number')
    renderView()
    expect(commitList().style.width).toBe('500px')
  })

  it('is resizable while no commit is open', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()
    expect(screen.getByText('Select a commit')).toBeInTheDocument()

    fireEvent.keyDown(splitter(), { key: 'ArrowRight' })

    expect(commitList().style.width).toBe('516px')
  })
})
