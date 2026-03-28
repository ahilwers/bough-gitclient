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

  // Flash notifications
  flash: { message: string; type: 'success' | 'danger' | 'info' } | null
  showFlash: (message: string, type?: 'success' | 'danger' | 'info') => void
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

      setWorktrees: (worktrees) => set({ worktrees }),
      setActiveWorktree: (activeWorktree) => set({ activeWorktree }),

      setSelectedCommit: (hash) => set({ selectedCommit: hash, selectedFile: null }),
      setSelectedFile: (path) => set({ selectedFile: path }),

      showFlash: (message, type = 'success') => {
        set({ flash: { message, type } })
        setTimeout(() => get().clearFlash(), 2100)
      },
      clearFlash: () => set({ flash: null }),
    }),
    { name: 'BoughStore' }
  )
)

// Alias for components following the plan's naming convention
export const useAppStore = useGitStore
