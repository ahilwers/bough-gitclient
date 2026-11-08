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
import { useState, useRef, useCallback } from 'react'
import { Copy, ChevronRight } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'
import { useCommits } from '@/hooks/useCommits'
import { useCommitFiles } from '@/hooks/useCommitFiles'
import { FileList } from './FileList'
import { DiffViewer } from './DiffViewer'
import { KeyHints } from '@/components/shared/KeyHints'
import { formatRelativeDate } from '@/lib/format'

interface CommitDetailPanelProps {
  commitHash: string
}

export function CommitDetailPanel({ commitHash }: CommitDetailPanelProps) {
  const { setSelectedCommit } = useGitStore()
  const [activeTab, setActiveTab] = useState<'files' | 'diff'>('files')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [shownHash, setShownHash] = useState(commitHash)
  const [copied, setCopied] = useState(false)
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Start fresh whenever the displayed commit changes: clear the file
  // selection and land on the Files tab, so the panel never shows a diff for
  // a file that belonged to the previously selected commit. (Done during
  // render so the stale diff is never committed to the screen.)
  if (shownHash !== commitHash) {
    setShownHash(commitHash)
    setActiveTab('files')
    setSelectedFile(null)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    const scroll = scrollRef.current
    const half = scroll ? scroll.clientHeight * 0.5 : 0
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        scroll?.scrollBy({ top: 60 })
        break
      case 'ArrowUp':
        e.preventDefault()
        scroll?.scrollBy({ top: -60 })
        break
      case 'j':
        if (e.ctrlKey) break
        e.preventDefault()
        scroll?.scrollBy({ top: 60 })
        break
      case 'k':
        if (e.ctrlKey) break
        e.preventDefault()
        scroll?.scrollBy({ top: -60 })
        break
      case 'd':
        if (!e.ctrlKey) break
        e.preventDefault()
        scroll?.scrollBy({ top: half })
        break
      case 'u':
        if (!e.ctrlKey) break
        e.preventDefault()
        scroll?.scrollBy({ top: -half })
        break
      case 'PageDown':
        e.preventDefault()
        scroll?.scrollBy({ top: (scroll?.clientHeight ?? 0) * 0.85 })
        break
      case 'PageUp':
        e.preventDefault()
        scroll?.scrollBy({ top: -(scroll?.clientHeight ?? 0) * 0.85 })
        break
      case 'h':
        if (!e.ctrlKey) break
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-panel="history-commits"]')?.focus()
        break
      case 'Tab':
      case 'Escape':
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-panel="history-commits"]')?.focus()
        break
    }
  }, [])

  // Find commit metadata from already-loaded list (no extra network call)
  const { data: commits = [], isLoading: commitsLoading } = useCommits()
  const commit = commits.find(c => c.hash === commitHash) ?? null

  // Only query the commit's files once its metadata is actually available;
  // calling GetCommitDiff on a hash that is not part of the loaded history
  // (e.g. a stale selection from a previous repository) would fail noisily.
  const { data: files = [], isLoading: filesLoading } = useCommitFiles(commit ? commitHash : null)

  function copyHash() {
    navigator.clipboard.writeText(commitHash).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleFileSelect(path: string) {
    setSelectedFile(path)
    setActiveTab('diff')
  }

  if (!commit) {
    return (
      <div style={{ flex: 1, borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)', color: 'var(--text-ter)', fontSize: 12 }}>
        {commitsLoading ? 'Loading…' : 'Select a commit to view details'}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-panel="history-detail"
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={e => { if (!containerRef.current?.contains(e.relatedTarget as Node)) setFocused(false) }}
      onKeyDown={handleKeyDown}
      style={{
        flex: 1,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        outline: 'none',
        boxShadow: focused ? 'inset 2px 0 0 var(--acc)' : 'none',
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-sub)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Hash + copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{
            flex: 1, padding: '4px 8px', background: 'var(--bg-content)',
            borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
            color: 'var(--text-sec)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {commit.hash}
          </code>
          <Button variant="ghost"
            onClick={copyHash}
            title="Copy full hash"
            aria-label="Copy full hash"
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success)' : 'var(--text-ter)', borderRadius: 4 }}
          >
            <Copy size={13} />
          </Button>
        </div>

        {/* Full message */}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-pri)', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {commit.fullMessage || commit.message}
        </p>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11 }}>
          <div>
            <div style={{ color: 'var(--text-ter)', marginBottom: 2 }}>Author</div>
            <div style={{ color: 'var(--text-pri)', fontWeight: 500 }}>{commit.author}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-ter)', marginBottom: 2 }}>Date</div>
            <div style={{ color: 'var(--text-pri)' }}>{formatRelativeDate(commit.date)}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: 'var(--text-ter)', marginBottom: 2 }}>Email</div>
            <div style={{ color: 'var(--text-sec)', fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.email}</div>
          </div>
        </div>

        {/* Parent links */}
        {commit.parents.length > 0 && (
          <div>
            <div style={{ color: 'var(--text-ter)', fontSize: 11, marginBottom: 4 }}>
              {commit.parents.length === 1 ? 'Parent' : 'Parents'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {commit.parents.map((p, i) => (
                <code
                  key={i}
                  onClick={() => setSelectedCommit(p)}
                  style={{
                    padding: '2px 6px', background: 'var(--bg-content)',
                    borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
                    color: 'var(--acc)', cursor: 'pointer',
                  }}
                  title={p}
                >
                  {p.slice(0, 7)}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab strip */}
      <div style={{
        display: 'flex', gap: 4, padding: '6px 10px',
        borderBottom: '1px solid var(--border-sub)',
        background: 'var(--bg-content)', flexShrink: 0,
      }}>
        <TabButton label="Files" count={files.length} active={activeTab === 'files'} onClick={() => setActiveTab('files')} />
        <TabButton label="Diff" active={activeTab === 'diff'} onClick={() => setActiveTab('diff')} />
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'files' && (
          filesLoading
            ? <Loading />
            : <FileList files={files} selectedFile={selectedFile} onSelect={handleFileSelect} />
        )}
        {activeTab === 'diff' && selectedFile && (
          <DiffViewer commitHash={commitHash} filePath={selectedFile} />
        )}
        {activeTab === 'diff' && !selectedFile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-ter)', fontSize: 12 }}>
            <ChevronRight size={20} />
            Select a file from the Files tab
          </div>
        )}
      </div>

      {focused && (
        <KeyHints hints={[
          { keys: ['↑', '↓'], label: 'Scroll' },
          { keys: ['Tab', 'Esc'], label: 'Commits' },
        ]} />
      )}
    </div>
  )
}

interface TabButtonProps {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}

function TabButton({ label, count, active, onClick }: TabButtonProps) {
  return (
    <Button variant="ghost"
      onClick={onClick}
      style={{
        padding: '3px 10px', border: 'none', borderRadius: 4,
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        background: active ? 'var(--acc)' : 'transparent',
        color: active ? 'white' : 'var(--text-sec)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 10, opacity: 0.8 }}>{count}</span>
      )}
    </Button>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'var(--text-ter)' }}>
      Loading…
    </div>
  )
}
