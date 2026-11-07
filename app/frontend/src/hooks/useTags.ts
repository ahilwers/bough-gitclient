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
import { ListTags, CheckoutTag, DeleteTag } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { Tag } from '@/lib/types'

export function useTags() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await ListTags()) as Tag[],
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = EventsOn('repo:changed', () => {
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
