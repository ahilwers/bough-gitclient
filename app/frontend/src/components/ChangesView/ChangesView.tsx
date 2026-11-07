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

import { Button } from '../shared/Button'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { StageFile, UnstageFile, DiscardFile, AbortMerge } from '@wailsjs/go/main/App'
import { useRebase } from '@/hooks/useRebase'
import { FileStatusList } from './FileStatusList'
import { ChunkDiffPanel } from './ChunkDiffPanel'
import { CommitBox } from './CommitBox'
import { useStatus } from '@/hooks/useStatus'
import { useGitStore } from '@/stores/gitStore'
import { useCherryPick } from '@/hooks/useCherryPick'
import { parseGitError } from '@/lib/format'
import type { FileStatus } from '@/lib/types'

export default function ChangesView() {
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null)
  const [selectedStaged, setSelectedStaged] = useState(false)
  const { showFlash, cherryPickConflictActive } = useGitStore()
  const queryClient = useQueryClient()
  const { data: status } = useStatus()
  const mergeState = status?.mergeState
  const cherryPickState = status?.cherryPickState
  const rebaseState = status?.rebaseState
  const { continueMutation: rebaseContinueMutation, abortMutation: rebaseAbortMutation } = useRebase()
  // Show cherry-pick banner: CHERRY_PICK_HEAD detected, Zustand flag set,
  // or conflicts exist with no merge in progress.
  const showCherryPickBanner = !!cherryPickState
    || cherryPickConflictActive
    || (!mergeState && !!status?.hasConflicts)
  const { abortMutation: abortCherryPickMutation } = useCherryPick()

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
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        document.querySelector<HTMLTextAreaElement>('[data-commit-input]')?.focus()
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  // Auto-select first conflicted file when conflicts are detected
  const prevHasConflicts = useRef(false)
  useEffect(() => {
    const hasConflicts = status?.hasConflicts ?? false
    if (hasConflicts && !prevHasConflicts.current) {
      const isConflicted = (f: { staged: string; unstaged: string }) =>
        f.staged === 'U' || f.unstaged === 'U' ||
        (f.staged === 'A' && f.unstaged === 'A') ||
        (f.staged === 'D' && f.unstaged === 'D')
      const first = status?.files?.find(isConflicted)
      if (first) {
        setSelectedFile(first)
        setSelectedStaged(false)
        queryClient.invalidateQueries({ queryKey: ['fileContent', first.path] })
      }
    }
    prevHasConflicts.current = hasConflicts
  }, [status?.hasConflicts]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the selected file disappears from its section (staged/unstaged/discarded),
  // automatically select the next sibling — or the previous one if there is no next.
  const prevEntriesRef = useRef<Array<{ file: FileStatus; staged: boolean }>>([])
  useEffect(() => {
    const files = status?.files ?? []

    function fileIsConflicted(f: FileStatus) {
      return f.staged === 'U' || f.unstaged === 'U' ||
        (f.staged === 'A' && f.unstaged === 'A') ||
        (f.staged === 'D' && f.unstaged === 'D')
    }
    function buildEntries(fs: FileStatus[]) {
      return [
        ...fs.filter(fileIsConflicted).map(f => ({ file: f, staged: false })),
        ...fs.filter(f => !fileIsConflicted(f) && (f.unstaged !== '' || f.staged === '?')).map(f => ({ file: f, staged: false })),
        ...fs.filter(f => !fileIsConflicted(f) && f.staged !== '' && f.staged !== '?').map(f => ({ file: f, staged: true })),
      ]
    }

    const newEntries = buildEntries(files)
    const oldEntries = prevEntriesRef.current
    prevEntriesRef.current = newEntries

    if (!selectedFile || oldEntries.length === 0) return

    // Check if the selected file is still present in its section
    const stillPresent = newEntries.some(
      e => e.file.path === selectedFile.path && e.staged === selectedStaged
    )
    if (stillPresent) return

    // Find where it was in the old list
    const oldIdx = oldEntries.findIndex(
      e => e.file.path === selectedFile.path && e.staged === selectedStaged
    )
    if (oldIdx === -1) return

    // Search forward then backward for the nearest sibling in the same section
    const wasStaged = oldEntries[oldIdx].staged
    let next: { file: FileStatus; staged: boolean } | null = null

    for (let i = oldIdx; i < newEntries.length; i++) {
      if (newEntries[i].staged === wasStaged) { next = newEntries[i]; break }
    }
    if (!next) {
      for (let i = Math.min(oldIdx - 1, newEntries.length - 1); i >= 0; i--) {
        if (newEntries[i].staged === wasStaged) { next = newEntries[i]; break }
      }
    }

    if (next) {
      setSelectedFile(next.file)
      setSelectedStaged(next.staged)
    } else {
      setSelectedFile(null)
    }
  }, [status?.files]) // eslint-disable-line react-hooks/exhaustive-deps

  const abortMutation = useMutation({
    mutationFn: () => AbortMerge(),
    onSuccess: () => {
      setSelectedFile(null)
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
          <Button variant="secondary"
            onClick={() => abortMutation.mutate()}
            disabled={abortMutation.isPending}
            style={{ flexShrink: 0 }}
          >
            {abortMutation.isPending && <Loader2 size={11} className="spin" />}
            Abort Merge
          </Button>
        </div>
      )}

      {/* Cherry-pick conflict banner */}
      {showCherryPickBanner && (
        <div style={{
          flexShrink: 0,
          padding: '7px 14px',
          background: status?.hasConflicts
            ? 'color-mix(in srgb, var(--danger) 12%, var(--bg-panel))'
            : 'color-mix(in srgb, var(--success) 12%, var(--bg-panel))',
          borderBottom: '1px solid var(--border-sub)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: status?.hasConflicts ? 'var(--danger)' : 'var(--success)',
            letterSpacing: '0.04em',
          }}>
            CHERRY-PICK
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-sec)', flex: 1 }}>
            {status?.hasConflicts
              ? cherryPickState
                ? `${cherryPickState.conflictCount} conflict${cherryPickState.conflictCount !== 1 ? 's' : ''} — resolve and commit to finish cherry-pick`
                : 'Conflicts detected — resolve and commit to finish cherry-pick'
              : 'All conflicts resolved — commit to finish cherry-pick'
            }
          </span>
          <Button variant="secondary"
            onClick={() => abortCherryPickMutation.mutate(undefined, {
              onSuccess: () => setSelectedFile(null),
            })}
            disabled={abortCherryPickMutation.isPending}
            style={{ flexShrink: 0 }}
          >
            {abortCherryPickMutation.isPending && <Loader2 size={11} className="spin" />}
            Abort Cherry-pick
          </Button>
        </div>
      )}

      {/* Rebase-in-progress banner */}
      {rebaseState?.inProgress && (
        <div style={{
          flexShrink: 0,
          padding: '7px 14px',
          background: rebaseState.conflictCount > 0
            ? 'color-mix(in srgb, var(--danger) 12%, var(--bg-panel))'
            : 'color-mix(in srgb, var(--warn) 12%, var(--bg-panel))',
          borderBottom: '1px solid var(--border-sub)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: rebaseState.conflictCount > 0 ? 'var(--danger)' : 'var(--warn)',
            letterSpacing: '0.04em',
          }}>
            REBASING
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-sec)', flex: 1 }}>
            {rebaseState.conflictCount > 0
              ? `${rebaseState.conflictCount} conflict${rebaseState.conflictCount !== 1 ? 's' : ''} remaining — resolve and commit to continue`
              : `Step ${rebaseState.step} of ${rebaseState.total} — commit to continue rebasing '${rebaseState.headName}'`
            }
          </span>
          {rebaseState.conflictCount === 0 && (
            <Button variant="primary"
              onClick={() => rebaseContinueMutation.mutate()}
              disabled={rebaseContinueMutation.isPending}
              style={{ flexShrink: 0 }}
            >
              {rebaseContinueMutation.isPending && <Loader2 size={11} className="spin" />}
              Continue
            </Button>
          )}
          <Button variant="secondary"
            onClick={() => rebaseAbortMutation.mutate()}
            disabled={rebaseAbortMutation.isPending}
            style={{ flexShrink: 0 }}
          >
            {rebaseAbortMutation.isPending && <Loader2 size={11} className="spin" />}
            Abort Rebase
          </Button>
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
