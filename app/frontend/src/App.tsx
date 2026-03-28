import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EventsOn } from '@wailsjs/runtime/runtime'
import { useGitStore } from '@/stores/gitStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import Titlebar from '@/components/Titlebar/Titlebar'
import Toolbar from '@/components/Toolbar/Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import HistoryView from '@/components/HistoryView/HistoryView'
import ChangesView from '@/components/ChangesView/ChangesView'
import FlashNotification from '@/components/shared/FlashNotification'
import CommandPalette from '@/components/shared/CommandPalette'

export default function App() {
  const { activeView, showSidebar, theme } = useGitStore()
  const queryClient = useQueryClient()

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

  // Global keyboard shortcuts (⌘K, ⌘1, ⌘2)
  useKeyboard()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden"
         style={{ background: 'var(--bg-window)' }}>
      <Titlebar />
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
