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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetCommits } from '@bindings/bough/app'
import { Events } from '@wailsio/runtime'
import { useGitStore } from '@/stores/gitStore'
import type { CommitNode } from '@/lib/types'

export function useCommits(limit = 500, all = true) {
  const queryClient = useQueryClient()
  const { activeRepo } = useGitStore()

  const query = useQuery({
    queryKey: ['commits', limit, all],
    queryFn: async () => {
      const result = await GetCommits(limit, all)
      return (result || []) as CommitNode[]
    },
    enabled: !!activeRepo,
    staleTime: 30_000,
  })

  // Invalidate when the repo changes on disk (watcher fires 'repo:changed')
  useEffect(() => {
    const unsubscribe = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['commits'] })
    })
    return unsubscribe
  }, [queryClient])

  return query
}
