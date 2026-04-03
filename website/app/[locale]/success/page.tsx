'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Suspense } from 'react'

const CheckmarkIcon = () => (
  <svg
    className="w-20 h-20"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)


function SuccessContent() {
  const t = useTranslations('success')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const downloadOptions = [
    { label: t('downloadSection') + ' — macOS (Apple Silicon)', id: 'mac-silicon' },
    { label: t('downloadSection') + ' — macOS (Intel)', id: 'mac-intel' },
    { label: t('downloadSection') + ' — Windows', id: 'windows' },
    { label: t('downloadSection') + ' — Linux AppImage', id: 'linux' },
  ]

  return (
    <div className="min-h-screen bg-gradient flex items-center justify-center px-4">
      <div className="section-container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {/* Checkmark icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <div className="text-green-400">
              <CheckmarkIcon />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            {t('title')}
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-lg text-text-secondary mb-12 max-w-xl mx-auto"
          >
            {t('message')}
          </motion.p>

          {/* Session ID debug (optional) */}
          {sessionId && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-xs text-text-tertiary mb-8 font-mono"
            >
              Session: {sessionId}
            </motion.p>
          )}

          {/* Download buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-12"
          >
            <h3 className="text-white font-semibold mb-4 text-center">
              {t('downloadSection')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {downloadOptions.map((option, idx) => (
                <motion.a
                  key={option.id}
                  href={`#download-${option.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + idx * 0.05 }}
                  className="btn-secondary text-sm"
                >
                  {option.label}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Back to home */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Link href={`/${locale}`} className="text-accent-blue hover:text-accent-purple transition-colors font-medium">
              {t('backToHome')} →
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
