import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ListWorktrees,
  AddWorktree as AddWorktreeAPI,
  RemoveWorktree as RemoveWorktreeAPI,
  SwitchWorktree,
} from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import { useGitStore } from '@/stores/gitStore'
import type { WorktreeInfo } from '@/lib/types'

export function useWorktrees() {
  const queryClient = useQueryClient()
  const setActiveWorktree = useGitStore(s => s.setActiveWorktree)

  const query = useQuery({
    queryKey: ['worktrees'],
    queryFn: async () => (await ListWorktrees()) as WorktreeInfo[],
    staleTime: 30_000,
  })

  // Invalidate the list whenever the Go backend emits a worktrees-changed event
  // (fired after AddWorktree and RemoveWorktree).
  useEffect(() => {
    const unsub = EventsOn('repo:worktrees-changed', () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const addMutation = useMutation({
    mutationFn: ({ path, branch }: { path: string; branch: string }) =>
      AddWorktreeAPI(path, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (path: string) => RemoveWorktreeAPI(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    },
  })

  const switchMutation = useMutation({
    mutationFn: (path: string) => SwitchWorktree(path),
    onSuccess: (_, path) => {
      setActiveWorktree(path)
      // Invalidate all data-dependent queries so the UI reflects the new context.
      queryClient.invalidateQueries({ queryKey: ['commits'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    },
  })

  return { ...query, addMutation, removeMutation, switchMutation }
}
