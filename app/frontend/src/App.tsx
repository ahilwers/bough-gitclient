import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EventsOn } from '@wailsjs/runtime/runtime'
import { SaveWindowSize, GetRecentRepos } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import Toolbar from '@/components/Toolbar/Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import HistoryView from '@/components/HistoryView/HistoryView'
import ChangesView from '@/components/ChangesView/ChangesView'
import FlashNotification from '@/components/shared/FlashNotification'
import CommandPalette from '@/components/shared/CommandPalette'

export default function App() {
  const { activeView, showSidebar, theme } = useGitStore()
  const queryClient = useQueryClient()
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Central repo:changed handler — invalidates all data queries
  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['commits'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    })
    return unsubscribe
  }, [queryClient])

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
      <FlashNotification />
    </div>
  )
}
