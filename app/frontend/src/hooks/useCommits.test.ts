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
import { useCommits } from './useCommits'
import { useGitStore } from '@/stores/gitStore'
import { GetCommits } from '@bindings/gitmorrow/app'
import { Events } from '@wailsio/runtime'
import type { CommitNode } from '@/lib/types'

const makeCommit = (overrides: Partial<CommitNode> = {}): CommitNode => ({
  hash: 'abc1234567890abcdef1234567890abcdef1234ab',
  shortHash: 'abc1234',
  message: 'Fix bug',
  fullMessage: 'Fix bug',
  author: 'Alice',
  email: 'alice@example.com',
  date: new Date().toISOString(),
  parents: [],
  refs: [],
  column: 0,
  color: 0,
  lines: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Events.On).mockReturnValue(vi.fn())
  // The hook only queries the backend when a repo is open.
  useGitStore.setState({ activeRepo: '/repo' })
})

describe('useCommits', () => {
  it('returns commits from the backend', async () => {
    const commits = [makeCommit({ message: 'Fix bug' }), makeCommit({ hash: 'def5678', shortHash: 'def5678', message: 'Add feature' })]
    vi.mocked(GetCommits).mockResolvedValue(commits)

    const { result } = renderHook(() => useCommits(100), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].message).toBe('Fix bug')
  })

  it('passes the limit to GetCommits', async () => {
    vi.mocked(GetCommits).mockResolvedValue([])

    const { result } = renderHook(() => useCommits(250), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(GetCommits).toHaveBeenCalledWith(250, true)
  })

  it('returns empty array when backend returns null', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(GetCommits).mockResolvedValue(null as any)

    const { result } = renderHook(() => useCommits(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('subscribes to repo:changed on mount', async () => {
    vi.mocked(GetCommits).mockResolvedValue([])

    const { result } = renderHook(() => useCommits(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Events.On).toHaveBeenCalledWith('repo:changed', expect.any(Function))
  })

  it('calls the unsubscribe function on unmount', async () => {
    const unsubscribe = vi.fn()
    vi.mocked(Events.On).mockReturnValue(unsubscribe)
    vi.mocked(GetCommits).mockResolvedValue([])

    const { result, unmount } = renderHook(() => useCommits(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
