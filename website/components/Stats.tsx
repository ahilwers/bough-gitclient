'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

export default function Stats() {
  const t = useTranslations('stats')

  const stats = [
    {
      value: t('price'),
      label: t('priceDesc'),
    },
    {
      value: t('trial'),
      label: t('trialDesc'),
    },
    {
      value: t('platforms'),
      label: t('platformsDesc'),
    },
  ]

  return (
    <section className="py-16 px-4 bg-gradient border-y border-border-subtle">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                {stat.value}
              </div>
              <div className="text-text-secondary text-sm md:text-base">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
