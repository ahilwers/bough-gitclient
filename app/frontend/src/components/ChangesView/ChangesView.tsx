import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StageFile, UnstageFile, DiscardFile } from '@wailsjs/go/main/App'
import { FileStatusList } from './FileStatusList'
import { ChunkDiffPanel } from './ChunkDiffPanel'
import { CommitBox } from './CommitBox'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import type { FileStatus } from '@/lib/types'

export default function ChangesView() {
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null)
  const [selectedStaged, setSelectedStaged] = useState(false)
  const { showFlash } = useGitStore()
  const queryClient = useQueryClient()

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
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--bg-content)' }}>
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
  )
}
