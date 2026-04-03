'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import BoughLogo from './BoughLogo'

export default function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'de' : 'en'
    const newPathname = pathname.replace(`/${locale}/`, `/${newLocale}/`)
    router.push(newPathname)
  }

  return (
    <footer className="border-t border-border-subtle bg-black/20 backdrop-blur-sm">
      <div className="section-container py-16 px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand section */}
          <div className="md:col-span-1">
            <Link href={`/${locale}/`} className="inline-flex mb-4 opacity-80 hover:opacity-100 transition-opacity">
              <BoughLogo size={24} textColor="#F0F0F0" />
            </Link>
            <p className="text-text-secondary text-sm">{t('tagline')}</p>
          </div>

          {/* Links section */}
          <div className="md:col-span-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {/* Legal */}
              <div>
                <h4 className="font-semibold text-white mb-3 text-sm">Legal</h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#privacy"
                      className="text-text-secondary hover:text-accent-blue transition-colors text-sm"
                    >
                      {t('privacyPolicy')}
                    </a>
                  </li>
                  <li>
                    <a
                      href="#terms"
                      className="text-text-secondary hover:text-accent-blue transition-colors text-sm"
                    >
                      {t('terms')}
                    </a>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h4 className="font-semibold text-white mb-3 text-sm">
                  Support
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="mailto:hello@boughapp.com"
                      className="text-text-secondary hover:text-accent-blue transition-colors text-sm"
                    >
                      {t('contact')}
                    </a>
                  </li>
                </ul>
              </div>

              {/* Language */}
              <div>
                <h4 className="font-semibold text-white mb-3 text-sm">
                  {t('language')}
                </h4>
                <button
                  onClick={toggleLocale}
                  className="text-text-secondary hover:text-accent-blue transition-colors text-sm"
                >
                  {locale === 'en' ? 'Deutsch' : 'English'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border-subtle pt-8 text-center text-text-tertiary text-sm">
          {t('copyright')}
        </div>
      </div>
    </footer>
  )
}
