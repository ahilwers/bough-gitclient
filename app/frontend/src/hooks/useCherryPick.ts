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
import { CherryPickCommits, AbortCherryPick } from '@bindings/gitmorrow/app'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'

export function useCherryPick() {
  const qc = useQueryClient()
  const {
    showFlash, setView,
    setPendingCherryPickMessage,
    setSelectedCommits,
    setCherryPickConflictActive,
  } = useGitStore()

  const cherryPickMutation = useMutation({
    mutationFn: ({ hashes }: { hashes: string[]; combinedMessage: string }) =>
      CherryPickCommits(hashes),
    onSuccess: (_, { combinedMessage }) => {
      qc.invalidateQueries({ queryKey: ['status'] })
      qc.invalidateQueries({ queryKey: ['commits'] })
      qc.invalidateQueries({ queryKey: ['diff'] })
      setSelectedCommits([])
      setPendingCherryPickMessage(combinedMessage)
      setCherryPickConflictActive(false)
      setView('changes')
      showFlash('Cherry-pick staged — review and commit', 'info')
    },
    onError: (err: Error) => {
      // git exits non-zero on conflict — status now reflects the conflicted working tree.
      qc.invalidateQueries({ queryKey: ['status'] })
      qc.invalidateQueries({ queryKey: ['diff'] })
      // Mark that a cherry-pick conflict is active so the UI can show the abort button
      // even when CHERRY_PICK_HEAD is not detected via the filesystem.
      setCherryPickConflictActive(true)
      setView('changes')
      showFlash(parseGitError(err), 'danger')
    },
  })

  const abortMutation = useMutation({
    mutationFn: () => AbortCherryPick(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status'] })
      qc.invalidateQueries({ queryKey: ['commits'] })
      qc.invalidateQueries({ queryKey: ['diff'] })
      setCherryPickConflictActive(false)
      showFlash('Cherry-pick aborted', 'info')
    },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  return { cherryPickMutation, abortMutation }
}
