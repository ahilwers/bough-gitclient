import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useCommitFiles } from '@/hooks/useCommitFiles'
import { DiffViewer } from '@/components/HistoryView/DiffViewer'
import { formatRelativeDate } from '@/lib/format'
import type { CommitNode } from '@/lib/types'

interface Props {
  commit: CommitNode
  onClose: () => void
}

export function MergeCommitDetailDialog({ commit, onClose }: Props) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const { data: diffFiles = [], isLoading } = useCommitFiles(commit.hash)
  const files = diffFiles.map(f => f.path)

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
        <Dialog.Content
          style={{
            position: 'fixed', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 'min(820px, 90vw)',
            height: 'min(640px, 85vh)',
            background: 'var(--bg-panel)',
            borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            zIndex: 50,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            flexShrink: 0, padding: '14px 18px',
            borderBottom: '1px solid var(--border-sub)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Dialog.Title style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-pri)', margin: 0, marginBottom: 6 }}>
                {commit.message}
              </Dialog.Title>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-sec)' }}>
                <code style={{ fontFamily: 'monospace', color: 'var(--acc)' }}>{commit.shortHash}</code>
                <span>{commit.author}</span>
                <span>{formatRelativeDate(commit.date)}</span>
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4, borderRadius: 4, flexShrink: 0 }}
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Body: file list + diff */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* File list */}
            <div style={{
              width: 220, flexShrink: 0,
              borderRight: '1px solid var(--border-sub)',
              overflowY: 'auto',
              background: 'var(--bg-sidebar)',
            }}>
              {isLoading && (
                <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-ter)' }}>Loading…</div>
              )}
              {files.map(f => (
                <div
                  key={f}
                  onClick={() => setSelectedFile(f)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11, fontFamily: 'monospace',
                    cursor: 'pointer',
                    color: selectedFile === f ? 'var(--text-acc)' : 'var(--text-sec)',
                    background: selectedFile === f ? 'var(--bg-sel)' : 'transparent',
                    borderBottom: '1px solid var(--border-sub)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={f}
                >
                  {f}
                </div>
              ))}
              {!isLoading && files.length === 0 && (
                <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-ter)' }}>No files changed</div>
              )}
            </div>

            {/* Diff area */}
            <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-content)' }}>
              {selectedFile ? (
                <DiffViewer commitHash={commit.hash} filePath={selectedFile} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-ter)' }}>
                  Select a file to view its diff
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
