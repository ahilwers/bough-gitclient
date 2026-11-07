// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { WorktreeInfo } from '@/lib/types'

export type View = 'history' | 'changes'
export type Theme = 'light' | 'dark'

interface GitStore {
  // Appearance
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void

  // View & layout
  activeView: View
  setView: (v: View) => void
  setActiveView: (v: View) => void  // alias for setView
  showSidebar: boolean
  setShowSidebar: (show: boolean) => void

  // Repository
  activeRepo: string | null
  recentRepos: string[]
  setActiveRepo: (path: string) => void
  setRecentRepos: (repos: string[]) => void

  // Worktrees
  worktrees: WorktreeInfo[]
  setWorktrees: (wts: WorktreeInfo[]) => void
  activeWorktree: string | null
  setActiveWorktree: (path: string) => void

  // Selection state (History + Changes views)
  selectedCommit: string | null
  selectedFile: string | null
  setSelectedCommit: (hash: string | null) => void
  setSelectedFile: (path: string | null) => void

  // Multi-selection for cherry-pick (commit list)
  selectedCommits: string[]
  setSelectedCommits: (hashes: string[]) => void

  // Drag state: true while commit row(s) are being dragged
  isDraggingCommits: boolean
  setIsDraggingCommits: (v: boolean) => void

  // Pending cherry-pick message pre-fill for CommitBox (no-conflict case)
  pendingCherryPickMessage: string | null
  setPendingCherryPickMessage: (msg: string | null) => void

  // Set when a cherry-pick was halted by conflicts (fallback if CHERRY_PICK_HEAD not detected)
  cherryPickConflictActive: boolean
  setCherryPickConflictActive: (v: boolean) => void

  // Help dialog
  helpDialogOpen: boolean
  setHelpDialogOpen: (open: boolean) => void

  // Long-running operation indicator (null = idle, string = label shown in progress bar)
  loadingOperation: string | null
  setLoadingOperation: (op: string | null) => void

  // Flash notifications
  flash: { message: string; type: 'success' | 'danger' | 'info' } | null
  showFlash: (message: string, type?: 'success' | 'danger' | 'info', durationMs?: number) => void
  clearFlash: () => void
}

function detectTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage may not be available in test environments
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const initialState = {
  theme: detectTheme(),
  activeView: 'history' as View,
  showSidebar: true,
  flash: null,
  activeRepo: null,
  recentRepos: [] as string[],
  worktrees: [] as WorktreeInfo[],
  activeWorktree: null,
  selectedCommit: null,
  selectedFile: null,
  selectedCommits: [] as string[],
  isDraggingCommits: false,
  pendingCherryPickMessage: null as string | null,
  cherryPickConflictActive: false,
  helpDialogOpen: false,
  loadingOperation: null as string | null,
}

export const useGitStore = create<GitStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setTheme: (theme) => {
        try { localStorage.setItem('theme', theme) } catch { /* jsdom */ }
        set({ theme })
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        try { localStorage.setItem('theme', next) } catch { /* jsdom */ }
        set({ theme: next })
      },

      setView: (activeView) => set({ activeView }),
      setActiveView: (activeView) => set({ activeView }),

      setShowSidebar: (showSidebar) => set({ showSidebar }),

      setActiveRepo: (path) => set((s) => ({
        activeRepo: path,
        recentRepos: [path, ...s.recentRepos.filter(r => r !== path)].slice(0, 10),
      })),
      setRecentRepos: (repos) => set({ recentRepos: repos }),

      setWorktrees: (worktrees) => set({ worktrees }),
      setActiveWorktree: (activeWorktree) => set({ activeWorktree }),

      setSelectedCommit: (hash) => set({ selectedCommit: hash, selectedFile: null }),
      setSelectedFile: (path) => set({ selectedFile: path }),

      setSelectedCommits: (hashes) => set({ selectedCommits: hashes }),
      setIsDraggingCommits: (v) => set({ isDraggingCommits: v }),
      setPendingCherryPickMessage: (msg) => set({ pendingCherryPickMessage: msg }),
      setCherryPickConflictActive: (v) => set({ cherryPickConflictActive: v }),

      setHelpDialogOpen: (helpDialogOpen) => set({ helpDialogOpen }),
      setLoadingOperation: (loadingOperation) => set({ loadingOperation }),

      showFlash: (message, type = 'success', durationMs) => {
        set({ flash: { message, type } })
        // Errors stay visible longer so the user has time to read them.
        const timeout = durationMs ?? (type === 'danger' ? 6000 : 2100)
        setTimeout(() => get().clearFlash(), timeout)
      },
      clearFlash: () => set({ flash: null }),
    }),
    { name: 'BoughStore' }
  )
)

// Alias for components following the plan's naming convention
export const useAppStore = useGitStore
