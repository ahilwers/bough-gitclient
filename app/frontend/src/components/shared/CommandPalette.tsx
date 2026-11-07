import { Button } from './Button'
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'

interface Command {
  label: string
  shortcut?: string
  action: () => void
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setActiveView, activeRepo } = useGitStore()

  const commands: Command[] = useMemo(() => [
    { label: 'History view',  shortcut: '⌘1', action: () => setActiveView('history') },
    { label: 'Changes view',  shortcut: '⌘2', action: () => setActiveView('changes') },
    { label: 'Fetch',         shortcut: '⌘F', action: () => {} },
    { label: 'Pull',          shortcut: '⌘L', action: () => {} },
    { label: 'Push',          shortcut: '⌘P', action: () => {} },
    ...(activeRepo ? [
      { label: 'New Branch', action: () => window.dispatchEvent(new CustomEvent('git:create', { detail: 'branch' })) },
      { label: 'Stash', action: () => window.dispatchEvent(new CustomEvent('git:create', { detail: 'stash' })) },
      { label: 'New Tag', action: () => window.dispatchEvent(new CustomEvent('git:create', { detail: 'tag' })) },
    ] : []),
    { label: 'Commit',        shortcut: '⌘↵', action: () => {} },
  ], [setActiveView, activeRepo])

  const filtered = useMemo(() =>
    query.trim()
      ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
      : commands,
    [query, commands]
  )

  // Reset active index when filtered list changes
  useEffect(() => setActiveIdx(0), [filtered])

  useEffect(() => {
    const onOpen = () => { setOpen(true); setQuery('') }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => { if (!v) setQuery(''); return !v })
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('palette:open', onOpen)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('palette:open', onOpen)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  const run = (cmd: Command) => {
    cmd.action()
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[activeIdx]) run(filtered[activeIdx])
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 120,
            zIndex: 1000,
          }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={e => e.stopPropagation()}
            onKeyDown={onKeyDown}
            style={{
              width: 400,
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-sub)',
            }}>
              <Search size={16} style={{ color: 'var(--text-ter)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search commands…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  color: 'var(--text-pri)',
                }}
              />
            </div>

            {/* Command list */}
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-ter)' }}>
                  No commands found
                </div>
              )}
              {filtered.map((cmd, idx) => (
                <Button variant="ghost"
                  key={cmd.label}
                  onClick={() => run(cmd)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    border: 'none',
                    background: idx === activeIdx ? 'var(--bg-sel)' : 'transparent',
                    color: 'var(--text-pri)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{cmd.label}</span>
                  {cmd.shortcut && (
                    <span style={{ fontSize: 11, color: 'var(--text-ter)', fontFamily: 'monospace' }}>
                      {cmd.shortcut}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
