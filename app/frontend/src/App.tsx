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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Events } from '@wailsio/runtime'
import { SaveWindowSize, GetRecentRepos } from '@bindings/gitmorrow/app'
import { useGitStore } from '@/stores/gitStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useResizableWidth } from '@/hooks/useResizableWidth'
import Toolbar from '@/components/Toolbar/Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import HistoryView from '@/components/HistoryView/HistoryView'
import ChangesView from '@/components/ChangesView/ChangesView'
import FlashNotification from '@/components/shared/FlashNotification'
import ProgressBar from '@/components/shared/ProgressBar'
import CommandPalette from '@/components/shared/CommandPalette'
import { AboutDialog } from '@/components/About/AboutDialog'
import { KeyboardShortcutsDialog } from '@/components/Help/KeyboardShortcutsDialog'

/** Persisted width of the sidebar (branches, remotes, tags, …). */
const SIDEBAR_WIDTH_KEY = 'sidebar-width'
const MIN_SIDEBAR_WIDTH = 160
const MAX_SIDEBAR_WIDTH = 420
const DEFAULT_SIDEBAR_WIDTH = 200
/** Width step used when the splitter is operated with the keyboard. */
const KEYBOARD_RESIZE_STEP = 16

export default function App() {
  const { t } = useTranslation()
  const {
    activeView, showSidebar, resolvedTheme, syncSystemTheme,
    setAboutDialogOpen, setHelpDialogOpen,
  } = useGitStore()
  const queryClient = useQueryClient()
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The sidebar width is user-adjustable and persists across sessions.
  const {
    width: sidebarWidth,
    startResize: startSidebarResize,
    nudge: nudgeSidebarWidth,
    reset: resetSidebarWidth,
  } = useResizableWidth({
    storageKey: SIDEBAR_WIDTH_KEY,
    min: MIN_SIDEBAR_WIDTH,
    max: MAX_SIDEBAR_WIDTH,
    initial: DEFAULT_SIDEBAR_WIDTH,
  })
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)

  const onSidebarSplitterMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDraggingSidebar(true)
    startSidebarResize(event)
    const onUp = () => {
      setIsDraggingSidebar(false)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mouseup', onUp)
  }, [startSidebarResize])

  const onSidebarSplitterKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudgeSidebarWidth(-KEYBOARD_RESIZE_STEP)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudgeSidebarWidth(KEYBOARD_RESIZE_STEP)
    } else if (event.key === 'Home') {
      event.preventDefault()
      resetSidebarWidth()
    }
  }, [nudgeSidebarWidth, resetSidebarWidth])

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // When the preference is 'system', follow OS light/dark changes live.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => syncSystemTheme()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [syncSystemTheme])

  // Central repo:changed handler — invalidates all data queries
  useEffect(() => {
    const unsubscribe = Events.On('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['commits'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    })
    return unsubscribe
  }, [queryClient])

  // Native menu entries are handled in the frontend: macOS puts "About GitMorrow"
  // in the application menu, Windows/Linux in the Help menu.
  useEffect(() => {
    const offAbout = Events.On('app:about', () => setAboutDialogOpen(true))
    const offShortcuts = Events.On('app:keyboard-shortcuts', () => setHelpDialogOpen(true))
    return () => {
      offAbout()
      offShortcuts()
    }
  }, [setAboutDialogOpen, setHelpDialogOpen])

  // Seed recent repos from the Go backend once on mount.
  useEffect(() => {
    GetRecentRepos().then(repos => {
      if (repos?.length) useGitStore.getState().setRecentRepos(repos)
    }).catch(() => { /* non-critical */ })
  }, [])

  // Persist window size across sessions.
  // Debounced so we don't hammer the Go backend during a live resize.
  useEffect(() => {
    const onResize = () => {
      if (resizeTimer.current) clearTimeout(resizeTimer.current)
      resizeTimer.current = setTimeout(() => {
        SaveWindowSize(window.innerWidth, window.innerHeight)
      }, 500)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (resizeTimer.current) clearTimeout(resizeTimer.current)
    }
  }, [])

  // Global keyboard shortcuts (⌘K, ⌘1, ⌘2)
  useKeyboard()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden"
         style={{ background: 'var(--bg-window)' }}>
      <Toolbar />

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && activeView === 'history' && (
          <>
            <Sidebar width={sidebarWidth} />
            {/* Splitter handle for the sidebar */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('sidebar.resizeWidth', { defaultValue: 'Resize sidebar' })}
              aria-valuenow={sidebarWidth}
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
              tabIndex={0}
              onMouseDown={onSidebarSplitterMouseDown}
              onKeyDown={onSidebarSplitterKeyDown}
              onDoubleClick={resetSidebarWidth}
              style={{
                width: 4, flexShrink: 0, cursor: 'col-resize',
                background: isDraggingSidebar ? 'var(--acc)' : 'var(--border-sub)',
                transition: isDraggingSidebar ? 'none' : 'background 0.15s',
                outline: 'none',
              }}
              onMouseEnter={e => { if (!isDraggingSidebar) (e.currentTarget as HTMLDivElement).style.background = 'var(--acc)' }}
              onMouseLeave={e => { if (!isDraggingSidebar) (e.currentTarget as HTMLDivElement).style.background = 'var(--border-sub)' }}
            />
          </>
        )}
        <main className="flex flex-1 overflow-hidden">
          {activeView === 'history' && <HistoryView />}
          {activeView === 'changes' && <ChangesView />}
        </main>
      </div>

      <CommandPalette />
      <ProgressBar />
      <FlashNotification />
      <AboutDialog />
    </div>
  )
}
