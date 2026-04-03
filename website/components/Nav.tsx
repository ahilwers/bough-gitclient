'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import BoughLogo from './BoughLogo'

export default function Nav() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'de' : 'en'
    const newPathname = pathname.replace(`/${locale}/`, `/${newLocale}/`)
    router.push(newPathname)
  }

  const handleBuyClick = () => {
    const element = document.getElementById('pricing')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-black/40 backdrop-blur-md border-b border-border-subtle'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${locale}/`} className="flex items-center group">
          <BoughLogo size={28} textColor="#F0F0F0" className="opacity-90 group-hover:opacity-100 transition-opacity" />
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8 flex-1 ml-12">
          <a
            href="#features"
            className="text-text-secondary hover:text-accent-blue transition-colors"
          >
            {t('features')}
          </a>
          <a
            href="#pricing"
            className="text-text-secondary hover:text-accent-blue transition-colors"
          >
            {t('pricing')}
          </a>
          <a
            href="#faq"
            className="text-text-secondary hover:text-accent-blue transition-colors"
          >
            {t('faq')}
          </a>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-border-subtle hover:border-accent-blue transition-colors text-text-secondary hover:text-accent-blue text-sm font-medium"
            aria-label="Toggle language"
          >
            {locale === 'en' ? 'DE' : 'EN'}
          </button>

          {/* Buy button */}
          <button
            onClick={handleBuyClick}
            className="btn-primary hidden sm:block"
          >
            {t('buyNow')}
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex flex-col gap-1.5 w-10 h-10 items-center justify-center"
            aria-label="Toggle menu"
          >
            <div
              className={`w-6 h-0.5 bg-white transition-all duration-300 ${
                isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <div
              className={`w-6 h-0.5 bg-white transition-all duration-300 ${
                isMobileMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <div
              className={`w-6 h-0.5 bg-white transition-all duration-300 ${
                isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black/50 backdrop-blur-md border-t border-border-subtle">
          <div className="px-4 py-4 space-y-3">
            <a
              href="#features"
              className="block text-text-secondary hover:text-accent-blue transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('features')}
            </a>
            <a
              href="#pricing"
              className="block text-text-secondary hover:text-accent-blue transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('pricing')}
            </a>
            <a
              href="#faq"
              className="block text-text-secondary hover:text-accent-blue transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('faq')}
            </a>
            <button
              onClick={() => {
                handleBuyClick()
                setIsMobileMenuOpen(false)
              }}
              className="btn-primary w-full mt-4"
            >
              {t('buyNow')}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
