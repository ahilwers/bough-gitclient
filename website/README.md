# Bough Marketing Website

A production-ready Next.js 15 marketing website for Bough, a cross-platform native Git GUI client.

## Features

- **Dark theme** targeting developers — deep near-black background (#07070f) with premium feel
- **Responsive design** — works beautifully on desktop, tablet, and mobile
- **Internationalization** — English and German with locale prefix routing (`/en/`, `/de/`)
- **Stripe integration** — one-time €29 payment for Bough licenses
- **Framer Motion animations** — smooth scroll-triggered section reveals
- **Tailwind CSS 3** — utility-first styling with custom design tokens
- **SEO optimized** — proper metadata, Open Graph tags, canonical URLs
- **Accessible** — semantic HTML, ARIA labels, keyboard navigation

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **Internationalization**: next-intl v3
- **Animations**: Framer Motion
- **Payments**: Stripe (server-side)
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ (22 recommended)
- npm or yarn
- Stripe account for payment processing

### Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Add your Stripe keys to .env.local
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PRICE_ID=price_...

# Run development server
npm run dev
```

Open [http://localhost:3000/en](http://localhost:3000/en) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
website/
├── app/
│   ├── globals.css              # Global styles and design tokens
│   ├── layout.tsx               # Root layout
│   ├── api/
│   │   └── checkout/
│   │       └── route.ts         # Stripe checkout endpoint
│   └── [locale]/
│       ├── layout.tsx           # Locale-specific layout
│       ├── page.tsx             # Home page (all sections)
│       └── success/
│           └── page.tsx         # Post-purchase success page
├── components/
│   ├── Nav.tsx                  # Sticky navigation bar
│   ├── Hero.tsx                 # Hero section with CTA + mockup
│   ├── Stats.tsx                # Stats strip
│   ├── Features.tsx             # 5 feature cards
│   ├── Comparison.tsx           # Competitive comparison table
│   ├── Pricing.tsx              # Pricing card + download links
│   ├── FAQ.tsx                  # Accordion FAQ
│   └── Footer.tsx               # Footer with links
├── lib/
│   └── stripe.ts                # Stripe client configuration
├── messages/
│   ├── en.json                  # English translations
│   └── de.json                  # German translations
├── .github/workflows/
│   └── website.yml              # CI/CD deployment workflow
├── middleware.ts                # next-intl routing middleware
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── package.json
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PRICE_ID=price_your_product_price_id
NEXT_PUBLIC_BASE_URL=https://boughapp.com
```

- `STRIPE_SECRET_KEY`: Your Stripe secret key (never expose publicly)
- `STRIPE_PRICE_ID`: The product price ID created in Stripe dashboard
- `NEXT_PUBLIC_BASE_URL`: Your website's base URL (safe to expose)

## Pages

### Home (`/[locale]`)
Main landing page with:
- Navigation bar with language switcher
- Hero section with mockup app screenshot
- Statistics strip
- Feature highlights (5 cards)
- Competitive comparison table
- Pricing card with CTA
- FAQ accordion
- Footer

### Success (`/[locale]/success`)
Post-purchase page displayed after Stripe payment:
- Confirmation message
- Download links for all platforms
- Link back to home

## Stripe Integration

### Setting up Stripe

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create a product: "Bough License"
3. Create a one-time price: €29
4. Copy your Secret Key and Price ID
5. Add to `.env.local`

### Checkout Flow

1. User clicks "Buy Now" button
2. Frontend calls `POST /api/checkout` with locale
3. Server creates Stripe checkout session
4. User is redirected to Stripe payment form
5. After payment, redirected to `/[locale]/success`

## Internationalization (i18n)

All user-visible strings are in `messages/en.json` and `messages/de.json`.

To add new strings:
1. Add to both `en.json` and `de.json`
2. Use `useTranslations()` hook in components
3. Structure messages logically (e.g., `nav.features`, `hero.headline`)

## Styling

Design tokens are defined in `tailwind.config.ts` and `globals.css`:

- **Colors**:
  - Backgrounds: `#07070f`, `#0d0d1a`
  - Primary text: white
  - Secondary text: `#a0a0a8`
  - Accents: `#4f8ef7` (blue), `#a78bfa` (purple)
  - Borders: `rgba(255,255,255,0.07)`

- **Animations**:
  - `float`: 6s ease-in-out
  - `glow`: 3s ease-in-out
  - `pulse-slow`: 3s cubic-bezier

## Performance

- All components use React 19 with server components by default
- Client components marked with `'use client'` for interactivity
- Images: Responsive sizing, lazy loading
- CSS: Minimal bundle with Tailwind purging
- Stripe: Loaded only on checkout page

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository in Vercel dashboard
3. Set environment variables in Vercel project settings
4. Automatic deployments on push to `main`

Workflow file `.github/workflows/website.yml` automates builds and deploys to Vercel.

### Other Platforms

The site is a standard Next.js 15 app and works on any Node.js 18+ host:
- Netlify
- Railway
- Render
- DigitalOcean App Platform

## SEO

- Metadata configured for all locales
- Open Graph tags for social sharing
- Canonical URLs for duplicate content prevention
- Sitemap generation (add `next-sitemap` if needed)
- Mobile-friendly responsive design

## Accessibility

- Semantic HTML5 structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus visible states on buttons/links
- Sufficient color contrast (WCAG AA)
- Alt text on images and icons

## License

© 2025 Bough. All rights reserved.
