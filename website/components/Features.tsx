'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

const GitBranchIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 10l3-3m0 0l3 3m-3-3v10m8-5c0 1.657-.895 3-2 3s-2-1.343-2-3m2 3v4m0 0l3-3m-3 3l-3-3"
    />
  </svg>
)

const LayersIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M5 15l7-7 7 7M5 8l7-7 7 7"
    />
  </svg>
)

const CopyIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
)

const ShieldIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 12l2 2 4-4m7.773-4.3a10 10 0 00-5.5-1.549C12.686 3.75 10.5 4.972 9 6.75M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 0C5.595 3.75 4 4.972 4 6.75v10.5A8.855 8.855 0 0012 21c3.487 0 6.462-1.473 8.307-4"
    />
  </svg>
)

const LightningIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
)

const SparklesIcon = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const FeatureCard = ({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode
  title: string
  description: string
  delay: number
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="card group"
  >
    <div className="text-accent-blue mb-4 group-hover:text-accent-purple transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
  </motion.div>
)

export default function Features() {
  const t = useTranslations('features')

  const features = [
    {
      icon: <GitBranchIcon />,
      title: t('graph.title'),
      description: t('graph.desc'),
    },
    {
      icon: <LayersIcon />,
      title: t('staging.title'),
      description: t('staging.desc'),
    },
    {
      icon: <CopyIcon />,
      title: t('worktrees.title'),
      description: t('worktrees.desc'),
    },
    {
      icon: <ShieldIcon />,
      title: t('local.title'),
      description: t('local.desc'),
    },
    {
      icon: <LightningIcon />,
      title: t('native.title'),
      description: t('native.desc'),
    },
  ]

  return (
    <section
      id="features"
      className="section bg-gradient border-b border-border-subtle"
    >
      <div className="section-container">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {features.map((feature, idx) => (
            <FeatureCard
              key={idx}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={idx * 0.1}
            />
          ))}
        </div>

        {/* Add one more feature in a centered position below */}
        <div className="flex justify-center mt-10">
          <div className="max-w-md w-full">
            <FeatureCard
              icon={<SparklesIcon />}
              title={t('performance.title')}
              description={t('performance.desc')}
              delay={0.5}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
