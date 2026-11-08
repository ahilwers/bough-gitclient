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

import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWrapper } from '@/test/queryWrapper'
import { useWorktrees } from './useWorktrees'
import { useGitStore } from '@/stores/gitStore'
import {
  ListWorktrees,
  AddWorktree,
  RemoveWorktree,
  SwitchWorktree,
} from '@bindings/bough/app'
import { Events } from '@wailsio/runtime'
import type { WorktreeInfo } from '@/lib/types'

const makeWorktree = (overrides: Partial<WorktreeInfo> = {}): WorktreeInfo => ({
  path: '/home/user/myrepo',
  branch: 'main',
  head: 'abc1234',
  isMain: true,
  isDirty: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Events.On).mockReturnValue(vi.fn())
  // The hook only queries the backend when a repo is open.
  useGitStore.setState({ activeRepo: '/repo' })
})

describe('useWorktrees', () => {
  it('returns worktrees from the backend', async () => {
    const wts = [
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({ path: '/repo-feat', branch: 'feature/x', isMain: false }),
    ]
    vi.mocked(ListWorktrees).mockResolvedValue(wts)

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].branch).toBe('main')
    expect(result.current.data![1].branch).toBe('feature/x')
  })

  it('returns empty array when backend returns empty list', async () => {
    vi.mocked(ListWorktrees).mockResolvedValue([])

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('subscribes to repo:worktrees-changed on mount', async () => {
    vi.mocked(ListWorktrees).mockResolvedValue([])

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Events.On).toHaveBeenCalledWith('repo:worktrees-changed', expect.any(Function))
  })

  it('unsubscribes from event on unmount', async () => {
    const unsub = vi.fn()
    vi.mocked(Events.On).mockReturnValue(unsub)
    vi.mocked(ListWorktrees).mockResolvedValue([])

    const { result, unmount } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    unmount()
    expect(unsub).toHaveBeenCalledOnce()
  })

  it('addMutation calls AddWorktree with path and branch', async () => {
    vi.mocked(ListWorktrees).mockResolvedValue([])
    vi.mocked(AddWorktree).mockResolvedValue(undefined)

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      await result.current.addMutation.mutateAsync({ path: '/new-wt', branch: 'feature/new' })
    })

    expect(AddWorktree).toHaveBeenCalledWith('/new-wt', 'feature/new')
  })

  it('removeMutation calls RemoveWorktree with path', async () => {
    vi.mocked(ListWorktrees).mockResolvedValue([makeWorktree({ path: '/repo-feat', isMain: false })])
    vi.mocked(RemoveWorktree).mockResolvedValue(undefined)

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      await result.current.removeMutation.mutateAsync('/repo-feat')
    })

    expect(RemoveWorktree).toHaveBeenCalledWith('/repo-feat')
  })

  it('switchMutation calls SwitchWorktree with path', async () => {
    vi.mocked(ListWorktrees).mockResolvedValue([makeWorktree()])
    vi.mocked(SwitchWorktree).mockResolvedValue(undefined)

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      await result.current.switchMutation.mutateAsync('/repo-feat')
    })

    expect(SwitchWorktree).toHaveBeenCalledWith('/repo-feat')
  })

  it('isDirty worktree is reflected in the data', async () => {
    vi.mocked(ListWorktrees).mockResolvedValue([
      makeWorktree({ path: '/clean', isDirty: false }),
      makeWorktree({ path: '/dirty', isDirty: true, isMain: false }),
    ])

    const { result } = renderHook(() => useWorktrees(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data![0].isDirty).toBe(false)
    expect(result.current.data![1].isDirty).toBe(true)
  })
})
