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

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListTags, CheckoutTag, DeleteTag } from '@bindings/gitmorrow/app'
import { Events } from '@wailsio/runtime'
import { useGitStore } from '@/stores/gitStore'
import type { Tag } from '@/lib/types'

export function useTags() {
  const queryClient = useQueryClient()
  const activeRepo = useGitStore(s => s.activeRepo)

  const query = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await ListTags()) as Tag[],
    enabled: !!activeRepo,
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const checkoutMutation = useMutation({
    mutationFn: (tag: string) => CheckoutTag(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['commits'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (tag: string) => DeleteTag(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['commits'] })
    },
  })

  return { ...query, checkoutMutation, deleteMutation }
}
