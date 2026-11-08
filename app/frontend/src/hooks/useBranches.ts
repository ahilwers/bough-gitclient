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
import { ListBranches, CheckoutBranch, CheckoutRemoteBranch, PullIntoLocalBranch, Pull, CreateBranch, MergeBranch } from '@bindings/bough/app'
import { Events } from '@wailsio/runtime'
import type { BranchList } from '@/lib/types'

export function useBranches() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await ListBranches()) as BranchList,
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsubscribe = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    })
    return unsubscribe
  }, [queryClient])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['branches'] })
    queryClient.invalidateQueries({ queryKey: ['commits'] })
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }

  const checkoutMutation = useMutation({
    mutationFn: (branch: string) => CheckoutBranch(branch),
    onSuccess: invalidateAll,
  })

  const checkoutRemoteMutation = useMutation({
    mutationFn: (remoteBranch: string) => CheckoutRemoteBranch(remoteBranch),
    onSuccess: invalidateAll,
  })

  const pullIntoLocalMutation = useMutation({
    mutationFn: ({ remote, localBranch }: { remote: string; localBranch: string }) =>
      PullIntoLocalBranch(remote, localBranch),
    onSuccess: invalidateAll,
  })

  const pullIntoCurrentMutation = useMutation({
    mutationFn: ({ remote, branch }: { remote: string; branch: string }) =>
      Pull(remote, branch),
    onSuccess: invalidateAll,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, from, checkoutAfter }: { name: string; from: string; checkoutAfter: boolean }) =>
      CreateBranch(name, from, checkoutAfter),
    onSuccess: invalidateAll,
  })

  const mergeMutation = useMutation({
    mutationFn: (from: string) => MergeBranch(from),
    onSuccess: invalidateAll,
  })

  return { ...query, checkoutMutation, checkoutRemoteMutation, pullIntoLocalMutation, pullIntoCurrentMutation, createMutation, mergeMutation }
}
