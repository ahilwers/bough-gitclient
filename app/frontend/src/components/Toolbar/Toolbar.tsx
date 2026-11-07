import { useState, useEffect } from 'react'
import { RefreshCw, ArrowDown, ArrowUp, GitBranch, Layers, Tag, Search, ChevronDown, History, GitCompare, Sun, Moon, FolderOpen, FolderPlus, Globe, HelpCircle, Loader2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useGitStore } from '@/stores/gitStore'
import { useStatus } from '@/hooks/useStatus'
import { SelectRepository, OpenRepository, Fetch, Pull, Push, SelectAndInitRepository } from '@wailsjs/go/main/App'
import { parseGitError } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { ManageRemotesDialog } from '@/components/RemoteManager/ManageRemotesDialog'
import { KeyboardShortcutsDialog } from '@/components/Help/KeyboardShortcutsDialog'

export default function Toolbar() {
  const { activeView, setActiveView, activeRepo, recentRepos, setActiveRepo, showFlash, theme, toggleTheme, setHelpDialogOpen, setLoadingOperation } = useGitStore()
  const queryClient = useQueryClient()
  const { data: status } = useStatus()
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [pullLoading, setPullLoading] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Global '?' shortcut to open help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setHelpDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setHelpDialogOpen])

  const changesCount = (status?.files?.length ?? 0)
  const repoName = activeRepo ? activeRepo.split('/').pop() : 'No Repository'

  const handleOpenRepo = async (path: string) => {
    try {
      const resolved = await OpenRepository(path)
      if (resolved) {
        setActiveRepo(resolved)
        queryClient.invalidateQueries()
      }
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
    }
  }

  const handleSelectRepo = async () => {
    try {
      const path = await SelectRepository()
      if (path) {
        setActiveRepo(path)
        queryClient.invalidateQueries()
      }
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
    }
  }

  const handleNewRepo = async () => {
    try {
      const path = await SelectAndInitRepository()
      if (path) {
        setActiveRepo(path)
        queryClient.invalidateQueries()
        showFlash('Repository created', 'success')
      }
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
    }
  }

  const handleFetch = async () => {
    setFetchLoading(true)
    setLoadingOperation('Fetching…')
    try {
      await Fetch('')
      showFlash('Fetched successfully')
      queryClient.invalidateQueries()
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
    } finally {
      setFetchLoading(false)
      setLoadingOperation(null)
    }
  }

  const handlePull = async () => {
    setPullLoading(true)
    setLoadingOperation('Pulling…')
    try {
      await Pull('', '')
      showFlash('Pulled successfully')
      queryClient.invalidateQueries()
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
    } finally {
      setPullLoading(false)
      setLoadingOperation(null)
    }
  }

  const handlePush = async () => {
    setPushLoading(true)
    setLoadingOperation('Pushing…')
    try {
      await Push('', '', false)
      showFlash('Pushed successfully')
      queryClient.invalidateQueries()
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
    } finally {
      setPushLoading(false)
      setLoadingOperation(null)
    }
  }

  return (
    <div
      style={{
        height: 44,
        background: 'var(--bg-toolbar)',
        borderBottom: '1px solid var(--border-sub)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px',
      }}
    >
      {/* Repo selector dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="toolbar-btn" style={{ maxWidth: 200, gap: 4, paddingLeft: 10, paddingRight: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {repoName}
            </span>
            <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-ter)' }} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '4px 0',
              minWidth: 260,
              zIndex: 1000,
            }}
            sideOffset={4}
          >
            <DropdownMenu.Item
              onSelect={handleNewRepo}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-pri)',
                outline: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-content)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <FolderPlus size={13} style={{ flexShrink: 0, color: 'var(--text-ter)' }} />
              New Repository…
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={handleSelectRepo}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-pri)',
                outline: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-content)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <FolderOpen size={13} style={{ flexShrink: 0, color: 'var(--text-ter)' }} />
              Open Repository…
            </DropdownMenu.Item>

            {activeRepo && (
              <>
                <DropdownMenu.Separator style={{ height: 1, background: 'var(--border-sub)', margin: '4px 0' }} />
                <DropdownMenu.Item
                  onSelect={() => setRemoteDialogOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-pri)',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-content)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Globe size={13} style={{ flexShrink: 0, color: 'var(--text-ter)' }} />
                  Manage Remotes…
                </DropdownMenu.Item>
              </>
            )}

            {recentRepos.length > 0 && (
              <>
                <DropdownMenu.Separator style={{ height: 1, background: 'var(--border-sub)', margin: '4px 0' }} />
                <div style={{ padding: '2px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent
                </div>
                {recentRepos.map(repo => (
                  <RecentRepoItem
                    key={repo}
                    path={repo}
                    isActive={repo === activeRepo}
                    onSelect={() => handleOpenRepo(repo)}
                  />
                ))}
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 4px' }} />

      {/* View tabs */}
      <TabButton
        icon={<History size={13} />}
        label="History"
        active={activeView === 'history'}
        onClick={() => setActiveView('history')}
      />
      <TabButton
        icon={<GitCompare size={13} />}
        label="Changes"
        active={activeView === 'changes'}
        badge={changesCount}
        onClick={() => setActiveView('changes')}
      />

      {/* Spacer / loading label */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {(fetchLoading || pullLoading || pushLoading) && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-ter)',
          }}>
            <Loader2 size={12} className="spin" style={{ color: 'var(--acc)' }} />
            {fetchLoading ? 'Fetching…' : pullLoading ? 'Pulling…' : 'Pushing…'}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 4px' }} />
        <IconButton icon={fetchLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} label="Fetch" onClick={handleFetch} disabled={fetchLoading || pullLoading || pushLoading} />
        <IconButton icon={pullLoading ? <Loader2 size={14} className="spin" /> : <ArrowDown size={14} />} label="Pull" onClick={handlePull} disabled={fetchLoading || pullLoading || pushLoading} />
        <IconButton icon={pushLoading ? <Loader2 size={14} className="spin" /> : <ArrowUp size={14} />} label="Push" onClick={handlePush} disabled={fetchLoading || pullLoading || pushLoading} />
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 2px' }} />
        <IconButton icon={<GitBranch size={14} />} label="Branch" />
        <IconButton icon={<Layers size={14} />} label="Stash" />
        <IconButton icon={<Tag size={14} />} label="Tag" />
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 2px' }} />
        <IconButton
          icon={<Search size={14} />}
          label="Command Palette (⌘K)"
          onClick={() => window.dispatchEvent(new CustomEvent('palette:open'))}
        />
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 2px' }} />
        <IconButton
          icon={theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        />
        <IconButton
          icon={<HelpCircle size={14} />}
          label="Keyboard shortcuts (?)"
          onClick={() => setHelpDialogOpen(true)}
        />
      </div>

      {remoteDialogOpen && <ManageRemotesDialog onClose={() => setRemoteDialogOpen(false)} />}
      <KeyboardShortcutsDialog />
    </div>
  )
}

// RecentRepoItem shows the repo name prominently and the parent path dimly.
function RecentRepoItem({ path, isActive, onSelect }: { path: string; isActive: boolean; onSelect: () => void }) {
  const parts = path.split('/')
  const name = parts.pop() ?? path
  // Collapse the home directory prefix for readability
  const parent = parts.join('/').replace(/^\/Users\/[^/]+/, '~') || '/'

  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      title={path}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '5px 12px', cursor: 'pointer', outline: 'none',
        background: isActive ? 'color-mix(in srgb, var(--acc) 10%, transparent)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-content)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--acc)' : 'var(--text-pri)' }}>
        {name}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-ter)', marginTop: 1 }}>
        {parent}
      </span>
    </DropdownMenu.Item>
  )
}

interface TabButtonProps {
  icon: React.ReactNode
  label: string
  active: boolean
  badge?: number
  onClick: () => void
}

function TabButton({ icon, label, active, badge, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 28,
        padding: '0 10px',
        borderRadius: 'var(--r-sm)',
        border: 'none',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        position: 'relative',
        background: active ? 'var(--acc)' : 'transparent',
        color: active ? '#fff' : 'var(--text-pri)',
      }}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: -2,
            minWidth: 16,
            height: 16,
            background: 'var(--danger)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translateY(-4px)',
            padding: '0 3px',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

interface IconButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}

function IconButton({ icon, label, onClick, disabled }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 'var(--r-sm)',
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--text-ter)' : 'var(--text-pri)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
    </button>
  )
}
