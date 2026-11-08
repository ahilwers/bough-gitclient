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
import { ListStashes, ApplyStash, PopStash, DropStash } from '@bindings/bough/app'
import { Events } from '@wailsio/runtime'
import type { StashEntry } from '@/lib/types'

export function useStashes() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['stashes'],
    queryFn: async () => (await ListStashes()) as StashEntry[],
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['stashes'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const invalidateAfterApply = () => {
    queryClient.invalidateQueries({ queryKey: ['stashes'] })
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }

  const applyMutation = useMutation({
    mutationFn: (index: number) => ApplyStash(index),
    onSuccess: invalidateAfterApply,
  })

  const popMutation = useMutation({
    mutationFn: (index: number) => PopStash(index),
    onSuccess: invalidateAfterApply,
  })

  const dropMutation = useMutation({
    mutationFn: (index: number) => DropStash(index),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stashes'] }),
  })

  return { ...query, applyMutation, popMutation, dropMutation }
}
