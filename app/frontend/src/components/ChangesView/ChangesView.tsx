import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StageFile, UnstageFile, DiscardFile, AbortMerge } from '@wailsjs/go/main/App'
import { FileStatusList } from './FileStatusList'
import { ChunkDiffPanel } from './ChunkDiffPanel'
import { CommitBox } from './CommitBox'
import { useStatus } from '@/hooks/useStatus'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import type { FileStatus } from '@/lib/types'

export default function ChangesView() {
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null)
  const [selectedStaged, setSelectedStaged] = useState(false)
  const { showFlash } = useGitStore()
  const queryClient = useQueryClient()
  const { data: status } = useStatus()
  const mergeState = status?.mergeState

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }

  const stageMutation = useMutation({
    mutationFn: (path: string) => StageFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to stage: ${parseGitError(err)}`, 'danger'),
  })

  const unstageMutation = useMutation({
    mutationFn: (path: string) => UnstageFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to unstage: ${parseGitError(err)}`, 'danger'),
  })

  const discardMutation = useMutation({
    mutationFn: (path: string) => DiscardFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to discard: ${parseGitError(err)}`, 'danger'),
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedFile) return
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 's') {
        e.preventDefault()
        if (selectedStaged) {
          unstageMutation.mutate(selectedFile.path)
        } else {
          stageMutation.mutate(selectedFile.path)
        }
      }

      if (mod && e.key === 'd') {
        e.preventDefault()
        // Only discard tracked unstaged files — skip untracked (?), skip staged
        if (!selectedStaged && selectedFile.staged !== '?') {
          discardMutation.mutate(selectedFile.path)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFile, selectedStaged, stageMutation, unstageMutation, discardMutation])

  function handleSelectFile(file: FileStatus, staged: boolean) {
    setSelectedFile(file)
    setSelectedStaged(staged)
    // Always invalidate so re-clicking the same file (same React state reference)
    // still triggers a fresh diff fetch via the active query subscription.
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }

  const abortMutation = useMutation({
    mutationFn: () => AbortMerge(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['commits'] })
      showFlash('Merge aborted', 'info')
    },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-content)' }}>
      {/* Merge-in-progress banner */}
      {mergeState && (
        <div style={{
          flexShrink: 0,
          padding: '7px 14px',
          background: mergeState.conflictCount > 0
            ? 'color-mix(in srgb, var(--danger) 12%, var(--bg-panel))'
            : 'color-mix(in srgb, var(--warn) 12%, var(--bg-panel))',
          borderBottom: '1px solid var(--border-sub)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: mergeState.conflictCount > 0 ? 'var(--danger)' : 'var(--warn)',
            letterSpacing: '0.04em',
          }}>
            MERGING
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-sec)', flex: 1 }}>
            {mergeState.conflictCount > 0
              ? `${mergeState.conflictCount} conflict${mergeState.conflictCount > 1 ? 's' : ''} remaining in merge with '${mergeState.mergingBranch}'`
              : `All conflicts resolved — commit to finish merging '${mergeState.mergingBranch}'`
            }
          </span>
          <button
            onClick={() => abortMutation.mutate()}
            disabled={abortMutation.isPending}
            style={{
              padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-sec)', fontSize: 11,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Abort Merge
          </button>
        </div>
      )}

      {/* Main content row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* File status list (240px, left) */}
        <FileStatusList
          selectedFile={selectedFile?.path ?? null}
          selectedStaged={selectedStaged}
          onSelectFile={handleSelectFile}
        />

        {/* Diff panel + commit box (flex:1, right) */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {selectedFile ? (
            <>
              <ChunkDiffPanel filePath={selectedFile.path} staged={selectedStaged} fileStatus={selectedFile} />
              <CommitBox />
            </>
          ) : (
            <>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-ter)', fontSize: 12,
              }}>
                Select a file to view changes
              </div>
              <CommitBox />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
