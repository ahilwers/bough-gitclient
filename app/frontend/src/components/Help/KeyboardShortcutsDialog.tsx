import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'

// ─── Data ─────────────────────────────────────────────────────────────────────

interface ShortcutRow {
  keys: string[]
  label: string
}

interface Section {
  title: string
  rows: ShortcutRow[]
}

const SECTIONS: Section[] = [
  {
    title: 'General',
    rows: [
      { keys: ['?'], label: 'Open keyboard shortcuts' },
      { keys: ['⌘K'], label: 'Open command palette' },
    ],
  },
  {
    title: 'Changes — File List',
    rows: [
      { keys: ['↑', '↓', 'j', 'k'], label: 'Navigate files' },
      { keys: ['['], label: 'Jump to first unstaged file' },
      { keys: [']'], label: 'Jump to first staged file' },
      { keys: ['G'], label: 'Jump to last file' },
      { keys: ['S'], label: 'Stage selected file' },
      { keys: ['U'], label: 'Unstage selected file' },
      { keys: ['D'], label: 'Discard changes (with confirmation)' },
      { keys: ['Tab', '→', 'Ctrl+L'], label: 'Move focus to diff panel' },
    ],
  },
  {
    title: 'Changes — Diff Panel',
    rows: [
      { keys: ['↑', '↓', 'j', 'k'], label: 'Scroll' },
      { keys: ['Ctrl+D'], label: 'Scroll half page down' },
      { keys: ['Ctrl+U'], label: 'Scroll half page up' },
      { keys: ['PgDn', 'PgUp'], label: 'Scroll full page' },
      { keys: ['Tab', 'Ctrl+L'], label: 'Move focus to commit box' },
      { keys: ['Shift+Tab', 'Ctrl+H', 'Esc'], label: 'Move focus back to file list' },
    ],
  },
  {
    title: 'Changes — Commit Box',
    rows: [
      { keys: ['C'], label: 'Focus commit message (from any panel)' },
      { keys: ['⌘↵'], label: 'Commit' },
      { keys: ['Esc', 'Shift+Tab'], label: 'Move focus to diff panel' },
    ],
  },
  {
    title: 'History — Commit List',
    rows: [
      { keys: ['↑', '↓', 'j', 'k'], label: 'Navigate commits' },
      { keys: ['G'], label: 'Jump to last commit' },
      { keys: ['Ctrl+D'], label: 'Scroll half page down' },
      { keys: ['Ctrl+U'], label: 'Scroll half page up' },
      { keys: ['Shift+↑/↓'], label: 'Extend selection (range)' },
      { keys: ['⌘+Click'], label: 'Toggle commit in selection' },
      { keys: ['Shift+Click'], label: 'Select range' },
      { keys: ['Tab', 'Ctrl+L'], label: 'Move focus to detail panel' },
      { keys: ['Esc'], label: 'Clear multi-selection' },
    ],
  },
  {
    title: 'History — Commit Detail',
    rows: [
      { keys: ['↑', '↓', 'j', 'k'], label: 'Scroll' },
      { keys: ['Ctrl+D'], label: 'Scroll half page down' },
      { keys: ['Ctrl+U'], label: 'Scroll half page up' },
      { keys: ['Tab', 'Ctrl+H', 'Esc'], label: 'Move focus back to commit list' },
    ],
  },
  {
    title: 'Context Menus',
    rows: [
      { keys: ['↑', '↓'], label: 'Navigate items' },
      { keys: ['↵'], label: 'Activate item' },
      { keys: ['Esc'], label: 'Close menu' },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function KeyboardShortcutsDialog() {
  const { helpDialogOpen, setHelpDialogOpen } = useGitStore()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!helpDialogOpen) return
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        setHelpDialogOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [helpDialogOpen, setHelpDialogOpen])

  if (!helpDialogOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={() => setHelpDialogOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          width: 680,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-sub)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-pri)' }}>Keyboard Shortcuts</div>
            <div style={{ fontSize: 11, color: 'var(--text-ter)', marginTop: 2 }}>Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close</div>
          </div>
          <button
            ref={closeRef}
            onClick={() => setHelpDialogOpen(false)}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: 'none', background: 'transparent',
              color: 'var(--text-ter)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px 28px',
          alignItems: 'start',
        }}>
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--acc)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: 8,
              }}>
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {section.rows.map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12,
                    padding: '4px 0',
                    borderBottom: '1px solid var(--border-sub)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-sec)', flex: 1 }}>
                      {row.label}
                    </span>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {row.keys.map((k, j) => (
                        <Kbd key={j}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 5px',
      borderRadius: 4,
      border: '1px solid var(--border)',
      background: 'var(--bg-badge)',
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: 600,
      color: 'var(--text-sec)',
      lineHeight: '16px',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </kbd>
  )
}
