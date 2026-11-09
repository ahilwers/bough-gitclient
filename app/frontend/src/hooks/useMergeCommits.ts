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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { GetMergeCommits } from '@bindings/gitmorrow/app'
import { Events } from '@wailsio/runtime'
import type { CommitNode } from '@/lib/types'

export function useMergeCommits(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['mergeCommits'] })
    })
    return unsubscribe
  }, [queryClient])

  return useQuery({
    queryKey: ['mergeCommits'],
    queryFn: async () => ((await GetMergeCommits()) ?? []) as CommitNode[],
    enabled,
    staleTime: 5_000,
  })
}
