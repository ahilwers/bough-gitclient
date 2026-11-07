import { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import '../globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const locales = ['en', 'de'] as const
type Locale = typeof locales[number]

interface LocaleLayoutProps {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params

  const titles: Record<Locale, string> = {
    en: 'Bough — The Git Client You Actually Own',
    de: 'Bough — Der Git-Client, der dir gehört',
  }
  const descriptions: Record<Locale, string> = {
    en: 'Bough is a free, native Git client for macOS, Windows, and Linux.',
    de: 'Bough ist ein kostenloser, nativer Git-Client für macOS, Windows und Linux.',
  }

  const l = locales.includes(locale as Locale) ? (locale as Locale) : 'en'

  return {
    metadataBase: new URL('https://boughapp.com'),
    title: titles[l],
    description: descriptions[l],
    openGraph: {
      title: titles[l],
      description: descriptions[l],
      url: `https://boughapp.com/${l}`,
      siteName: 'Bough',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titles[l],
      description: descriptions[l],
    },
    alternates: {
      canonical: `https://boughapp.com/${l}`,
      languages: {
        en: 'https://boughapp.com/en',
        de: 'https://boughapp.com/de',
      },
    },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
    },
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  // Load messages for this locale
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} font-sans bg-bg-dark text-text-primary antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <div className="flex flex-col min-h-screen">
            <Nav />
            <main className="flex-grow pt-20">{children}</main>
            <Footer />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
