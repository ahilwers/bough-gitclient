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
import { GetCommitDiff } from '@bindings/gitmorrow/app'
import type { DiffFile } from '@/lib/types'

/** Returns the list of files changed in a commit (wraps GetCommitDiff). */
export function useCommitFiles(hash: string | null) {
  return useQuery({
    queryKey: ['commit-files', hash],
    queryFn: async () => {
      const result = await GetCommitDiff(hash!)
      return (result || []) as DiffFile[]
    },
    enabled: !!hash,
    staleTime: Infinity, // commit history is immutable
  })
}
