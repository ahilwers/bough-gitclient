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
import { GetFileDiff, GetUntrackedFileDiff } from '@bindings/bough/app'
import { Events } from '@wailsio/runtime'
import type { DiffFile } from '@/lib/types'

export function useFileDiff(filePath: string | null, staged: boolean, isUntracked = false) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['diff', filePath, staged, isUntracked],
    queryFn: async (): Promise<DiffFile> => {
      if (isUntracked) {
        return (await GetUntrackedFileDiff(filePath!)) as DiffFile
      }
      return (await GetFileDiff(filePath!, staged)) as DiffFile
    },
    enabled: filePath !== null,
    staleTime: 1_000,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    const unsubscribe = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['diff'] })
    })
    return unsubscribe
  }, [queryClient])

  return query
}
