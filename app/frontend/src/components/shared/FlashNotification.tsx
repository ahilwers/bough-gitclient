import { useGitStore } from '@/stores/gitStore'

export default function FlashNotification() {
  const flash = useGitStore((s) => s.flash)

  if (!flash) return null

  const bg =
    flash.type === 'success' ? 'var(--success)' :
    flash.type === 'danger'  ? 'var(--danger)'  :
    'var(--acc)'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: bg,
        color: '#fff',
        padding: '8px 16px',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow)',
        fontSize: 13,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {flash.message}
    </div>
  )
}
