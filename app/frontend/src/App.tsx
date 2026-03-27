import { useEffect } from 'react'
import { useGitStore } from '@/stores/gitStore'
import Titlebar from '@/components/Titlebar/Titlebar'
import Toolbar from '@/components/Toolbar/Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import HistoryView from '@/components/HistoryView/HistoryView'
import ChangesView from '@/components/ChangesView/ChangesView'
import FlashNotification from '@/components/shared/FlashNotification'

export default function App() {
  const { activeView, theme } = useGitStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden"
         style={{ background: 'var(--bg-window)' }}>
      <Titlebar />
      <Toolbar />

      <div className="flex flex-1 overflow-hidden">
        {activeView === 'history' && <Sidebar />}
        {activeView === 'history' ? <HistoryView /> : <ChangesView />}
      </div>

      <FlashNotification />
    </div>
  )
}
