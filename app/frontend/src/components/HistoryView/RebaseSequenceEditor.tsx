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

import { Button } from '../shared/Button'
import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { CommitsOnRemote } from '@bindings/gitmorrow/app'
import { useRebase } from '@/hooks/useRebase'
import type { CommitNode, RebaseAction } from '@/lib/types'

// Action cycling order
const ACTION_CYCLE: RebaseAction['action'][] = ['pick', 'reword', 'squash', 'fixup', 'drop']

const ACTION_LABEL: Record<RebaseAction['action'], string> = {
  pick:   'pick',
  reword: 'reword',
  squash: 'squash',
  fixup:  'fixup',
  drop:   'drop',
}

const ACTION_COLOR: Record<RebaseAction['action'], string> = {
  pick:   'var(--acc)',
  reword: 'var(--warn)',
  squash: 'var(--success)',
  fixup:  'var(--success)',
  drop:   'var(--danger)',
}

interface EditorRow {
  commit: CommitNode
  action: RebaseAction['action']
  message: string  // editable (starts from commit.message)
}

interface Props {
  // All commits to include in the sequence, newest first (same order as CommitList).
  commits: CommitNode[]
  onClose: () => void
}

export function RebaseSequenceEditor({ commits, onClose }: Props) {
  const { startMutation } = useRebase()

  // Rows are displayed newest-first (matching CommitList).
  const [rows, setRows] = useState<EditorRow[]>(() =>
    commits.map(c => ({ commit: c, action: 'pick', message: c.message }))
  )

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [pushedHashes, setPushedHashes] = useState<Set<string>>(new Set())
  const [loadingRemote, setLoadingRemote] = useState(true)

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const editRef = useRef<HTMLInputElement>(null)

  // Load pushed hashes on mount
  useEffect(() => {
    const hashes = commits.map(c => c.hash)
    CommitsOnRemote(hashes)
      .then(pushed => {
        setPushedHashes(new Set(pushed ?? []))
      })
      .catch(() => { /* no upstream — treat as local */ })
      .finally(() => setLoadingRemote(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingIdx !== null) {
      editRef.current?.select()
    }
  }, [editingIdx])

  // Close on Escape (when not editing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingIdx === null) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingIdx, onClose])

  const cycleAction = (idx: number) => {
    setRows(prev => {
      const next = [...prev]
      const cur = next[idx].action
      const curPos = ACTION_CYCLE.indexOf(cur)
      next[idx] = { ...next[idx], action: ACTION_CYCLE[(curPos + 1) % ACTION_CYCLE.length] }
      return next
    })
  }

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditValue(rows[idx].message)
  }

  const commitEdit = () => {
    if (editingIdx === null) return
    setRows(prev => {
      const next = [...prev]
      next[editingIdx] = { ...next[editingIdx], message: editValue.trim() || prev[editingIdx].message }
      return next
    })
    setEditingIdx(null)
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const handleDragStart = (idx: number) => {
    setDragIndex(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDropIndex(idx)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    setRows(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, moved)
      return next
    })
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleRebase = () => {
    const actions: RebaseAction[] = rows.map(r => ({
      action: r.action,
      hash: r.commit.hash,
      message: r.message,
    }))
    startMutation.mutate(actions, { onSuccess: onClose })
  }

  const pushedCount = rows.filter(r => pushedHashes.has(r.commit.hash)).length

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          width: 640,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-sub)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-pri)' }}>
              Interactive Rebase
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-ter)', marginTop: 2 }}>
              {rows.length} commit{rows.length !== 1 ? 's' : ''}
              {' · '}click badge to change action · drag to reorder · double-click to rename
            </div>
          </div>
          <Button variant="icon" aria-label="Close"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent', color: 'var(--text-ter)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </Button>
        </div>

        {/* Rows */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {rows.map((row, idx) => {
            const isPushed = pushedHashes.has(row.commit.hash)
            const isDragging = dragIndex === idx
            const isDropTarget = dropIndex === idx && dragIndex !== null && dragIndex !== idx

            return (
              <div
                key={row.commit.hash}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px',
                  borderBottom: '1px solid var(--border-sub)',
                  background: isDragging
                    ? 'color-mix(in srgb, var(--acc) 8%, var(--bg-panel))'
                    : row.action === 'drop'
                    ? 'color-mix(in srgb, var(--danger) 6%, var(--bg-panel))'
                    : 'var(--bg-panel)',
                  borderTop: isDropTarget ? '2px solid var(--acc)' : undefined,
                  opacity: isDragging ? 0.5 : 1,
                  cursor: 'grab',
                  transition: 'background 0.1s',
                }}
              >
                {/* Drag handle */}
                <div style={{
                  color: 'var(--text-ter)', fontSize: 14, lineHeight: 1,
                  cursor: 'grab', flexShrink: 0,
                }}>
                  ⠿
                </div>

                {/* Action badge */}
                <Button variant="ghost"
                  onClick={() => cycleAction(idx)}
                  title="Click to cycle action"
                  aria-label="Click to cycle action"
                  style={{
                    flexShrink: 0,
                    padding: '2px 7px',
                    borderRadius: 4, border: 'none',
                    background: ACTION_COLOR[row.action],
                    color: 'white',
                    fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                    cursor: 'pointer', width: 52, textAlign: 'center',
                    opacity: row.action === 'drop' ? 0.85 : 1,
                  }}
                >
                  {ACTION_LABEL[row.action]}
                </Button>

                {/* Short hash */}
                <code style={{
                  fontSize: 11, fontFamily: 'monospace', color: 'var(--text-ter)',
                  flexShrink: 0, width: 52,
                }}>
                  {row.commit.shortHash}
                </code>

                {/* Message (editable on double-click) */}
                {editingIdx === idx ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                      if (e.key === 'Escape') { e.preventDefault(); setEditingIdx(null) }
                    }}
                    style={{
                      flex: 1, border: '1px solid var(--acc)', borderRadius: 4,
                      background: 'var(--bg-input)', color: 'var(--text-pri)',
                      fontSize: 12, fontFamily: 'monospace', padding: '2px 6px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => startEdit(idx)}
                    title="Double-click to edit message"
                    aria-label="Double-click to edit message"
                    style={{
                      flex: 1, fontSize: 12, color: row.action === 'drop' ? 'var(--text-ter)' : 'var(--text-pri)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      textDecoration: row.action === 'drop' ? 'line-through' : 'none',
                      cursor: 'text',
                    }}
                  >
                    {row.message}
                  </span>
                )}

                {/* Pushed indicator */}
                {!loadingRemote && isPushed && (
                  <span title="Already pushed to remote" aria-label="Already pushed to remote" style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 600,
                    color: 'var(--warn)',
                    background: 'color-mix(in srgb, var(--warn) 15%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)',
                    borderRadius: 3, padding: '1px 5px',
                  }}>
                    pushed
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Pushed warning */}
        {pushedCount > 0 && (
          <div style={{
            flexShrink: 0,
            padding: '8px 14px',
            background: 'color-mix(in srgb, var(--warn) 10%, var(--bg-panel))',
            borderTop: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={13} style={{ color: 'var(--warn)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>
              {pushedCount} commit{pushedCount !== 1 ? 's' : ''} already on remote —
              a <strong>force push</strong> will be required after rebase.
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 18px',
          borderTop: '1px solid var(--border-sub)',
        }}>
          <Button
            onClick={onClose}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRebase}
            disabled={startMutation.isPending}
            variant="primary"
          >
            {startMutation.isPending ? 'Rebasing…' : 'Rebase'}
          </Button>
        </div>
      </div>
    </div>
  )
}
