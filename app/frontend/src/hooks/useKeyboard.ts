import { useEffect } from 'react'
import { useGitStore } from '@/stores/gitStore'

export function useKeyboard() {
  const setActiveView = useGitStore((s) => s.setActiveView)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // ⌘K — open command palette
      if (mod && e.key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('palette:open'))
      }
      // ⌘1 — History view
      if (mod && e.key === '1') {
        e.preventDefault()
        setActiveView('history')
      }
      // ⌘2 — Changes view
      if (mod && e.key === '2') {
        e.preventDefault()
        setActiveView('changes')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveView])
}
