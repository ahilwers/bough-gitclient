import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, GitBranch, Globe, Tag, Archive, Layers } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useWorktrees } from '@/hooks/useWorktrees'
import { useGitStore } from '@/stores/gitStore'
import { ContextMenu } from '@/components/shared/ContextMenu'
import { NewWorktreeDialog } from '@/components/WorktreeManager/NewWorktreeDialog'
import { OpenInFinder } from '@wailsjs/go/main/App'
import { parseGitError } from '@/lib/format'
import type { WorktreeInfo } from '@/lib/types'

type PendingConfirm =
  | { kind: 'checkout'; branch: string }
  | { kind: 'removeWorktree'; worktree: WorktreeInfo }

export default function Sidebar() {
  const [expanded, setExpanded] = useState({
    branches: true,
    remotes: true,
    tags: false,
    stashes: false,
    worktrees: true,
  })
  const [showNewWorktreeDialog, setShowNewWorktreeDialog] = useState(false)
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const { data: branches, checkoutMutation } = useBranches()
  const { data: worktrees, removeMutation, switchMutation } = useWorktrees()
  const { activeWorktree, showFlash } = useGitStore()

  const toggle = (key: keyof typeof expanded) =>
    setExpanded(s => ({ ...s, [key]: !s[key] }))

  const handleSwitchWorktree = (wt: WorktreeInfo) => {
    switchMutation.mutate(wt.path, {
      onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
    })
  }

  const handleConfirm = () => {
    if (!pending) return
    if (pending.kind === 'checkout') {
      const { branch } = pending
      checkoutMutation.mutate(branch, {
        onSuccess: () => showFlash(`Switched to "${branch}"`, 'success'),
        onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
      })
    } else if (pending.kind === 'removeWorktree') {
      const { worktree } = pending
      removeMutation.mutate(worktree.path, {
        onSuccess: () => showFlash('Worktree removed', 'success'),
        onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
      })
    }
    setPending(null)
  }

  const confirmTitle = pending?.kind === 'checkout'
    ? `Switch to "${pending.branch}"?`
    : pending?.kind === 'removeWorktree'
    ? `Remove worktree?`
    : ''

  const confirmBody = pending?.kind === 'removeWorktree'
    ? `This will delete the directory and its git link at "${pending.worktree.path}".`
    : undefined

  const confirmLabel = pending?.kind === 'removeWorktree' ? 'Remove' : 'Switch'
  const confirmDanger = pending?.kind === 'removeWorktree'

  return (
    <>
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
            <SidebarItem
              key={b.name}
              label={b.name}
              isActive={b.isHead}
              onClick={b.isHead ? undefined : () => setPending({ kind: 'checkout', branch: b.name })}
            />
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
          onAdd={() => setShowNewWorktreeDialog(true)}
        >
          {worktrees && worktrees.length === 0 && (
            <div style={{ height: 24, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: 'var(--text-ter)' }}>
              No worktrees
            </div>
          )}
          {worktrees?.map(wt => (
            <WorktreeItem
              key={wt.path}
              worktree={wt}
              isActive={activeWorktree === wt.path}
              onSwitch={() => handleSwitchWorktree(wt)}
              onRemove={() => setPending({ kind: 'removeWorktree', worktree: wt })}
              onOpenInFinder={() => OpenInFinder(wt.path).catch((err: Error) => showFlash(parseGitError(err), 'danger'))}
            />
          ))}
        </Section>
      </aside>

      {/* Shared inline confirmation dialog */}
      <Dialog.Root open={!!pending} onOpenChange={open => { if (!open) setPending(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 40,
            }}
          />
          <Dialog.Content
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 320,
              background: 'var(--bg-panel)',
              borderRadius: 10,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 50,
              padding: 24,
            }}
          >
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-pri)', marginBottom: confirmBody ? 8 : 24 }}>
              {confirmTitle}
            </Dialog.Title>
            {confirmBody && (
              <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 24 }}>
                {confirmBody}
              </Dialog.Description>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Dialog.Close asChild>
                <button
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-pri)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: confirmDanger ? 'var(--danger)' : 'var(--acc)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {showNewWorktreeDialog && (
        <NewWorktreeDialog onClose={() => setShowNewWorktreeDialog(false)} />
      )}
    </>
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

function SidebarItem({ label, isActive, onClick }: { label: string; isActive?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 8px',
        fontSize: 12,
        color: isActive ? 'var(--text-acc)' : 'var(--text-sec)',
        fontWeight: isActive ? 600 : 400,
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 'var(--r-sm)',
      }}
      title={label}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        flexShrink: 0,
        background: isActive ? 'var(--acc)' : 'transparent',
      }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {label}
      </span>
    </div>
  )
}

interface WorktreeItemProps {
  worktree: WorktreeInfo
  isActive: boolean
  onSwitch: () => void
  onRemove: () => void
  onOpenInFinder: () => void
}

function WorktreeItem({ worktree, isActive, onSwitch, onRemove, onOpenInFinder }: WorktreeItemProps) {
  const name = worktree.path.split('/').pop() ?? worktree.path
  return (
    <ContextMenu
      items={[
        { label: 'Switch to Worktree', onClick: onSwitch },
        { label: 'Open in Finder', onClick: onOpenInFinder },
        { type: 'separator' },
        { label: 'Remove Worktree', destructive: true, onClick: onRemove },
      ]}
    >
      <div
        data-testid="worktree-item"
        onClick={onSwitch}
        style={{
          height: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          fontSize: 12,
          color: isActive ? 'var(--text-acc)' : 'var(--text-sec)',
          fontWeight: isActive ? 600 : 400,
          cursor: 'pointer',
          borderRadius: 'var(--r-sm)',
          background: isActive ? 'color-mix(in srgb, var(--acc) 12%, transparent)' : 'transparent',
        }}
        title={worktree.path}
      >
        <Layers size={11} style={{ flexShrink: 0, color: isActive ? 'var(--acc)' : 'var(--text-ter)' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
          {name}
        </span>
        {worktree.isDirty && (
          <span
            title="Has uncommitted changes"
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }}
          />
        )}
      </div>
    </ContextMenu>
  )
}
