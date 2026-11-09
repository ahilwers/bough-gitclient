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

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWrapper } from '@/test/queryWrapper'
import { useFileDiff } from './useFileDiff'
import { GetFileDiff } from '@bindings/gitmorrow/app'
import { Events } from '@wailsio/runtime'
import type { DiffFile } from '@/lib/types'

const makeDiff = (overrides: Partial<DiffFile> = {}): DiffFile => ({
  path: 'foo.ts', oldPath: '',
  hunks: [], binary: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Events.On).mockReturnValue(vi.fn())
})

describe('useFileDiff', () => {
  it('returns diff data from the backend', async () => {
    const diff = makeDiff({ path: 'src/app.ts', hunks: [] })
    vi.mocked(GetFileDiff).mockResolvedValue(diff)

    const { result } = renderHook(() => useFileDiff('src/app.ts', false), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.path).toBe('src/app.ts')
  })

  it('passes staged=false to GetFileDiff', async () => {
    vi.mocked(GetFileDiff).mockResolvedValue(makeDiff())

    const { result } = renderHook(() => useFileDiff('file.ts', false), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(GetFileDiff).toHaveBeenCalledWith('file.ts', false)
  })

  it('passes staged=true to GetFileDiff', async () => {
    vi.mocked(GetFileDiff).mockResolvedValue(makeDiff())

    const { result } = renderHook(() => useFileDiff('file.ts', true), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(GetFileDiff).toHaveBeenCalledWith('file.ts', true)
  })

  it('is disabled when filePath is null', () => {
    const { result } = renderHook(() => useFileDiff(null, false), { wrapper: createWrapper() })

    expect(result.current.isPending).toBe(true)
    expect(GetFileDiff).not.toHaveBeenCalled()
  })

  it('subscribes to repo:changed on mount', async () => {
    vi.mocked(GetFileDiff).mockResolvedValue(makeDiff())

    const { result } = renderHook(() => useFileDiff('f.ts', false), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Events.On).toHaveBeenCalledWith('repo:changed', expect.any(Function))
  })

  it('calls the unsubscribe function on unmount', async () => {
    const unsubscribe = vi.fn()
    vi.mocked(Events.On).mockReturnValue(unsubscribe)
    vi.mocked(GetFileDiff).mockResolvedValue(makeDiff())

    const { result, unmount } = renderHook(() => useFileDiff('f.ts', false), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
