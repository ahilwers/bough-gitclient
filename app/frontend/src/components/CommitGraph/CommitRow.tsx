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

import type { CommitNode } from '@/lib/types'
import { formatRelativeDate } from '@/lib/format'
import { graphColor } from '@/lib/colors'
import { ContextMenu } from '@/components/shared/ContextMenu'

const ROW_HEIGHT = 34

interface CommitRowProps {
  commit: CommitNode
  isSelected: boolean
  isMultiSelected: boolean
  graphWidth: number
  authorWidth: number
  dateWidth: number
  style?: React.CSSProperties
  onClick: (hash: string, event: React.MouseEvent) => void
  onDragStart: (commit: CommitNode) => void
  onDragEnd: () => void
  onCherryPick: (hashes: string[], combinedMessage: string) => void
  // hashes + messages of all currently selected commits (for multi-pick context menu)
  selectedCommits: string[]
  selectedCommitMessages: string[]
  currentBranch: string
  // Rebase callbacks (only offered for non-merge commits on local branches)
  onOpenRebaseEditor: (anchorHash: string) => void
  onReword: (commit: CommitNode) => void
  onSquash: (commit: CommitNode) => void
  onDrop: (commit: CommitNode) => void
}

export function CommitRow({
  commit,
  isSelected,
  isMultiSelected,
  graphWidth,
  authorWidth,
  dateWidth,
  style,
  onClick,
  onDragStart,
  onDragEnd,
  onCherryPick,
  selectedCommits,
  selectedCommitMessages,
  currentBranch,
  onOpenRebaseEditor,
  onReword,
  onSquash,
  onDrop,
}: CommitRowProps) {
  const timeAgo = formatRelativeDate(commit.date)

  // Determine which commits to cherry-pick from context menu:
  // if this commit is part of the multi-selection, use all selected; otherwise just this one.
  const isInSelection = selectedCommits.includes(commit.hash)
  const contextPickHashes = isInSelection && selectedCommits.length > 1
    ? selectedCommits
    : [commit.hash]
  const contextPickMessage = isInSelection && selectedCommits.length > 1
    ? selectedCommitMessages.join('\n\n---\n\n')
    : commit.fullMessage

  // Rebase actions are only available for single non-merge commits.
  const isMergeCommit = commit.parents.length > 1
  const canRebase = !isMergeCommit

  const contextItems = [
    {
      label: contextPickHashes.length > 1
        ? `Cherry-pick ${contextPickHashes.length} commits onto '${currentBranch}'`
        : `Cherry-pick onto '${currentBranch}'`,
      onClick: () => onCherryPick(contextPickHashes, contextPickMessage),
    },
    ...(canRebase ? [
      { type: 'separator' as const },
      { label: 'Reword Commit…', onClick: () => onReword(commit) },
      { label: 'Squash into Parent', onClick: () => onSquash(commit) },
      { label: 'Drop Commit', onClick: () => onDrop(commit), destructive: true },
      { type: 'separator' as const },
      { label: 'Interactive Rebase from here…', onClick: () => onOpenRebaseEditor(commit.hash) },
    ] : []),
  ]

  const bg = isSelected
    ? 'color-mix(in srgb, var(--acc) 18%, transparent)'
    : isMultiSelected
    ? 'color-mix(in srgb, var(--acc) 10%, transparent)'
    : 'transparent'

  return (
    <ContextMenu items={contextItems}>
      <div
        style={{
          height: ROW_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          background: bg,
          cursor: 'pointer',
          userSelect: 'none',
          outline: isMultiSelected && !isSelected ? '1px solid color-mix(in srgb, var(--acc) 35%, transparent)' : 'none',
          outlineOffset: -1,
          ...style,
        }}
        onClick={(e) => onClick(commit.hash, e)}
        draggable
        onDragStart={(e) => {
          // If this commit is part of the multi-selection, drag all selected commits.
          // Otherwise drag just this one.
          const hashes = isInSelection && selectedCommits.length > 1
            ? selectedCommits
            : [commit.hash]
          const messages = isInSelection && selectedCommits.length > 1
            ? selectedCommitMessages
            : [commit.fullMessage]
          e.dataTransfer.setData('commits', JSON.stringify({ hashes, messages }))
          e.dataTransfer.effectAllowed = 'copy'
          // Ghost label
          const ghost = document.createElement('div')
          ghost.textContent = hashes.length > 1 ? `Cherry-pick ${hashes.length} commits` : `Cherry-pick ${commit.shortHash}`
          Object.assign(ghost.style, {
            position: 'absolute', top: '-999px',
            background: 'var(--bg-panel)', color: 'var(--text-pri)',
            padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
            border: '1px solid var(--acc)', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          })
          document.body.appendChild(ghost)
          e.dataTransfer.setDragImage(ghost, 0, 10)
          setTimeout(() => document.body.removeChild(ghost), 0)
          onDragStart(commit)
        }}
        onDragEnd={onDragEnd}
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
      >
        {/* Graph spacer — canvas draws behind this */}
        <div style={{ width: graphWidth, flexShrink: 0 }} />

        {/* Summary: refs + short hash + message */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', paddingRight: 8 }}>
          {commit.refs && commit.refs.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {commit.refs.map((ref, idx) => (
                <RefChip key={idx} name={ref.name} colorIndex={commit.color} isHead={ref.isHead} />
              ))}
            </div>
          )}
          <code style={{
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-ter)',
            flexShrink: 0,
            width: 52,
          }}>
            {commit.shortHash}
          </code>
          <span style={{
            fontSize: 13,
            color: 'var(--text-pri)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}>
            {commit.message}
          </span>
        </div>

        {/* Author */}
        <div style={{
          width: authorWidth,
          flexShrink: 0,
          fontSize: 12,
          color: 'var(--text-ter)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          paddingLeft: 8,
          paddingRight: 8,
        }}>
          {commit.author}
        </div>

        {/* Date */}
        <div style={{
          width: dateWidth,
          flexShrink: 0,
          fontSize: 12,
          color: 'var(--text-ter)',
          whiteSpace: 'nowrap',
          paddingLeft: 8,
          paddingRight: 8,
          textAlign: 'right',
        }}>
          {timeAgo}
        </div>
      </div>
    </ContextMenu>
  )
}

interface RefChipProps {
  name: string
  colorIndex: number
  isHead: boolean
}

function RefChip({ name, colorIndex, isHead }: RefChipProps) {
  const bg = graphColor(colorIndex)
  const label = name
    .replace(/^refs\/(heads|remotes)\//, '')
    .replace(/^HEAD -> /, '')

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
        color: 'white',
        backgroundColor: bg,
        opacity: isHead ? 1 : 0.85,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        maxWidth: 110,
        flexShrink: 0,
      }}
      title={label}
    >
      {label}
    </span>
  )
}
