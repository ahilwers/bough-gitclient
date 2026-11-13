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
import { useState, useRef, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { StageFile, StageFiles, UnstageFile, UnstageFiles, DiscardFile, DiscardFiles, DiscardStagedFile, DiscardStagedFiles, RevealInFinder } from '@bindings/gitmorrow/app'
import { useStatus } from '@/hooks/useStatus'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import { buildFileEntries, fileEntryKey, isConflictedStatus } from '@/lib/fileEntries'
import type { FileEntry } from '@/lib/fileEntries'
import { KeyHints } from '@/components/shared/KeyHints'
import type { FileStatus } from '@/lib/types'

function focusPanel(name: string) {
  const el = document.querySelector<HTMLElement>(`[data-panel="${name}"]`)
  el?.focus()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number
  y: number
  file: FileStatus
  staged: boolean
}

interface FileStatusListProps {
  selectedFile: string | null
  selectedStaged: boolean
  onSelectFile: (file: FileStatus, staged: boolean) => void
  nextPanel?: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FileStatusList({ selectedFile, selectedStaged, onSelectFile, nextPanel = 'changes-diff' }: FileStatusListProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [discardConfirm, setDiscardConfirm] = useState<{ file: FileStatus; staged: boolean } | null>(null)
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const { data: status } = useStatus()

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }, [queryClient])

  const stageFileMutation = useMutation({
    mutationFn: (path: string) => StageFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to stage: ${parseGitError(err)}`, 'danger'),
  })

  const stageAllMutation = useMutation({
    mutationFn: (paths: string[]) => StageFiles(paths),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to stage all: ${parseGitError(err)}`, 'danger'),
  })

  const unstageFileMutation = useMutation({
    mutationFn: (path: string) => UnstageFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to unstage: ${parseGitError(err)}`, 'danger'),
  })

  const unstageAllMutation = useMutation({
    mutationFn: (paths: string[]) => UnstageFiles(paths),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to unstage all: ${parseGitError(err)}`, 'danger'),
  })

  const discardFileMutation = useMutation({
    mutationFn: (path: string) => DiscardFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to discard: ${parseGitError(err)}`, 'danger'),
  })

  const discardStagedMutation = useMutation({
    mutationFn: (path: string) => DiscardStagedFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to discard: ${parseGitError(err)}`, 'danger'),
  })

  const files = status?.files ?? []
  const entries = buildFileEntries(files)
  const conflictedFiles = files.filter(isConflictedStatus)
  const unstagedFiles = files.filter(f => !isConflictedStatus(f) && (f.unstaged !== '' || f.staged === '?'))
  const stagedFiles = files.filter(f => !isConflictedStatus(f) && f.staged !== '' && f.staged !== '?')

  const allEntries = entries

  const currentIdx = allEntries.findIndex(
    e => e.file.path === selectedFile && e.staged === selectedStaged
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileStatus, staged: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file, staged })
  }, [])

  // ─── Multi-selection ────────────────────────────────────────────────────────
  // Selected entries are identified by their row key, so the same path in the
  // "Unstaged" and in the "Staged" section are two different entries.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  // True once the user selected entries deliberately (Ctrl/Cmd+click, Shift+click
  // or Ctrl/Cmd+A). A plain click only moves the diff view and must not leave a
  // bulk-action bar behind.
  const [selectionActive, setSelectionActive] = useState(false)
  const anchorKey = useRef<string | null>(null)

  const selectKeys = useCallback((keys: string[]) => {
    setSelectedKeys(keys)
    setSelectionActive(keys.length > 0)
  }, [])

  const handleRowClick = useCallback((entry: FileEntry, event: React.MouseEvent) => {
    if (event.shiftKey && anchorKey.current) {
      // Range selection between the anchor and the clicked row.
      const from = allEntries.findIndex(e => e.key === anchorKey.current)
      const to = allEntries.findIndex(e => e.key === entry.key)
      if (from !== -1 && to !== -1) {
        const lo = Math.min(from, to)
        const hi = Math.max(from, to)
        selectKeys(allEntries.slice(lo, hi + 1).map(e => e.key))
      }
    } else if (event.metaKey || event.ctrlKey) {
      // Toggle a single row without losing the rest of the selection.
      setSelectedKeys(prev => prev.includes(entry.key) ? prev.filter(k => k !== entry.key) : [...prev, entry.key])
      setSelectionActive(true)
      anchorKey.current = entry.key
    } else {
      // Plain click only moves the diff view.
      selectKeys([])
      anchorKey.current = entry.key
    }
    onSelectFile(entry.file, entry.staged)
  }, [allEntries, onSelectFile, selectKeys])

  const selectAll = useCallback(() => {
    selectKeys(allEntries.map(e => e.key))
  }, [allEntries, selectKeys])

  // Ctrl/Cmd+A selects every file of the list. It is ignored while a text
  // field has the focus, where it must keep selecting text.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'a') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault()
      selectAll()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectAll])

  // Selected entries, grouped by the section they belong to.
  const selectedEntries = allEntries.filter(e => selectedKeys.includes(e.key))
  const selectedUnstaged = selectedEntries.filter(e => !e.staged)
  const selectedStagedEntries = selectedEntries.filter(e => e.staged)
  // Untracked and conflicted files cannot be discarded like a tracked change.
  const discardableUnstaged = selectedUnstaged.filter(e => e.file.staged !== '?' && !isConflictedStatus(e.file))
  const discardableStaged = selectedStagedEntries.filter(e => !isConflictedStatus(e.file))

  const stageSelectedMutation = useMutation({
    mutationFn: (paths: string[]) => StageFiles(paths),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to stage: ${parseGitError(err)}`, 'danger'),
  })

  const discardSelectedMutation = useMutation({
    mutationFn: async ({ unstaged, staged }: { unstaged: string[]; staged: string[] }) => {
      if (unstaged.length > 0) await DiscardFiles(unstaged)
      if (staged.length > 0) await DiscardStagedFiles(staged)
    },
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to discard: ${parseGitError(err)}`, 'danger'),
  })

  const stageSelected = useCallback(() => {
    const paths = selectedUnstaged.map(e => e.file.path)
    if (paths.length === 0) return
    stageSelectedMutation.mutate(paths)
  }, [selectedUnstaged, stageSelectedMutation])

  const discardSelected = useCallback(() => {
    const unstaged = discardableUnstaged.map(e => e.file.path)
    const staged = discardableStaged.map(e => e.file.path)
    if (unstaged.length === 0 && staged.length === 0) return
    discardSelectedMutation.mutate({ unstaged, staged })
  }, [discardableUnstaged, discardableStaged, discardSelectedMutation])

  const confirmDiscard = useCallback((file: FileStatus, staged: boolean) => {
    setContextMenu(null)
    setDiscardConfirm({ file, staged })
  }, [])

  const executeDiscard = useCallback(() => {
    if (discardConfirm) {
      if (discardConfirm.staged) {
        discardStagedMutation.mutate(discardConfirm.file.path)
      } else {
        discardFileMutation.mutate(discardConfirm.file.path)
      }
    }
    setDiscardConfirm(null)
    containerRef.current?.focus()
  }, [discardConfirm, discardFileMutation, discardStagedMutation])

  const selectFromKeyboard = useCallback((file: FileStatus, staged: boolean) => {
    onSelectFile(file, staged)

    // A path can appear in both sections. Scroll only its own list, not the
    // panel or page, and leave focus on the keyboard navigation container.
    const row = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[data-file-path]') ?? [])
      .find(el => el.dataset.filePath === file.path && el.dataset.staged === String(staged))
    const list = row?.parentElement
    if (!row || !list) return

    const bounds = row.getBoundingClientRect()
    const top = list.getBoundingClientRect().top + list.clientTop
    const bottom = top + list.clientHeight
    if (bounds.top < top) {
      list.scrollTop += bounds.top - top
    } else if (bounds.bottom > bottom) {
      list.scrollTop += Math.min(bounds.bottom - bottom, bounds.top - top)
    }
  }, [onSelectFile])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    if (contextMenu || discardConfirm) return

    switch (e.key) {
      case 'ArrowDown':
      case 'j': {
        e.preventDefault()
        const next = allEntries[Math.min(currentIdx + 1, allEntries.length - 1)]
        if (next) selectFromKeyboard(next.file, next.staged)
        break
      }
      case 'ArrowUp':
      case 'k': {
        e.preventDefault()
        const prev = allEntries[Math.max(currentIdx - 1, 0)]
        if (prev) selectFromKeyboard(prev.file, prev.staged)
        break
      }
      case 's':
      case 'S': {
        e.preventDefault()
        const cur = allEntries[currentIdx]
        if (cur && !cur.staged && !isConflictedStatus(cur.file)) {
          stageFileMutation.mutate(cur.file.path)
          containerRef.current?.focus()
        }
        break
      }
      case 'u':
      case 'U': {
        e.preventDefault()
        const cur = allEntries[currentIdx]
        if (cur && cur.staged) {
          unstageFileMutation.mutate(cur.file.path)
          containerRef.current?.focus()
        }
        break
      }
      case 'd':
      case 'D': {
        e.preventDefault()
        const cur = allEntries[currentIdx]
        if (!cur) break
        setDiscardConfirm({ file: cur.file, staged: cur.staged })
        break
      }
      case 'G': {
        e.preventDefault()
        const last = allEntries[allEntries.length - 1]
        if (last) selectFromKeyboard(last.file, last.staged)
        break
      }
      case '[': {
        e.preventDefault()
        const first = allEntries.find(e => !e.staged)
        if (first) selectFromKeyboard(first.file, false)
        break
      }
      case ']': {
        e.preventDefault()
        const first = allEntries.find(e => e.staged)
        if (first) selectFromKeyboard(first.file, true)
        break
      }
      case 'l': {
        if (!e.ctrlKey) break
        e.preventDefault()
        focusPanel(nextPanel)
        break
      }
      case 'ArrowRight':
      case 'Enter':
      case 'Tab': {
        e.preventDefault()
        if (e.shiftKey) break
        focusPanel(nextPanel)
        break
      }
    }
  }, [allEntries, currentIdx, selectFromKeyboard, nextPanel, stageFileMutation, unstageFileMutation, contextMenu, discardConfirm])

  return (
    <>
      <div
        ref={containerRef}
        data-panel="changes-filelist"
        tabIndex={0}
        onMouseDown={e => {
          // Focus the panel on any click except on buttons (Stage All, action icons)
          if (!(e.target as HTMLElement).closest('button')) {
            containerRef.current?.focus()
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={e => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) setFocused(false)
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid var(--border-sub)',
          background: 'var(--bg-sidebar)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          boxShadow: focused ? 'inset 2px 0 0 var(--acc)' : 'none',
        }}
      >
        {/* Bulk action bar for a multi-selection */}
        {selectionActive && selectedKeys.length > 0 && (
          <div
            role="toolbar"
            aria-label={t('fileSelection.toolbar')}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px',
              borderBottom: '1px solid var(--border-sub)',
              background: 'color-mix(in srgb, var(--acc) 12%, transparent)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--acc)', flex: 1, whiteSpace: 'nowrap' }}>
              {t('fileSelection.count', { count: selectedKeys.length })}
            </span>
            <Button
              variant="ghost"
              onClick={stageSelected}
              disabled={selectedUnstaged.length === 0 || stageSelectedMutation.isPending}
              title={t('fileSelection.stageTitle')}
              style={{ fontSize: 11, padding: '1px 6px' }}
            >
              {t('fileSelection.stage')}
            </Button>
            <Button
              variant="ghost"
              onClick={discardSelected}
              disabled={(discardableUnstaged.length === 0 && discardableStaged.length === 0) || discardSelectedMutation.isPending}
              title={t('fileSelection.discardTitle')}
              style={{ fontSize: 11, padding: '1px 6px', color: 'var(--danger)' }}
            >
              {t('fileSelection.discard')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => selectKeys([])}
              title={t('fileSelection.clearTitle')}
              style={{ fontSize: 11, padding: '1px 6px' }}
            >
              {t('fileSelection.clear')}
            </Button>
          </div>
        )}

        {/* Conflicts section */}
        {conflictedFiles.length > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-sub)' }}>
            <SectionHeader
              title="Conflicts"
              aria-label="Conflicts"
              count={conflictedFiles.length}
              accentBg="color-mix(in srgb, var(--danger) 10%, var(--bg-sidebar))"
            />
            <div>
              {conflictedFiles.map(file => (
                <FileRow
                  key={file.path}
                  file={file}
                  staged={false}
                  statusCode="!"
                  selected={file.path === selectedFile && !selectedStaged}
                  multiSelected={selectedKeys.includes(fileEntryKey(file, false))}
                  onSelect={(e) => handleRowClick({ file, staged: false, key: fileEntryKey(file, false) }, e)}
                  onContextMenu={e => handleContextMenu(e, file, false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Unstaged section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: '1px solid var(--border-sub)' }}>
          <SectionHeader
            title="Unstaged"
            aria-label="Unstaged"
            count={unstagedFiles.length}
            actionLabel="Stage All"
            onAction={() => stageAllMutation.mutate(unstagedFiles.map(f => f.path))}
            accentBg="var(--bg-unstaged-sec)"
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {unstagedFiles.map(file => (
              <FileRow
                key={file.path}
                file={file}
                staged={false}
                statusCode={file.unstaged || file.staged}
                selected={file.path === selectedFile && !selectedStaged}
                multiSelected={selectedKeys.includes(fileEntryKey(file, false))}
                onSelect={(e) => handleRowClick({ file, staged: false, key: fileEntryKey(file, false) }, e)}
                onContextMenu={e => handleContextMenu(e, file, false)}
                actionIcon="+"
                actionTitle="Stage"
                onAction={() => stageFileMutation.mutate(file.path)}
              />
            ))}
            {unstagedFiles.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-ter)' }}>
                No unstaged changes
              </div>
            )}
          </div>
        </div>

        {/* Staged section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <SectionHeader
            title="Staged"
            aria-label="Staged"
            count={stagedFiles.length}
            actionLabel="Unstage All"
            onAction={() => unstageAllMutation.mutate(stagedFiles.map(f => f.path))}
            accentBg="var(--bg-staged-sec)"
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {stagedFiles.map(file => (
              <FileRow
                key={file.path}
                file={file}
                staged={true}
                statusCode={file.staged}
                selected={file.path === selectedFile && selectedStaged}
                multiSelected={selectedKeys.includes(fileEntryKey(file, true))}
                onSelect={(e) => handleRowClick({ file, staged: true, key: fileEntryKey(file, true) }, e)}
                onContextMenu={e => handleContextMenu(e, file, true)}
                actionIcon="−"
                actionTitle="Unstage"
                onAction={() => unstageFileMutation.mutate(file.path)}
              />
            ))}
            {stagedFiles.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-ter)' }}>
                No staged changes
              </div>
            )}
          </div>
        </div>

        {/* Keyboard hints */}
        {focused && (
          <KeyHints hints={[
            { keys: ['↑', '↓'], label: 'Navigate' },
            { keys: ['[', ']'], label: 'Section' },
            { keys: ['Tab'], label: 'Diff' },
            { keys: ['S'], label: 'Stage' },
            { keys: ['U'], label: 'Unstage' },
            { keys: ['D'], label: 'Discard' },
          ]} />
        )}
      </div>

      {/* Context menu — overlay dismisses on click-outside */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={e => { e.preventDefault(); setContextMenu(null) }}
          />
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            file={contextMenu.file}
            staged={contextMenu.staged}
            onStage={() => { stageFileMutation.mutate(contextMenu.file.path); setContextMenu(null) }}
            onUnstage={() => { unstageFileMutation.mutate(contextMenu.file.path); setContextMenu(null) }}
            onDiscard={() => confirmDiscard(contextMenu.file, contextMenu.staged)}
            onReveal={() => { RevealInFinder(contextMenu.file.path).catch(() => {}); setContextMenu(null) }}
            onClose={() => setContextMenu(null)}
          />
        </>
      )}

      {/* Discard confirmation */}
      {discardConfirm && (
        <DiscardConfirmDialog
          filePath={discardConfirm.file.path}
          onConfirm={executeDiscard}
          onCancel={() => { setDiscardConfirm(null); containerRef.current?.focus() }}
        />
      )}
    </>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  count: number
  actionLabel?: string
  onAction?: () => void
  accentBg: string
}

function SectionHeader({ title, count, actionLabel, onAction, accentBg }: SectionHeaderProps) {
  return (
    <div style={{
      flexShrink: 0, height: 28, padding: '0 10px',
      background: accentBg,
      borderBottom: '1px solid var(--border-sub)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sec)' }}>
        {title}
        <span style={{ color: 'var(--text-ter)', marginLeft: 4 }}>({count})</span>
      </span>
      {count > 0 && actionLabel && onAction && (
        <Button variant="ghost"
          onClick={onAction}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 500, color: 'var(--acc)', padding: '1px 4px', borderRadius: 3,
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileStatus
  staged: boolean
  statusCode: string
  selected: boolean
  /** Part of a multi-selection (Ctrl/Cmd+click, Shift+click or Ctrl/Cmd+A). */
  multiSelected?: boolean
  onSelect: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  actionIcon?: string
  actionTitle?: string
  onAction?: () => void
}

function FileRow({ file, staged, statusCode, selected, multiSelected, onSelect, onContextMenu, actionIcon, actionTitle, onAction }: FileRowProps) {
  const [hovered, setHovered] = useState(false)

  const isConflict = statusCode === '!'
  const label = isConflict ? '!' : statusCode === 'A' ? 'A' : statusCode === 'D' ? 'D' : statusCode === '?' ? '?' : 'M'
  const badgeColor = isConflict ? 'var(--danger)' : label === 'A' ? 'var(--success)' : label === 'D' ? 'var(--danger)' : 'var(--warn)'

  return (
    <div
      tabIndex={-1}
      data-file-path={file.path}
      data-staged={staged}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 10px',
        display: 'flex', alignItems: 'center', gap: 7,
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-sub)',
        background: selected
          ? 'var(--bg-sel)'
          : multiSelected
          ? 'color-mix(in srgb, var(--acc) 12%, transparent)'
          : hovered
          ? 'var(--bg-hover)'
          : 'transparent',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {multiSelected && (
        <span
          aria-hidden="true"
          style={{
            width: 9, height: 9, borderRadius: 2, flexShrink: 0,
            background: 'var(--acc)',
          }}
        />
      )}
      <span style={{
        width: 17, height: 17, borderRadius: 3, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: badgeColor, color: 'white', fontSize: 10, fontWeight: 700,
      }}>
        {label}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontFamily: 'monospace', color: 'var(--text-pri)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file.path}
        </div>
        {file.oldPath && file.oldPath !== file.path && (
          <div style={{ fontSize: 10, color: 'var(--text-ter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ← {file.oldPath}
          </div>
        )}
      </div>

      {onAction && (
        <Button variant="ghost"
          onClick={e => { e.stopPropagation(); onAction() }}
          title={actionTitle}
          aria-label={actionTitle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            width: 20, height: 20, borderRadius: 3, flexShrink: 0,
            fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--text-sec)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
          }}
        >
          {actionIcon}
        </Button>
      )}
    </div>
  )
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number
  y: number
  file: FileStatus
  staged: boolean
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
  onReveal: () => void
  onClose: () => void
}

type MenuItem =
  | { kind: 'action'; label: string; shortcut?: string; danger?: boolean; action: () => void }
  | { kind: 'separator' }

function ContextMenu({ x, y, file, staged, onStage, onUnstage, onDiscard, onReveal, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [focusedIdx, setFocusedIdx] = useState(0)

  const conflict = isConflictedStatus(file)
  const isUntracked = file.staged === '?' && file.unstaged === '?'

  const items: MenuItem[] = []
  if (!staged && !conflict) items.push({ kind: 'action', label: 'Stage', shortcut: 'S', action: onStage })
  if (staged) items.push({ kind: 'action', label: 'Unstage', shortcut: 'U', action: onUnstage })
  if (!isUntracked && !conflict) items.push({ kind: 'action', label: 'Discard Changes…', shortcut: 'D', danger: true, action: onDiscard })
  items.push({ kind: 'separator' })
  items.push({ kind: 'action', label: 'Reveal in Finder', action: onReveal })

  const actionItems = items.filter((it): it is Extract<MenuItem, { kind: 'action' }> => it.kind === 'action')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(i => (i + 1) % actionItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx(i => (i - 1 + actionItems.length) % actionItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      actionItems[focusedIdx]?.action()
    }
  }

  // Clamp to viewport
  const style: React.CSSProperties = { top: y, left: x }
  if (typeof window !== 'undefined') {
    const menuH = actionItems.length * 34 + 16
    const menuW = 210
    if (y + menuH > window.innerHeight) style.top = y - menuH
    if (x + menuW > window.innerWidth) style.left = x - menuW
  }

  let actionIdx = -1

  return (
    <div
      ref={menuRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed', zIndex: 1000,
        ...style,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        padding: '4px 0',
        minWidth: 210,
        outline: 'none',
      }}
    >
      {items.map((item, i) => {
        if (item.kind === 'separator') {
          return <div key={i} style={{ height: 1, background: 'var(--border-sub)', margin: '4px 0' }} />
        }
        actionIdx++
        const thisActionIdx = actionIdx
        const isFocused = thisActionIdx === focusedIdx
        return (
          <div
            key={i}
            onClick={e => { e.stopPropagation(); item.action() }}
            onMouseEnter={() => setFocusedIdx(thisActionIdx)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px', gap: 24,
              cursor: 'pointer',
              fontSize: 12,
              color: item.danger ? 'var(--danger)' : 'var(--text-pri)',
              background: isFocused ? 'var(--bg-sel)' : 'transparent',
              borderRadius: 4, margin: '0 4px',
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <kbd style={{
                fontSize: 10, fontFamily: 'monospace',
                color: 'var(--text-ter)',
                background: 'var(--bg-badge)',
                border: '1px solid var(--border)',
                borderRadius: 3, padding: '0 4px', lineHeight: '16px',
              }}>
                {item.shortcut}
              </kbd>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Discard confirm dialog ───────────────────────────────────────────────────

interface DiscardConfirmDialogProps {
  filePath: string
  onConfirm: () => void
  onCancel: () => void
}

function DiscardConfirmDialog({ filePath, onConfirm, onCancel }: DiscardConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const discardRef = useRef<HTMLButtonElement>(null)

  // Auto-focus Cancel for safety
  const cancelCb = useCallback((el: HTMLButtonElement | null) => {
    el?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return }
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (document.activeElement === cancelRef.current) {
        discardRef.current?.focus()
      } else {
        cancelRef.current?.focus()
      }
    }
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 24px',
          width: 340,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-pri)', marginBottom: 6 }}>
            Discard Changes?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5 }}>
            All changes to{' '}
            <code style={{ fontFamily: 'monospace', color: 'var(--danger)', wordBreak: 'break-all' }}>
              {filePath}
            </code>
            {' '}will be permanently lost.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            ref={el => { cancelRef.current = el; cancelCb(el) }}
            onClick={onCancel}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            ref={discardRef}
            onClick={onConfirm}
            variant="danger"
          >
            Discard
          </Button>
        </div>

      </div>
    </div>
  )
}
