import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type View = 'history' | 'changes'
export type Theme = 'light' | 'dark'

interface GitStore {
  // App state
  theme: Theme
  activeView: View
  flash: { message: string; type: 'success' | 'danger' | 'info' } | null

  // Repository state
  activeRepo: string | null
  recentRepos: string[]

  // Selection state (used by History and Changes views)
  selectedCommit: string | null
  selectedFile: string | null

  // Actions
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setView: (v: View) => void
  setActiveRepo: (path: string) => void
  showFlash: (message: string, type?: 'success' | 'danger' | 'info') => void
  clearFlash: () => void
  setSelectedCommit: (hash: string | null) => void
  setSelectedFile: (path: string | null) => void
}

const initialState = {
  theme: (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') as Theme,
  activeView: 'history' as View,
  flash: null,
  activeRepo: null,
  recentRepos: [] as string[],
  selectedCommit: null,
  selectedFile: null,
}

export const useGitStore = create<GitStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setView: (activeView) => set({ activeView }),
      setActiveRepo: (path) => set((s) => ({
        activeRepo: path,
        recentRepos: [path, ...s.recentRepos.filter(r => r !== path)].slice(0, 10),
      })),
      showFlash: (message, type = 'success') => {
        set({ flash: { message, type } })
        setTimeout(() => get().clearFlash(), 2100)
      },
      clearFlash: () => set({ flash: null }),
      // Selecting a new commit clears the selected file
      setSelectedCommit: (hash) => set({ selectedCommit: hash, selectedFile: null }),
      setSelectedFile: (path) => set({ selectedFile: path }),
    }),
    { name: 'BoughStore' }
  )
)
