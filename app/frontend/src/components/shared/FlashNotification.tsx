// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Button } from './Button'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorDetails, isLongMessage } from './ErrorDetails'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'

export default function FlashNotification() {
  const { t } = useTranslation()
  // The full text of the message currently shown in a details dialog.
  const [details, setDetails] = useState<string | null>(null)
  const flash = useGitStore((s) => s.flash)
  const clearFlash = useGitStore((s) => s.clearFlash)

  const message = flash?.message ?? ''
  const isError = flash?.type === 'danger'
  // Errors may carry Git's complete output; the toast only shows its first
  // lines, so anything longer gets a link to the details dialog.
  const showDetails = isError && isLongMessage(message)

  const bg =
    flash?.type === 'success' ? 'var(--success)' :
    flash?.type === 'danger'  ? 'var(--danger)'  :
    'var(--acc)'

  const Icon =
    flash?.type === 'success' ? CheckCircle2 :
    flash?.type === 'danger'  ? AlertCircle  :
    Info

  return (
    <>
    {details && <ErrorDetails text={details} onClose={() => setDetails(null)} />}
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
          <span data-testid="flash-message" style={{
            flex: 1, minWidth: 0,
            // Long Git output is clamped here; the details dialog shows it all.
            display: isError ? '-webkit-box' : undefined,
            WebkitLineClamp: isError ? 3 : undefined,
            WebkitBoxOrient: isError ? 'vertical' : undefined,
            overflow: isError ? 'hidden' : undefined,
          }}>{message}</span>
          {showDetails && (
            <Button
              onClick={() => setDetails(message)}
              style={{
                flexShrink: 0, alignSelf: 'flex-start',
                background: 'rgba(255,255,255,0.16)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.45)',
                borderRadius: 'var(--r-sm)',
                padding: '1px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 1,
              }}
            >
              {t('errors.details')}
            </Button>
          )}
          {/* Errors show an explicit dismiss button since they live for 6 s */}
          {isError && (
            <Button variant="ghost"
              onClick={clearFlash}
              aria-label={t('errors.close')}
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
    </>
  )
}
