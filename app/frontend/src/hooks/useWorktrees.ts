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

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ListWorktrees,
  AddWorktree as AddWorktreeAPI,
  RemoveWorktree as RemoveWorktreeAPI,
  SwitchWorktree,
} from '@bindings/bough/app'
import { Events } from '@wailsio/runtime'
import { useGitStore } from '@/stores/gitStore'
import type { WorktreeInfo } from '@/lib/types'

export function useWorktrees() {
  const queryClient = useQueryClient()
  const setActiveWorktree = useGitStore(s => s.setActiveWorktree)
  const activeRepo = useGitStore(s => s.activeRepo)

  const query = useQuery({
    queryKey: ['worktrees'],
    queryFn: async () => (await ListWorktrees()) as WorktreeInfo[],
    enabled: !!activeRepo,
    staleTime: 30_000,
  })

  // Invalidate the list whenever the Go backend emits a worktrees-changed event
  // (fired after AddWorktree and RemoveWorktree).
  useEffect(() => {
    const unsub = Events.On('repo:worktrees-changed', () => {
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
