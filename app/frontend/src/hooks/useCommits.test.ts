import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWrapper } from '@/test/queryWrapper'
import { useCommits } from './useCommits'
import { GetCommits } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
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
  vi.mocked(EventsOn).mockReturnValue(vi.fn())
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

    expect(EventsOn).toHaveBeenCalledWith('repo:changed', expect.any(Function))
  })

  it('calls the unsubscribe function on unmount', async () => {
    const unsubscribe = vi.fn()
    vi.mocked(EventsOn).mockReturnValue(unsubscribe)
    vi.mocked(GetCommits).mockResolvedValue([])

    const { result, unmount } = renderHook(() => useCommits(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
