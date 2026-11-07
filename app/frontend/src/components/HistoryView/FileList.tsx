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

import { FileIcon } from 'lucide-react'
import type { DiffFile } from '@/lib/types'

interface FileListProps {
  files: DiffFile[]
  selectedFile: string | null
  onSelect: (path: string) => void
}

export function FileList({ files, selectedFile, onSelect }: FileListProps) {
  const totalAdded = files.reduce((sum, f) =>
    sum + (f.hunks?.flatMap(h => h.lines).filter(l => l.type === 'add').length ?? 0), 0)
  const totalDeleted = files.reduce((sum, f) =>
    sum + (f.hunks?.flatMap(h => h.lines).filter(l => l.type === 'del').length ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 12px', borderBottom: '1px solid var(--border-sub)',
        fontSize: 11, flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-sec)' }}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
        {totalAdded > 0 && <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{totalAdded}</span>}
        {totalDeleted > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>−{totalDeleted}</span>}
      </div>

      {/* File rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {files.map(file => (
          <FileRow
            key={file.path}
            file={file}
            selected={file.path === selectedFile}
            onSelect={() => onSelect(file.path)}
          />
        ))}
        {files.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--text-ter)', textAlign: 'center' }}>
            No files changed
          </div>
        )}
      </div>
    </div>
  )
}

interface FileRowProps {
  file: DiffFile
  selected: boolean
  onSelect: () => void
}

function FileRow({ file, selected, onSelect }: FileRowProps) {
  const added = file.hunks?.flatMap(h => h.lines).filter(l => l.type === 'add').length ?? 0
  const deleted = file.hunks?.flatMap(h => h.lines).filter(l => l.type === 'del').length ?? 0
  const isRenamed = file.oldPath && file.oldPath !== file.path

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', cursor: 'pointer',
        borderBottom: '1px solid var(--border-sub)',
        background: selected ? 'var(--bg-sel)' : 'transparent',
        userSelect: 'none',
      }}
    >
      <FileIcon size={13} style={{ color: 'var(--text-ter)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-pri)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {file.path}
        </div>
        {isRenamed && (
          <div style={{ fontSize: 10, color: 'var(--text-ter)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            ← {file.oldPath}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 11, flexShrink: 0 }}>
        {added > 0 && <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{added}</span>}
        {deleted > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>−{deleted}</span>}
      </div>
    </div>
  )
}
