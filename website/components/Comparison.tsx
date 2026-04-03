'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

const CheckIcon = () => (
  <svg
    className="w-5 h-5 text-green-400"
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

const XIcon = () => (
  <svg
    className="w-5 h-5 text-red-400"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
)

const Cell = ({ value, isHeader = false, isBough = false }: { value: string | boolean; isHeader?: boolean; isBough?: boolean }) => {
  if (typeof value === 'boolean') {
    return (
      <div
        className={`h-14 flex items-center justify-center ${
          isHeader ? 'py-3' : ''
        }`}
      >
        {value ? <CheckIcon /> : <XIcon />}
      </div>
    )
  }

  return (
    <div
      className={`h-14 flex items-center px-4 ${
        isHeader
          ? `font-bold text-lg ${
              isBough
                ? 'text-accent-blue bg-accent-blue/5 border-x border-accent-blue/20'
                : 'text-text-secondary'
            }`
          : 'text-text-secondary text-sm'
      }`}
    >
      {value}
    </div>
  )
}

export default function Comparison() {
  const t = useTranslations('comparison')

  const comparisonData = [
    {
      feature: t('price'),
      bough: '€29',
      tower: '€79/yr',
      gitkraken: '€4.99/mo',
      fork: '€49',
    },
    {
      feature: t('subscription'),
      bough: true,
      tower: false,
      gitkraken: false,
      fork: true,
    },
    {
      feature: t('worktrees'),
      bough: true,
      tower: false,
      gitkraken: true,
      fork: false,
    },
    {
      feature: t('nativeApp'),
      bough: true,
      tower: true,
      gitkraken: false,
      fork: true,
    },
    {
      feature: t('macos'),
      bough: true,
      tower: true,
      gitkraken: true,
      fork: true,
    },
    {
      feature: t('windows'),
      bough: true,
      tower: true,
      gitkraken: true,
      fork: false,
    },
    {
      feature: t('linux'),
      bough: true,
      tower: false,
      gitkraken: true,
      fork: false,
    },
  ]

  return (
    <section className="section bg-gradient border-b border-border-subtle">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            {t('title')}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="overflow-x-auto rounded-xl border border-border-subtle"
        >
          <table className="w-full border-collapse bg-bg-card">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-4 h-14 py-3 font-bold text-text-secondary bg-bg-darker">
                  Client
                </th>
                <th className="h-14 py-3 bg-accent-blue/5 border-x border-accent-blue/20">
                  <Cell value={t('bough')} isHeader isBough />
                </th>
                <th className="h-14 py-3">
                  <div className="font-bold text-lg text-text-secondary">
                    {t('tower')}
                  </div>
                </th>
                <th className="h-14 py-3">
                  <div className="font-bold text-lg text-text-secondary">
                    {t('gitkraken')}
                  </div>
                </th>
                <th className="h-14 py-3">
                  <div className="font-bold text-lg text-text-secondary">
                    {t('fork')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-border-subtle ${
                    idx % 2 === 1 ? 'bg-black/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-text-primary text-sm bg-bg-darker">
                    {row.feature}
                  </td>
                  <td className="bg-accent-blue/5 border-x border-accent-blue/20">
                    <Cell
                      value={row.bough}
                      isBough
                      isHeader={typeof row.bough === 'string'}
                    />
                  </td>
                  <td>
                    <Cell
                      value={row.tower}
                      isHeader={typeof row.tower === 'string'}
                    />
                  </td>
                  <td>
                    <Cell
                      value={row.gitkraken}
                      isHeader={typeof row.gitkraken === 'string'}
                    />
                  </td>
                  <td>
                    <Cell
                      value={row.fork}
                      isHeader={typeof row.fork === 'string'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  )
}
