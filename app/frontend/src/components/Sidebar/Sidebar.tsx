import { useState } from 'react'
import { ChevronRight, GitBranch, Globe, Tag, Archive, Layers, Plus } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useWorktrees } from '@/hooks/useWorktrees'
import type { WorktreeInfo } from '@/lib/types'

export default function Sidebar() {
  const [expanded, setExpanded] = useState({
    branches: true,
    remotes: true,
    tags: false,
    stashes: false,
    worktrees: true,
  })

  const { data: branches } = useBranches()
  const { data: worktrees } = useWorktrees()

  const toggle = (key: keyof typeof expanded) =>
    setExpanded(s => ({ ...s, [key]: !s[key] }))

  return (
    <aside
      style={{
        width: 200,
        flexShrink: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-sub)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Section
        title="Branches"
        icon={<GitBranch size={13} />}
        expanded={expanded.branches}
        onToggle={() => toggle('branches')}
        onAdd={() => {}}
      >
        {branches?.local?.map(b => (
          <SidebarItem key={b.name} label={b.name} isActive={b.isHead} />
        ))}
      </Section>

      <Section
        title="Remotes"
        icon={<Globe size={13} />}
        expanded={expanded.remotes}
        onToggle={() => toggle('remotes')}
      >
        {branches?.remotes?.map(b => (
          <SidebarItem key={b.name} label={b.name} />
        ))}
      </Section>

      <Section
        title="Tags"
        icon={<Tag size={13} />}
        expanded={expanded.tags}
        onToggle={() => toggle('tags')}
      />

      <Section
        title="Stashes"
        icon={<Archive size={13} />}
        expanded={expanded.stashes}
        onToggle={() => toggle('stashes')}
      />

      <Section
        title="Worktrees"
        icon={<Layers size={13} />}
        expanded={expanded.worktrees}
        onToggle={() => toggle('worktrees')}
        onAdd={() => {}}
      >
        {worktrees?.map(wt => (
          <WorktreeItem key={wt.path} worktree={wt} />
        ))}
      </Section>
    </aside>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  onAdd?: () => void
  children?: React.ReactNode
}

function Section({ title, icon, expanded, onToggle, onAdd, children }: SectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 8px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--text-pri)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ChevronRight
          size={12}
          style={{
            flexShrink: 0,
            color: 'var(--text-ter)',
            transform: expanded ? 'rotate(90deg)' : undefined,
            transition: 'transform 0.15s',
          }}
        />
        {icon}
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {onAdd && (
          <span
            role="button"
            aria-label={`Add ${title}`}
            onClick={(e) => { e.stopPropagation(); onAdd() }}
            style={{ display: 'flex', alignItems: 'center', color: 'var(--text-ter)' }}
          >
            <Plus size={12} />
          </span>
        )}
      </button>

      {expanded && children && (
        <div style={{ paddingLeft: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SidebarItem({ label, isActive }: { label: string; isActive?: boolean }) {
  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 12,
        color: isActive ? 'var(--text-acc)' : 'var(--text-sec)',
        fontWeight: isActive ? 600 : 400,
        cursor: 'pointer',
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={label}
    >
      {label}
    </div>
  )
}

function WorktreeItem({ worktree }: { worktree: WorktreeInfo }) {
  const name = worktree.path.split('/').pop() ?? worktree.path
  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        fontSize: 12,
        color: 'var(--text-sec)',
        cursor: 'pointer',
      }}
      title={worktree.path}
    >
      <Layers size={11} style={{ flexShrink: 0, color: 'var(--text-ter)' }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
        {name}
      </span>
      {worktree.isDirty && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
      )}
    </div>
  )
}
