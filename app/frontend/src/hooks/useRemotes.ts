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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListRemotes, AddRemote, UpdateRemote, RenameRemote, RemoveRemote } from '@bindings/bough/app'
import type { Remote } from '@/lib/types'

export function useRemotes() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['remotes'],
    queryFn: async () => (await ListRemotes()) as Remote[],
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => AddRemote(name, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => UpdateRemote(name, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      RenameRemote(oldName, newName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (name: string) => RemoveRemote(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  return { ...query, addMutation, updateMutation, renameMutation, removeMutation }
}
