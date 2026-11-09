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

import { useQuery } from '@tanstack/react-query'
import { GetStashDiff } from '@bindings/gitmorrow/app'
import type { DiffFile } from '@/lib/types'

export function useStashDiff(index: number | null) {
  return useQuery({
    queryKey: ['stashDiff', index],
    queryFn: async () => (await GetStashDiff(index!)) as DiffFile[],
    enabled: index !== null,
    staleTime: 30_000,
  })
}
