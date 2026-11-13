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

import { Button } from '../shared/Button'
import { ThemeMenu } from '../shared/ThemeMenu'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ArrowDown, ArrowUp, GitBranch, Layers, Tag, Search, ChevronDown, History, GitCompare, FolderOpen, FolderPlus, Globe, HelpCircle, Loader2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useGitStore } from '@/stores/gitStore'
import { useStatus } from '@/hooks/useStatus'
import { SelectRepository, OpenRepository, Fetch, PullForUI, ResolvePull, Push, GetPushInfo, PushWithUpstream, SelectAndInitRepository } from '@bindings/gitmorrow/app'
import { CreateUpstreamDialog } from './CreateUpstreamDialog'
import { parseGitError } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { ManageRemotesDialog } from '@/components/RemoteManager/ManageRemotesDialog'
import { KeyboardShortcutsDialog } from '@/components/Help/KeyboardShortcutsDialog'
import { NewBranchDialog } from '@/components/BranchManager/NewBranchDialog'
import { CreateStashDialog } from '@/components/StashView/CreateStashDialog'
import { CreateTagDialog } from '@/components/TagManager/CreateTagDialog'

import { PullStrategyDialog } from './PullStrategyDialog'
import type { PullSnapshot, PushInfo } from '@bindings/gitmorrow/git'

export default function Toolbar() {
  const { t } = useTranslation()
  const { activeView, setActiveView, activeRepo, activeWorktree, recentRepos, setActiveRepo, showFlash, setHelpDialogOpen, setLoadingOperation } = useGitStore()
  const queryClient = useQueryClient()
  const { data: status } = useStatus()
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [pullLoading, setPullLoading] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [upstreamInfo, setUpstreamInfo] = useState<PushInfo | null>(null)
  const [createDialog, setCreateDialog] = useState<{ kind: 'branch' | 'stash' | 'tag'; repo: string; worktree: string | null } | null>(null)

  const openCreateDialog = (kind: 'branch' | 'stash' | 'tag') => {
    if (activeRepo) setCreateDialog({ kind, repo: activeRepo, worktree: activeWorktree })
  }
  // Close a dialog when its repository or worktree is no longer active.
  const currentDialog = createDialog?.repo === activeRepo && createDialog?.worktree === activeWorktree ? createDialog : null
  useEffect(() => { setCreateDialog(null) }, [activeRepo, activeWorktree])

  useEffect(() => {
    const onCreate = (event: Event) => {
      const kind = (event as CustomEvent<string>).detail
      if (activeRepo && (kind === 'branch' || kind === 'stash' || kind === 'tag')) {
        setCreateDialog({ kind, repo: activeRepo, worktree: activeWorktree })
      }
    }
    window.addEventListener('git:create', onCreate)
    return () => window.removeEventListener('git:create', onCreate)
  }, [activeRepo, activeWorktree])

  useEffect(() => { setUpstreamInfo(null) }, [activeRepo])

  const [pullChoice, setPullChoice] = useState<PullSnapshot | null>(null)
  const pullGeneration = useRef(0)
  const pullBusy = useRef(false)
  const pullRebasing = useRef(false)
  const currentContext = useRef({ repo: activeRepo, branch: status?.branch })
  currentContext.current = { repo: activeRepo, branch: status?.branch }
  useEffect(() => {
    // A rebase temporarily detaches HEAD; that is not a user branch switch.
    if (!(pullRebasing.current && status?.branch === 'HEAD')) pullGeneration.current++
    setPullChoice(null)
  }, [activeRepo, status?.branch])
  useEffect(() => () => { pullGeneration.current++ }, [])

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
  const branch = activeRepo ? status?.branch : undefined
  const branchLabel = branch === 'HEAD' ? t('toolbar.detachedHead') : branch
  const branchDescription = branch === 'HEAD' ? branchLabel : t('toolbar.currentBranch', { branch })
  const pushCount = branch && branch !== 'HEAD' && status && Number.isFinite(status.ahead) ? Math.max(0, status.ahead) : 0
  const pushDescription = pushCount > 0 ? t('toolbar.pushPending', { count: pushCount }) : undefined

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

  const handlePull = async (strategy?: 'merge' | 'rebase') => {
    if (pullBusy.current || !activeRepo || !status?.branch) return
    const context = { repo: activeRepo, branch: status.branch }
    const generation = pullGeneration.current
    const snapshot = pullChoice
    const isCurrent = () => generation === pullGeneration.current && currentContext.current.repo === context.repo && (currentContext.current.branch === context.branch || (pullRebasing.current && currentContext.current.branch === 'HEAD'))
    pullBusy.current = true
    // A configured ordinary pull may rebase as well.
    pullRebasing.current = strategy !== 'merge'
    setPullChoice(null)
    setPullLoading(true)
    setLoadingOperation(t('pull.loading'))
    try {
      const result = strategy && snapshot ? await ResolvePull(snapshot, strategy) : await PullForUI(context.repo, context.branch)
      if (!isCurrent()) return
      if (result.outcome === 'choice' && result.snapshot) {
        setPullChoice(result.snapshot)
      } else if (result.outcome === 'conflict') {
        setActiveView('changes')
        showFlash(t('pull.conflict') + (result.detail ? `\n${result.detail}` : ''), 'danger')
      } else if (result.outcome === 'success') {
        showFlash(t('pull.success'))
      }
    } catch (err) {
      if (isCurrent()) showFlash(parseGitError(err), 'danger')
    } finally {
      // Failed integrations also change status, refs and operation state.
      if (isCurrent()) queryClient.invalidateQueries()
      pullBusy.current = false
      pullRebasing.current = false
      setPullLoading(false)
      setLoadingOperation(null)
    }
  }

  const handlePush = async () => {
    setPushLoading(true)
    setLoadingOperation('Pushing…')
    try {
      const info = await GetPushInfo()
      if (useGitStore.getState().activeRepo !== activeRepo) return
      if (!info.upstream) {
        setUpstreamInfo(info)
        return
      }
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

  const handleCreateUpstream = async (remote: string) => {
    const info = upstreamInfo
    setUpstreamInfo(null)
    if (!info || useGitStore.getState().activeRepo !== activeRepo) return
    setPushLoading(true)
    setLoadingOperation('Pushing…')
    try {
      await PushWithUpstream(info.repoPath, remote, info.branch)
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
      className="app-toolbar"
      style={{
        height: 44,
        background: 'var(--bg-toolbar)',
        borderBottom: '1px solid var(--border-sub)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 var(--toolbar-pad-right, 8px) 0 var(--toolbar-pad-left, 8px)',
      }}
    >
      {/* Repo selector dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" title={activeRepo ?? repoName} style={{ display: 'inline-flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', flex: '0 1 auto', minWidth: 44, height: 28, borderRadius: 'var(--r-sm)', maxWidth: 200, gap: 4, paddingLeft: 10, paddingRight: 8, whiteSpace: 'nowrap' }}>
            <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {repoName}
            </span>
            <ChevronDown size={12} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-ter)' }} />
          </Button>
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

      {/* Current branch stays visible in every view, including during Git operations. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {branch && (
          <div
            role="status"
            aria-label={branchDescription}
            title={branchDescription}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              minWidth: 0, maxWidth: 240, fontSize: 12,
              color: branch === 'HEAD' ? 'var(--warn)' : 'var(--text-sec)',
            }}
          >
            <GitBranch size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {branchLabel}
            </span>
          </div>
        )}
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
        <IconButton icon={pullLoading ? <Loader2 size={14} className="spin" /> : <ArrowDown size={14} />} label="Pull" onClick={() => handlePull()} disabled={fetchLoading || pullLoading || pushLoading} />
        <IconButton icon={pushLoading ? <Loader2 size={14} className="spin" /> : <ArrowUp size={14} />} label="Push" description={pushDescription} badge={pushCount} onClick={handlePush} disabled={fetchLoading || pullLoading || pushLoading} />
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 2px' }} />
        <IconButton icon={<GitBranch size={14} />} label="Branch" onClick={() => openCreateDialog('branch')} disabled={!activeRepo} />
        <IconButton icon={<Layers size={14} />} label="Stash" onClick={() => openCreateDialog('stash')} disabled={!activeRepo} />
        <IconButton icon={<Tag size={14} />} label="Tag" onClick={() => openCreateDialog('tag')} disabled={!activeRepo} />
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 2px' }} />
        <IconButton
          icon={<Search size={14} />}
          label="Command Palette (⌘K)"
          onClick={() => window.dispatchEvent(new CustomEvent('palette:open'))}
        />
        <div style={{ width: 1, height: 20, background: 'var(--border-sub)', margin: '0 2px' }} />
        <ThemeMenu />
        <IconButton
          icon={<HelpCircle size={14} />}
          label="Keyboard shortcuts (?)"
          onClick={() => setHelpDialogOpen(true)}
        />
      </div>

      {currentDialog?.kind === 'branch' && <NewBranchDialog onClose={() => setCreateDialog(null)} />}
      {currentDialog?.kind === 'stash' && <CreateStashDialog onClose={() => setCreateDialog(null)} />}
      {currentDialog?.kind === 'tag' && <CreateTagDialog onClose={() => setCreateDialog(null)} />}
      {upstreamInfo && <CreateUpstreamDialog info={upstreamInfo} onConfirm={handleCreateUpstream} onClose={() => setUpstreamInfo(null)} />}
      {remoteDialogOpen && <ManageRemotesDialog onClose={() => setRemoteDialogOpen(false)} />}
      {pullChoice && pullChoice.repo === activeRepo && pullChoice.branch === branch && <PullStrategyDialog branch={pullChoice.branch} onClose={() => setPullChoice(null)} onChoose={strategy => handlePull(strategy)} />}
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
    <Button variant="ghost"
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
    </Button>
  )
}

interface IconButtonProps {
  icon: React.ReactNode
  label: string
  description?: string
  badge?: number
  onClick?: () => void
  disabled?: boolean
}

function IconButton({ icon, label, description, badge, onClick, disabled }: IconButtonProps) {
  return (
    <Button variant="icon"
      onClick={onClick}
      title={description ?? label}
      aria-label={label}
      aria-description={description}
      disabled={disabled}
      style={{ width: 30, height: 30, position: 'relative' }}
    >
      {icon}
      {badge !== undefined && badge > 0 && <span className="toolbar-icon-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
    </Button>
  )
}
