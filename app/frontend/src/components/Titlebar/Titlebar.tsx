import { Sun, Moon } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'

export default function Titlebar() {
  const { theme, toggleTheme, activeRepo } = useGitStore()
  const repoName = activeRepo ? activeRepo.split('/').pop() : null

  return (
    <div
      style={{
        height: 40,
        background: 'var(--bg-titlebar)',
        borderBottom: '1px solid var(--border-sub)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 80,   // space for macOS traffic lights
        paddingRight: 12,
        // @ts-expect-error webkit drag region
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      {/* App + repo title */}
      <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-pri)' }}>
        Bough
        {repoName && (
          <span style={{ fontWeight: 400, color: 'var(--text-ter)', marginLeft: 8 }}>
            — {repoName}
          </span>
        )}
      </div>

      {/* Theme toggle — must opt out of window drag */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label="Toggle theme"
        style={{
          // @ts-expect-error webkit no-drag
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-ter)',
          cursor: 'pointer',
        }}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </div>
  )
}
