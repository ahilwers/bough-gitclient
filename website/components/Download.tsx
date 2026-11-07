'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

export default function Download() {
  const t = useTranslations('download')

  return (
    <section id="download" className="section bg-gradient border-b border-border-subtle">
      <div className="section-container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card border-accent-blue/30 bg-gradient-to-b from-bg-card to-bg-darker text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            {t('title')}
          </h2>
          <p className="text-text-secondary mb-4">{t('platforms')}</p>
          <p className="text-text-secondary">{t('availability')}</p>
        </motion.div>
      </div>
    </section>
  )
}
