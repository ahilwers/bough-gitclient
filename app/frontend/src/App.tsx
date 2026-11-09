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

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Events } from '@wailsio/runtime'
import { SaveWindowSize, GetRecentRepos } from '@bindings/gitmorrow/app'
import { useGitStore } from '@/stores/gitStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import Toolbar from '@/components/Toolbar/Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import HistoryView from '@/components/HistoryView/HistoryView'
import ChangesView from '@/components/ChangesView/ChangesView'
import FlashNotification from '@/components/shared/FlashNotification'
import ProgressBar from '@/components/shared/ProgressBar'
import CommandPalette from '@/components/shared/CommandPalette'
import { AboutDialog } from '@/components/About/AboutDialog'
import { KeyboardShortcutsDialog } from '@/components/Help/KeyboardShortcutsDialog'

export default function App() {
  const {
    activeView, showSidebar, resolvedTheme, syncSystemTheme,
    setAboutDialogOpen, setHelpDialogOpen,
  } = useGitStore()
  const queryClient = useQueryClient()
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        {showSidebar && activeView === 'history' && <Sidebar />}
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
