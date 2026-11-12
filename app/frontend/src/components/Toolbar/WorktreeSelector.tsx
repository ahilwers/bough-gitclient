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

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWorktrees } from '@/hooks/useWorktrees'
import { parseGitError } from '@/lib/format'
import { useGitStore } from '@/stores/gitStore'
import { Button } from '../shared/Button'

/** Shows the active worktree and lets the user switch to another one.
 *  Lives in the toolbar so the active worktree is visible in every view and
 *  can be changed from the Changes view as well as from History. */
export function WorktreeSelector() {
  const { t } = useTranslation()
  const { activeRepo, activeWorktree, showFlash } = useGitStore()
  const { data: worktrees, isLoading, isError, switchMutation } = useWorktrees()
  // The main worktree is the repository itself; a linked worktree is tracked
  // separately once the user switches to it.
  const current = activeRepo ? (activeWorktree ?? activeRepo) : null
  if (!current) return null

  const name = current.split(/[\\/]/).filter(Boolean).pop() ?? current
  const description = t('toolbar.currentWorktree', { path: current })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" aria-label={description} title={description} disabled={switchMutation.isPending}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, maxWidth: 180, height: 28, fontSize: 12, color: 'var(--text-sec)' }}>
          <FolderTree size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <ChevronDown size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={4} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: '4px 0', minWidth: 260, maxHeight: 320, overflowY: 'auto', zIndex: 1000 }}>
          {isLoading && <div style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text-sec)' }}>{t('worktrees.loading')}</div>}
          {isError && <div style={{ padding: '7px 12px', fontSize: 12, color: 'var(--danger)' }}>{t('worktrees.loadError')}</div>}
          {!isLoading && !isError && !worktrees?.length && <div style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text-sec)' }}>{t('worktrees.empty')}</div>}
          <DropdownMenu.RadioGroup value={current} onValueChange={path => {
            switchMutation.mutate(path, { onError: (err: Error) => showFlash(parseGitError(err), 'danger') })
          }}>
            {worktrees?.map(wt => (
              <DropdownMenu.RadioItem key={wt.path} value={wt.path} aria-label={wt.path} aria-description={wt.isDirty ? t('worktrees.hasUncommittedChanges') : undefined} title={wt.path}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-pri)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-content)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <span style={{ width: 13, flexShrink: 0 }}><DropdownMenu.ItemIndicator><Check size={13} /></DropdownMenu.ItemIndicator></span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span>{wt.path.split(/[\\/]/).filter(Boolean).pop() ?? wt.path}{wt.isDirty && <span aria-hidden="true" title={t('worktrees.hasUncommittedChanges')} style={{ display: 'inline-block', width: 6, height: 6, marginLeft: 6, borderRadius: '50%', background: 'var(--warn)' }} />}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-ter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wt.path}</span>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
