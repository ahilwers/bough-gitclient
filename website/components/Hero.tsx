'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

const AppScreenMockup = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, rotateX: 20 }}
    whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
    transition={{ duration: 0.8 }}
    className="w-full max-w-4xl mx-auto relative"
  >
    {/* Glow background */}
    <div className="absolute inset-0 bg-gradient-radial from-accent-blue/20 via-accent-purple/10 to-transparent rounded-2xl filter blur-3xl" />

    {/* Mock app container */}
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-900 to-black border border-border-subtle shadow-2xl">
      {/* Titlebar */}
      <div className="h-12 bg-gray-950 border-b border-border-subtle flex items-center px-4 gap-2">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 opacity-70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-70" />
          <div className="w-3 h-3 rounded-full bg-green-500 opacity-70" />
        </div>
        <span className="text-xs text-text-tertiary ml-2">Bough — My Project</span>
      </div>

      {/* Main content area */}
      <div className="flex h-96">
        {/* Left sidebar */}
        <div className="w-48 bg-gray-950 border-r border-border-subtle p-4 overflow-hidden">
          <div className="text-xs font-semibold text-text-secondary mb-3">
            BRANCHES
          </div>
          <div className="space-y-2">
            {[
              { name: 'main', color: 'bg-blue-500' },
              { name: 'feature/auth', color: 'bg-purple-500' },
              { name: 'bugfix/api', color: 'bg-pink-500' },
              { name: 'docs', color: 'bg-green-500' },
              { name: 'refactor', color: 'bg-orange-500' },
            ].map((branch) => (
              <div
                key={branch.name}
                className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-gray-900 transition-colors cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${branch.color}`} />
                <span className="text-text-secondary">{branch.name}</span>
              </div>
            ))}
          </div>

          <div className="text-xs font-semibold text-text-secondary mb-3 mt-6">
            WORKTREES
          </div>
          <div className="space-y-2">
            {[{ name: 'wt-feature' }, { name: 'wt-urgent-fix' }].map(
              (worktree) => (
                <div
                  key={worktree.name}
                  className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-gray-900 transition-colors cursor-pointer"
                >
                  <div className="w-2 h-2 rounded-full bg-accent-blue" />
                  <span className="text-text-secondary">{worktree.name}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Center - commit graph */}
        <div className="flex-1 border-r border-border-subtle p-4 bg-gray-900/20">
          <div className="text-xs font-semibold text-text-secondary mb-4">
            HISTORY
          </div>

          {/* Commit graph visualization */}
          <div className="space-y-3 relative">
            {/* Column lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ height: '100%', width: '60px' }}
            >
              <line
                x1="10"
                y1="0"
                x2="10"
                y2="100%"
                stroke="rgba(79, 142, 247, 0.2)"
                strokeWidth="1"
              />
              <line
                x1="24"
                y1="0"
                x2="24"
                y2="100%"
                stroke="rgba(167, 139, 250, 0.2)"
                strokeWidth="1"
              />
              <line
                x1="38"
                y1="0"
                x2="38"
                y2="100%"
                stroke="rgba(236, 72, 153, 0.2)"
                strokeWidth="1"
              />
              <line
                x1="52"
                y1="0"
                x2="52"
                y2="100%"
                stroke="rgba(34, 197, 94, 0.2)"
                strokeWidth="1"
              />
            </svg>

            {/* Commit nodes */}
            {[
              {
                hash: 'a3f5e2c',
                msg: 'feat: add dark mode',
                col: 0,
                color: '#4f8ef7',
              },
              {
                hash: 'b2d1c9f',
                msg: 'docs: update README',
                col: 1,
                color: '#a78bfa',
              },
              {
                hash: 'c8e4a1b',
                msg: 'fix: resolve memory leak',
                col: 0,
                color: '#4f8ef7',
              },
              {
                hash: 'd1f6e3a',
                msg: 'refactor: optimize queries',
                col: 2,
                color: '#ec4899',
              },
              {
                hash: 'e5a2c7f',
                msg: 'chore: update deps',
                col: 1,
                color: '#a78bfa',
              },
            ].map((commit, idx) => (
              <div key={idx} className="flex items-center gap-2 relative pl-16">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: commit.color,
                    boxShadow: `0 0 10px ${commit.color}`,
                  }}
                />
                <div>
                  <span className="font-mono text-xs text-accent-blue">
                    {commit.hash}
                  </span>
                  <span className="text-xs text-text-secondary ml-2">
                    {commit.msg}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - commit details */}
        <div className="w-56 border-l border-border-subtle p-4 bg-gray-950 overflow-hidden">
          <div className="text-xs font-semibold text-text-secondary mb-4">
            COMMIT DETAILS
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-text-tertiary">Author</span>
              <div className="text-xs text-text-primary mt-1">Dev Team</div>
            </div>
            <div>
              <span className="text-xs text-text-tertiary">Date</span>
              <div className="text-xs text-text-primary mt-1">Today 14:32</div>
            </div>
            <div>
              <span className="text-xs text-text-tertiary">Message</span>
              <div className="text-xs text-text-primary mt-1 line-clamp-3">
                feat: add dark mode support with smooth transitions
              </div>
            </div>
            <div className="pt-2">
              <span className="text-xs text-text-tertiary">Files changed</span>
              <div className="space-y-1 mt-1">
                <div className="text-xs text-text-primary">
                  <span className="text-green-400">+</span> 342
                </div>
                <div className="text-xs text-text-primary">
                  <span className="text-red-400">−</span> 58
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
)

export default function Hero() {
  const t = useTranslations('hero')

  return (
    <section className="relative min-h-screen bg-gradient pt-32 pb-20 px-4 overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      {/* Radial gradient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent-blue/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-96 h-96 bg-accent-purple/5 rounded-full filter blur-3xl pointer-events-none" />

      <div className="relative section-container">
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="mb-6 leading-tight">
            <span className="gradient-text">{t('headline')}</span>
          </h1>

          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
            {t('subheadline')}
          </p>

          <div className="flex justify-center mb-12">
            <a href="#download" className="btn-primary w-full sm:w-auto">
              {t('download')}
            </a>
          </div>

          <div className="inline-block px-4 py-2 rounded-full border border-border-subtle bg-black/30 backdrop-blur-sm text-xs text-text-secondary">
            {t('freeBadge')}
          </div>
        </motion.div>

        {/* App screenshot mockup */}
        <div className="mt-16">
          <AppScreenMockup />
        </div>
      </div>
    </section>
  )
}
