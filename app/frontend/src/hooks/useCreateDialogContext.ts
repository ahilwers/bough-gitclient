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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGitStore } from '@/stores/gitStore'

/** Keep a creation dialog tied to the repository/worktree where it was opened. */
export function useCreateDialogContext() {
  const [initial] = useState(() => {
    const { activeRepo, activeWorktree } = useGitStore.getState()
    return { repo: activeRepo, worktree: activeWorktree }
  })
  const repo = useGitStore(s => s.activeRepo)
  const worktree = useGitStore(s => s.activeWorktree)
  const changedRef = useRef(false)
  const [changed, setChanged] = useState(false)

  useEffect(() => {
    const check = (state: ReturnType<typeof useGitStore.getState>) => {
      if (state.activeRepo !== initial.repo || state.activeWorktree !== initial.worktree) {
        changedRef.current = true
        setChanged(true)
      }
    }
    const unsubscribe = useGitStore.subscribe(check)
    check(useGitStore.getState())
    return unsubscribe
  }, [initial])

  const isCurrent = useCallback(() => {
    const state = useGitStore.getState()
    return !!initial.repo && !changedRef.current
      && state.activeRepo === initial.repo && state.activeWorktree === initial.worktree
  }, [initial])

  return {
    isCurrent,
    valid: !!initial.repo && !changed && repo === initial.repo && worktree === initial.worktree,
  }
}
