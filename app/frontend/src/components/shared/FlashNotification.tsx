import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'

export default function FlashNotification() {
  const flash = useGitStore((s) => s.flash)

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
            padding: '8px 14px',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon size={15} />
          {flash.message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
