import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CherryPickCommits, AbortCherryPick } from '@wailsjs/go/main/App'
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
