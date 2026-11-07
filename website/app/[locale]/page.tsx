import { Metadata } from 'next'
import Hero from '@/components/Hero'
import Stats from '@/components/Stats'
import Features from '@/components/Features'
import Comparison from '@/components/Comparison'
import Download from '@/components/Download'
import FAQ from '@/components/FAQ'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params

  const titles: Record<string, string> = {
    en: 'Bough — The Git Client You Actually Own',
    de: 'Bough — Der Git-Client, der dir gehört',
  }

  return {
    title: titles[locale] || titles['en'],
    keywords:
      locale === 'de'
        ? 'Git GUI, Git Client, Desktop App, macOS, Windows, Linux'
        : 'Git GUI, Git Client, Desktop Application, macOS, Windows, Linux',
  }
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <Comparison />
      <Download />
      <FAQ />
    </>
  )
}
