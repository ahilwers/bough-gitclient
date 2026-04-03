'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { useState } from 'react'

const CheckmarkIcon = () => (
  <svg
    className="w-5 h-5 text-accent-blue"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
)

export default function Pricing() {
  const t = useTranslations('pricing')
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
  const locale = 'en'

  const features = t.raw('features')
  const downloadOptions = [
    { label: t('downloadTrialMac'), id: 'mac-silicon' },
    { label: t('downloadTrialMacIntel'), id: 'mac-intel' },
    { label: t('downloadTrialWin'), id: 'windows' },
    { label: t('downloadTrialLinux'), id: 'linux' },
  ]

  const handleBuyClick = async () => {
    setIsLoadingCheckout(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setIsLoadingCheckout(false)
    }
  }

  return (
    <section
      id="pricing"
      className="section bg-gradient border-b border-border-subtle"
    >
      <div className="section-container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            {t('title')}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card border-accent-blue/30 bg-gradient-to-b from-bg-card to-bg-darker"
        >
          {/* Price Badge */}
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 rounded-full border border-accent-blue/30 bg-accent-blue/10 text-xs font-semibold text-accent-blue mb-4">
              Bough
            </div>
            <div className="text-6xl font-bold text-white mb-2">
              {t('price')}
            </div>
            <div className="text-text-secondary">{t('subtitle')}</div>
          </div>

          {/* Features List */}
          <div className="space-y-4 mb-8 py-8 border-y border-border-subtle">
            {features.map((feature: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <CheckmarkIcon />
                </div>
                <span className="text-text-secondary">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={handleBuyClick}
            disabled={isLoadingCheckout}
            className="btn-primary w-full mb-6"
          >
            {isLoadingCheckout ? 'Processing...' : t('buyNow')}
          </button>

          {/* Existing license note */}
          <div className="text-center text-xs text-text-tertiary">
            <p>
              {t('existingKey')} <br />
              {t('activateInApp')}
            </p>
          </div>
        </motion.div>

        {/* Download Trial Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-6">
            {t('downloadSection')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {downloadOptions.map((option, idx) => (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + idx * 0.05 }}
                className="btn-secondary text-sm"
              >
                {option.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
