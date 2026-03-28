import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWrapper } from '@/test/queryWrapper'
import { useWorktrees } from './useWorktrees'
import {
  ListWorktrees,
  AddWorktree,
  RemoveWorktree,
  SwitchWorktree,
} from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
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
  vi.mocked(EventsOn).mockReturnValue(vi.fn())
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

    expect(EventsOn).toHaveBeenCalledWith('repo:worktrees-changed', expect.any(Function))
  })

  it('unsubscribes from event on unmount', async () => {
    const unsub = vi.fn()
    vi.mocked(EventsOn).mockReturnValue(unsub)
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
