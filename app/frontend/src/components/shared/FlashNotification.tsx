import { Button } from './Button'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'

export default function FlashNotification() {
  const flash = useGitStore((s) => s.flash)
  const clearFlash = useGitStore((s) => s.clearFlash)

  const isError = flash?.type === 'danger'

  const bg =
    flash?.type === 'success' ? 'var(--success)' :
    flash?.type === 'danger'  ? 'var(--danger)'  :
    'var(--acc)'

  const Icon =
    flash?.type === 'success' ? CheckCircle2 :
    flash?.type === 'danger'  ? AlertCircle  :
    Info

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.message}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: bg,
            color: '#fff',
            padding: isError ? '10px 14px' : '8px 14px',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 9999,
            // Errors are clickable (to dismiss) and may wrap; toasts don't.
            pointerEvents: isError ? 'auto' : 'none',
            display: 'flex',
            alignItems: isError ? 'flex-start' : 'center',
            gap: 8,
            maxWidth: 520,
            whiteSpace: isError ? 'pre-wrap' : 'nowrap',
            wordBreak: isError ? 'break-word' : undefined,
            cursor: isError ? 'default' : undefined,
          }}
        >
          <Icon size={15} style={{ flexShrink: 0, marginTop: isError ? 1 : 0 }} />
          <span style={{ flex: 1 }}>{flash.message}</span>
          {/* Errors show an explicit dismiss button since they live for 6 s */}
          {isError && (
            <Button variant="ghost"
              onClick={clearFlash}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.8)',
                padding: 0,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                marginTop: 1,
              }}
            >
              <X size={14} />
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
