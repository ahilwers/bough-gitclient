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

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWrapper } from '@/test/queryWrapper'
import { useCommitFiles } from './useCommitFiles'
import { GetCommitDiff } from '@bindings/bough/app'
import type { DiffFile } from '@/lib/types'

const makeDiffFile = (path: string): DiffFile => ({
  path,
  oldPath: '',
  hunks: [{ header: '@@ -1,1 +1,2 @@', oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [
    { type: 'del', content: 'old', oldNo: 1, newNo: 0 },
    { type: 'add', content: 'new', oldNo: 0, newNo: 1 },
  ]}],
  binary: false,
})

beforeEach(() => vi.clearAllMocks())

describe('useCommitFiles', () => {
  it('returns files changed in the commit', async () => {
    vi.mocked(GetCommitDiff).mockResolvedValue([makeDiffFile('src/main.go'), makeDiffFile('README.md')])

    const { result } = renderHook(() => useCommitFiles('abc1234'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].path).toBe('src/main.go')
  })

  it('calls GetCommitDiff with the given hash', async () => {
    vi.mocked(GetCommitDiff).mockResolvedValue([])

    const { result } = renderHook(() => useCommitFiles('def5678'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(GetCommitDiff).toHaveBeenCalledWith('def5678')
  })

  it('returns empty array when backend returns null', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(GetCommitDiff).mockResolvedValue(null as any)

    const { result } = renderHook(() => useCommitFiles('abc1234'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('does not fetch when hash is null', () => {
    const { result } = renderHook(() => useCommitFiles(null), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(GetCommitDiff).not.toHaveBeenCalled()
  })

  it('exposes add/del line counts via hunks', async () => {
    vi.mocked(GetCommitDiff).mockResolvedValue([makeDiffFile('app.go')])

    const { result } = renderHook(() => useCommitFiles('abc1234'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const file = result.current.data![0]
    const addLines = file.hunks.flatMap(h => h.lines).filter(l => l.type === 'add')
    const delLines = file.hunks.flatMap(h => h.lines).filter(l => l.type === 'del')
    expect(addLines).toHaveLength(1)
    expect(delLines).toHaveLength(1)
  })
})
