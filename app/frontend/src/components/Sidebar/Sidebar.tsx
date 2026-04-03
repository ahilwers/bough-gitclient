import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, GitBranch, Globe, Tag as TagIcon, Archive, Layers } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useWorktrees } from '@/hooks/useWorktrees'
import { useTags } from '@/hooks/useTags'
import { useStashes } from '@/hooks/useStashes'
import { useGitStore } from '@/stores/gitStore'
import { ContextMenu } from '@/components/shared/ContextMenu'
import { NewWorktreeDialog } from '@/components/WorktreeManager/NewWorktreeDialog'
import { NewBranchDialog } from '@/components/BranchManager/NewBranchDialog'
import { MergeConfirmDialog } from '@/components/BranchManager/MergeConfirmDialog'
import { StashDiffView } from '@/components/StashView/StashDiffView'
import { OpenInFinder } from '@wailsjs/go/main/App'
import { useStatus } from '@/hooks/useStatus'
import { parseGitError } from '@/lib/format'
import type { WorktreeInfo, Branch, Tag, StashEntry } from '@/lib/types'

type PendingConfirm =
  | { kind: 'checkout'; branch: string }
  | { kind: 'removeWorktree'; worktree: WorktreeInfo }
  | { kind: 'checkoutRemote'; remoteBranch: string; localBranch: string }
  | { kind: 'pullIntoLocal'; remote: string; localBranch: string }
  | { kind: 'pullIntoCurrent'; remote: string; branch: string; currentBranch: string }
  | { kind: 'checkoutTag'; tag: string }
  | { kind: 'deleteTag'; tag: string }
  | { kind: 'dropStash'; entry: StashEntry }

export default function Sidebar() {
  const [expanded, setExpanded] = useState({
    branches: true,
    remotes: true,
    tags: false,
    stashes: false,
    worktrees: true,
  })
  const [showNewWorktreeDialog, setShowNewWorktreeDialog] = useState(false)
  const [showNewBranchDialog, setShowNewBranchDialog] = useState(false)
  const [mergingBranch, setMergingBranch] = useState<string | null>(null)
  const [dragOverHead, setDragOverHead] = useState(false)
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [openStash, setOpenStash] = useState<StashEntry | null>(null)

  const { data: branches, checkoutMutation, checkoutRemoteMutation, pullIntoLocalMutation, pullIntoCurrentMutation } = useBranches()
  const { data: worktrees, removeMutation, switchMutation } = useWorktrees()
  const { data: tags, checkoutMutation: tagCheckoutMutation, deleteMutation: tagDeleteMutation } = useTags()
  const { data: stashes, dropMutation } = useStashes()
  const { activeWorktree, showFlash } = useGitStore()
  const { data: status } = useStatus()

  const toggle = (key: keyof typeof expanded) =>
    setExpanded(s => ({ ...s, [key]: !s[key] }))

  const currentBranch = branches?.local?.find(b => b.isHead)?.name ?? ''

  const localNameFor = (b: Branch) => b.name.slice(b.remote.length + 1)

  const handleRemoteBranchClick = (b: Branch) => {
    const localName = localNameFor(b)
    const local = branches?.local?.find(l => l.name === localName)

    if (!local) {
      setPending({ kind: 'checkoutRemote', remoteBranch: b.name, localBranch: localName })
    } else if (local.behind > 0) {
      setPending({ kind: 'pullIntoLocal', remote: b.remote, localBranch: localName })
    } else if (!local.isHead) {
      setPending({ kind: 'checkout', branch: localName })
    } else {
      showFlash(`Already on '${localName}' and up to date`, 'info')
    }
  }

  const handleSwitchWorktree = (wt: WorktreeInfo) => {
    switchMutation.mutate(wt.path, {
      onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
    })
  }

  const handleConfirm = () => {
    if (!pending) return
    switch (pending.kind) {
      case 'checkout':
        checkoutMutation.mutate(pending.branch, {
          onSuccess: () => showFlash(`Switched to '${pending.branch}'`, 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'removeWorktree':
        removeMutation.mutate(pending.worktree.path, {
          onSuccess: () => showFlash('Worktree removed', 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'checkoutRemote':
        checkoutRemoteMutation.mutate(pending.remoteBranch, {
          onSuccess: () => showFlash(`Checked out '${pending.localBranch}'`, 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'pullIntoLocal':
        pullIntoLocalMutation.mutate({ remote: pending.remote, localBranch: pending.localBranch }, {
          onSuccess: () => showFlash(`Pulled into '${pending.localBranch}'`, 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'pullIntoCurrent':
        pullIntoCurrentMutation.mutate({ remote: pending.remote, branch: pending.branch }, {
          onSuccess: () => showFlash(`Pulled ${pending.remote}/${pending.branch} into '${pending.currentBranch}'`, 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'checkoutTag':
        tagCheckoutMutation.mutate(pending.tag, {
          onSuccess: () => showFlash(`Detached HEAD at '${pending.tag}'`, 'info'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'deleteTag':
        tagDeleteMutation.mutate(pending.tag, {
          onSuccess: () => showFlash(`Deleted tag '${pending.tag}'`, 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
      case 'dropStash':
        dropMutation.mutate(pending.entry.index, {
          onSuccess: () => showFlash('Stash dropped', 'success'),
          onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
        })
        break
    }
    setPending(null)
  }

  const confirmTitle = (() => {
    if (!pending) return ''
    switch (pending.kind) {
      case 'checkout':        return `Switch to '${pending.branch}'?`
      case 'removeWorktree':  return 'Remove worktree?'
      case 'checkoutRemote':  return `Checkout '${pending.localBranch}' locally?`
      case 'pullIntoLocal':   return `Pull ${pending.remote}/${pending.localBranch} into '${pending.localBranch}'?`
      case 'pullIntoCurrent': return `Pull ${pending.remote}/${pending.branch} into '${pending.currentBranch}'?`
      case 'checkoutTag':     return `Checkout tag '${pending.tag}'?`
      case 'deleteTag':       return `Delete tag '${pending.tag}'?`
      case 'dropStash':       return 'Drop stash?'
    }
  })()

  const confirmBody = (() => {
    if (!pending) return undefined
    switch (pending.kind) {
      case 'removeWorktree':
        return `This will delete the directory and its git link at "${pending.worktree.path}".`
      case 'checkoutRemote':
        return `Creates a local tracking branch '${pending.localBranch}' from ${pending.remoteBranch}.`
      case 'pullIntoLocal':
        return pending.localBranch !== currentBranch
          ? `This will switch to '${pending.localBranch}' and pull the latest changes.`
          : undefined
      case 'checkoutTag':
        return 'This will detach HEAD at the tagged commit.'
      case 'deleteTag':
        return 'This only removes the local tag. Push a delete to share the change.'
      case 'dropStash':
        return `'${pending.entry.message}' will be permanently deleted.`
      default:
        return undefined
    }
  })()

  const confirmLabel = (() => {
    if (!pending) return 'OK'
    switch (pending.kind) {
      case 'removeWorktree': return 'Remove'
      case 'checkout':       return 'Switch'
      case 'checkoutRemote': return 'Checkout'
      case 'checkoutTag':    return 'Checkout'
      case 'deleteTag':      return 'Delete'
      case 'dropStash':      return 'Drop'
      default:               return 'Pull'
    }
  })()

  const confirmDanger = pending?.kind === 'removeWorktree'
    || pending?.kind === 'deleteTag'
    || pending?.kind === 'dropStash'

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
          onAdd={() => setShowNewBranchDialog(true)}
        >
          {status?.mergeState && (
            <div style={{
              margin: '4px 8px 2px',
              padding: '3px 8px',
              borderRadius: 4,
              background: status.mergeState.conflictCount > 0
                ? 'color-mix(in srgb, var(--danger) 15%, transparent)'
                : 'color-mix(in srgb, var(--warn) 15%, transparent)',
              border: `1px solid ${status.mergeState.conflictCount > 0 ? 'var(--danger)' : 'var(--warn)'}`,
              fontSize: 10, fontWeight: 700,
              color: status.mergeState.conflictCount > 0 ? 'var(--danger)' : 'var(--warn)',
              letterSpacing: '0.04em',
            }}>
              MERGING {status.mergeState.mergingBranch}
              {status.mergeState.conflictCount > 0 && ` · ${status.mergeState.conflictCount} conflict${status.mergeState.conflictCount > 1 ? 's' : ''}`}
            </div>
          )}
          {branches?.local?.map(b => {
            const contextItems = b.isHead
              ? []
              : [
                  { label: `Merge '${b.name}' into '${currentBranch}'`, onClick: () => setMergingBranch(b.name) },
                  { type: 'separator' as const },
                  { label: `Switch to '${b.name}'`, onClick: () => setPending({ kind: 'checkout', branch: b.name }) },
                ]

            const item = (
              <BranchItem
                key={b.name}
                label={b.name}
                isActive={b.isHead}
                isDragTarget={b.isHead && dragOverHead}
                draggable={!b.isHead}
                onDragStart={!b.isHead ? (e) => {
                  e.dataTransfer.setData('branch', b.name)
                  e.dataTransfer.effectAllowed = 'move'
                  // Custom drag image with "Merge" label
                  const ghost = document.createElement('div')
                  ghost.textContent = `Merge ${b.name}`
                  Object.assign(ghost.style, {
                    position: 'absolute', top: '-999px',
                    background: 'var(--bg-panel)', color: 'var(--text-pri)',
                    padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                    border: '1px solid var(--border)', whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  })
                  document.body.appendChild(ghost)
                  e.dataTransfer.setDragImage(ghost, 0, 10)
                  setTimeout(() => document.body.removeChild(ghost), 0)
                } : undefined}
                onDragOver={b.isHead ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverHead(true) } : undefined}
                onDragLeave={b.isHead ? () => setDragOverHead(false) : undefined}
                onDrop={b.isHead ? (e) => {
                  e.preventDefault()
                  setDragOverHead(false)
                  const from = e.dataTransfer.getData('branch')
                  if (from && from !== b.name) setMergingBranch(from)
                } : undefined}
                onClick={b.isHead ? undefined : () => setPending({ kind: 'checkout', branch: b.name })}
              />
            )

            if (contextItems.length === 0) return item
            return (
              <ContextMenu key={b.name} items={contextItems}>
                <div>{item}</div>
              </ContextMenu>
            )
          })}
        </Section>

        <Section
          title="Remotes"
          icon={<Globe size={13} />}
          expanded={expanded.remotes}
          onToggle={() => toggle('remotes')}
        >
          {branches?.remotes?.map(b => {
            const localName = localNameFor(b)
            const local = branches?.local?.find(l => l.name === localName)
            const items = [
              ...(local
                ? [
                    ...(!local.isHead ? [{ label: `Switch to '${localName}'`, onClick: () => setPending({ kind: 'checkout' as const, branch: localName }) }] : []),
                    ...(local.isHead ? [{ label: `Pull into '${localName}'`, onClick: () => setPending({ kind: 'pullIntoLocal' as const, remote: b.remote, localBranch: localName }) }] : []),
                  ]
                : [
                    { label: `Checkout '${localName}' locally`, onClick: () => setPending({ kind: 'checkoutRemote' as const, remoteBranch: b.name, localBranch: localName }) },
                  ]
              ),
              ...(currentBranch && currentBranch !== localName ? [{ label: `Pull into '${currentBranch}'`, onClick: () => setPending({ kind: 'pullIntoCurrent' as const, remote: b.remote, branch: localName, currentBranch }) }] : []),
            ]
            return (
              <ContextMenu key={b.name} items={items}>
                <div>
                  <SidebarItem
                    label={b.name}
                    onClick={() => handleRemoteBranchClick(b)}
                  />
                </div>
              </ContextMenu>
            )
          })}
        </Section>

        <Section
          title="Tags"
          icon={<TagIcon size={13} />}
          expanded={expanded.tags}
          onToggle={() => toggle('tags')}
        >
          {tags?.map((t: Tag) => (
            <ContextMenu
              key={t.name}
              items={[
                { label: 'Checkout tag', onClick: () => setPending({ kind: 'checkoutTag', tag: t.name }) },
                { type: 'separator' },
                { label: 'Delete tag', destructive: true, onClick: () => setPending({ kind: 'deleteTag', tag: t.name }) },
              ]}
            >
              <div>
                <SidebarItem
                  label={t.name}
                  onClick={() => setPending({ kind: 'checkoutTag', tag: t.name })}
                />
              </div>
            </ContextMenu>
          ))}
        </Section>

        <Section
          title="Stashes"
          icon={<Archive size={13} />}
          expanded={expanded.stashes}
          onToggle={() => toggle('stashes')}
        >
          {stashes && stashes.length === 0 && (
            <div style={{ height: 24, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: 'var(--text-ter)' }}>
              No stashes
            </div>
          )}
          {stashes?.map((s: StashEntry) => (
            <ContextMenu
              key={s.index}
              items={[
                { label: 'View diff', onClick: () => setOpenStash(s) },
                { type: 'separator' },
                { label: 'Drop stash', destructive: true, onClick: () => setPending({ kind: 'dropStash', entry: s }) },
              ]}
            >
              <div>
                <SidebarItem
                  label={s.message}
                  onClick={() => setOpenStash(s)}
                />
              </div>
            </ContextMenu>
          ))}
        </Section>

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

      {showNewBranchDialog && (
        <NewBranchDialog onClose={() => setShowNewBranchDialog(false)} />
      )}

      {mergingBranch && currentBranch && (
        <MergeConfirmDialog
          fromBranch={mergingBranch}
          intoBranch={currentBranch}
          onClose={() => setMergingBranch(null)}
        />
      )}

      {showNewWorktreeDialog && (
        <NewWorktreeDialog onClose={() => setShowNewWorktreeDialog(false)} />
      )}

      {openStash && (
        <StashDiffView entry={openStash} onClose={() => setOpenStash(null)} />
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

interface BranchItemProps {
  label: string
  isActive?: boolean
  isDragTarget?: boolean
  draggable?: boolean
  onClick?: () => void
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
}

function BranchItem({ label, isActive, isDragTarget, draggable, onClick, onDragStart, onDragOver, onDragLeave, onDrop }: BranchItemProps) {
  return (
    <div
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 8px',
        fontSize: 12,
        color: isActive ? 'var(--text-acc)' : 'var(--text-sec)',
        fontWeight: isActive ? 600 : 400,
        cursor: onClick ? 'pointer' : draggable ? 'grab' : 'default',
        borderRadius: 'var(--r-sm)',
        background: isDragTarget ? 'color-mix(in srgb, var(--acc) 15%, transparent)' : 'transparent',
        outline: isDragTarget ? '1px dashed var(--acc)' : 'none',
        transition: 'background 0.1s, outline 0.1s',
      }}
      title={label}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: isActive ? 'var(--acc)' : 'transparent',
      }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {label}
      </span>
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
