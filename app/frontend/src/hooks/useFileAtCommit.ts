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
import { GetFileAtCommit, GetFileAtCommitParent } from '@bindings/gitmorrow/app'

/**
 * Returns the file content at a commit and at its first parent.
 * Both queries are disabled when hash or filePath is null/empty.
 */
export function useFileAtCommit(hash: string | null, filePath: string | null) {
  const enabled = !!(hash && filePath)

  const current = useQuery({
    queryKey: ['file-at-commit', hash, filePath],
    queryFn: async () => {
      const result = await GetFileAtCommit(hash!, filePath!)
      return result ?? ''
    },
    enabled,
    staleTime: Infinity,
  })

  const parent = useQuery({
    queryKey: ['file-at-parent', hash, filePath],
    queryFn: async () => {
      const result = await GetFileAtCommitParent(hash!, filePath!)
      return result ?? ''
    },
    enabled,
    staleTime: Infinity,
  })

  return { current, parent }
}
