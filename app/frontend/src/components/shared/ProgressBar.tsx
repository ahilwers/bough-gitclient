import { useGitStore } from '@/stores/gitStore'

/**
 * Indeterminate progress bar that slides across the top of the window
 * whenever `loadingOperation` is set in the global store.
 * Also shows a small label next to the animated bar.
 */
export default function ProgressBar() {
  const loadingOperation = useGitStore(s => s.loadingOperation)

  if (!loadingOperation) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9000,
      height: 3,
      background: 'var(--border-sub)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        height: '100%',
        width: '40%',
        background: 'var(--acc)',
        borderRadius: 2,
        animation: 'progress-slide 1.4s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes progress-slide {
          0%   { left: -40%; }
          100% { left: 140%; }
        }
      `}</style>
    </div>
  )
}
