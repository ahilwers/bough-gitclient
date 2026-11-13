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

import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ChangesView from './ChangesView'

const STORAGE_KEY = 'changes-filelist-width'

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  client.setQueryData(['status'], { branch: 'main', ahead: 0, behind: 0, files: [], hasConflicts: false })
  return render(<QueryClientProvider client={client}><ChangesView /></QueryClientProvider>)
}

function fileList(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-panel="changes-filelist"]')!
}

function splitter(): HTMLElement {
  return screen.getByRole('separator', { name: 'Resize file list' })
}

describe('changes view file list width', () => {
  it('defaults to 240px and can be resized by dragging the splitter', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()
    expect(fileList().style.width).toBe('240px')

    fireEvent.mouseDown(splitter(), { clientX: 300 })
    act(() => { fireEvent.mouseMove(document, { clientX: 360 }) })
    act(() => { fireEvent.mouseUp(document) })

    expect(fileList().style.width).toBe('300px')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('300')
  })

  it('resizes with the keyboard', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()
    fireEvent.keyDown(splitter(), { key: 'ArrowRight' })
    expect(fileList().style.width).toBe('256px')
    fireEvent.keyDown(splitter(), { key: 'ArrowLeft' })
    expect(fileList().style.width).toBe('240px')
  })

  it('clamps the width to the allowed range', () => {
    localStorage.removeItem(STORAGE_KEY)
    renderView()
    fireEvent.mouseDown(splitter(), { clientX: 300 })
    act(() => { fireEvent.mouseMove(document, { clientX: 2000 }) })
    act(() => { fireEvent.mouseUp(document) })
    expect(fileList().style.width).toBe('560px')

    fireEvent.mouseDown(splitter(), { clientX: 300 })
    act(() => { fireEvent.mouseMove(document, { clientX: -2000 }) })
    act(() => { fireEvent.mouseUp(document) })
    expect(fileList().style.width).toBe('160px')
  })

  it('restores a persisted width', () => {
    localStorage.setItem(STORAGE_KEY, '333')
    renderView()
    expect(fileList().style.width).toBe('333px')
    localStorage.removeItem(STORAGE_KEY)
  })
})
