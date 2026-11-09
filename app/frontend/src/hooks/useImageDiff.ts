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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GetImageAtCommit,
  GetImageAtCommitParent,
  GetImageFromHead,
  GetImageFromIndex,
  GetImageFromMergeStage,
  GetImageFromStash,
  GetImageFromStashBase,
  GetImageFromWorktree,
} from '@bindings/gitmorrow/app'
import { Events } from '@wailsio/runtime'

/**
 * Images for the commit-history diff: `parent` is the version in the first
 * parent commit, `current` is the version in the commit itself.
 */
export function useCommitImageDiff(hash: string | null, filePath: string | null) {
  const enabled = !!(hash && filePath)

  const current = useQuery({
    queryKey: ['image-at-commit', hash, filePath],
    queryFn: async () => {
      const result = await GetImageAtCommit(hash!, filePath!)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled,
    staleTime: Infinity,
  })

  const parent = useQuery({
    queryKey: ['image-at-parent', hash, filePath],
    queryFn: async () => {
      const result = await GetImageAtCommitParent(hash!, filePath!)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled,
    staleTime: Infinity,
  })

  return {
    current: current.data,
    parent: parent.data,
    isLoading: current.isLoading || parent.isLoading,
  }
}

/**
 * Images for the working-copy diff in the Changes view.
 * Untracked → only the worktree version (no left side).
 * Staged    → left: HEAD, right: index.
 * Unstaged  → left: index, right: worktree.
 * Polls every 3s and refreshes on repo:changed events to track on-disk edits.
 */
export function useWorkingImageDiff(filePath: string | null, staged: boolean, isUntracked: boolean) {
  const queryClient = useQueryClient()
  const enabled = filePath !== null

  const left = useQuery({
    queryKey: ['image-diff', filePath, staged, isUntracked, 'left'],
    queryFn: async () => {
      // Untracked files have no previous version.
      if (isUntracked) return { dataURL: '', size: 0 }
      const result = staged
        ? await GetImageFromHead(filePath!)
        : await GetImageFromIndex(filePath!)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled,
    staleTime: 1_000,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  })

  const right = useQuery({
    queryKey: ['image-diff', filePath, staged, isUntracked, 'right'],
    queryFn: async () => {
      const result = isUntracked
        ? await GetImageFromWorktree(filePath!)
        : staged
          ? await GetImageFromIndex(filePath!)
          : await GetImageFromWorktree(filePath!)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled,
    staleTime: 1_000,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    const unsubscribe = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['image-diff'] })
    })
    return unsubscribe
  }, [queryClient])

  return {
    left: left.data,
    right: right.data,
    isLoading: left.isLoading || right.isLoading,
  }
}

/**
 * Images for a merge-conflict in the Changes view: stage 2 (ours, local HEAD)
 * versus stage 3 (theirs, incoming branch).
 */
export function useMergeStageImageDiff(filePath: string | null) {
  const ours = useQuery({
    queryKey: ['image-merge-stage', filePath, 2],
    queryFn: async () => {
      const result = await GetImageFromMergeStage(filePath!, 2)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled: filePath !== null,
    staleTime: 0,
  })

  const theirs = useQuery({
    queryKey: ['image-merge-stage', filePath, 3],
    queryFn: async () => {
      const result = await GetImageFromMergeStage(filePath!, 3)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled: filePath !== null,
    staleTime: 0,
  })

  return {
    ours: ours.data,
    theirs: theirs.data,
    isLoading: ours.isLoading || theirs.isLoading,
  }
}

/**
 * Images for a stash diff: `base` is the stash's parent commit (the state the
 * stash was created from), `stash` is the image as saved inside the stash.
 */
export function useStashImageDiff(index: number | null, filePath: string | null) {
  const enabled = index !== null && filePath !== null

  const stash = useQuery({
    queryKey: ['image-stash', index, filePath],
    queryFn: async () => {
      const result = await GetImageFromStash(index!, filePath!)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled,
    staleTime: 30_000,
  })

  const base = useQuery({
    queryKey: ['image-stash-base', index, filePath],
    queryFn: async () => {
      const result = await GetImageFromStashBase(index!, filePath!)
      return result ?? { dataURL: '', size: 0 }
    },
    enabled,
    staleTime: 30_000,
  })

  return {
    stash: stash.data,
    base: base.data,
    isLoading: stash.isLoading || base.isLoading,
  }
}
