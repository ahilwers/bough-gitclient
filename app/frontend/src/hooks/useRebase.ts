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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StartInteractiveRebase, ContinueRebase, AbortRebase } from '@bindings/gitmorrow/app'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import type { RebaseAction } from '@/lib/types'

export function useRebase() {
  const qc = useQueryClient()
  const { showFlash, setView } = useGitStore()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['status'] })
    qc.invalidateQueries({ queryKey: ['commits'] })
    qc.invalidateQueries({ queryKey: ['diff'] })
  }

  const startMutation = useMutation({
    mutationFn: (actions: RebaseAction[]) => StartInteractiveRebase(actions),
    onSuccess: () => {
      invalidate()
      showFlash('Rebase completed successfully')
    },
    onError: (err: Error) => {
      // git rebase exits non-zero on conflict — the status now reflects the
      // halted rebase (rebase-merge directory present, files conflicted).
      invalidate()
      setView('changes')
      showFlash(parseGitError(err), 'danger', 8000)
    },
  })

  const continueMutation = useMutation({
    mutationFn: () => ContinueRebase(),
    onSuccess: () => {
      invalidate()
      showFlash('Rebase continued')
    },
    onError: (err: Error) => {
      invalidate()
      showFlash(parseGitError(err), 'danger')
    },
  })

  const abortMutation = useMutation({
    mutationFn: () => AbortRebase(),
    onSuccess: () => {
      invalidate()
      showFlash('Rebase aborted', 'info')
    },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  return { startMutation, continueMutation, abortMutation }
}
