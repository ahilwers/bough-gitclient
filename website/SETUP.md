# Bough Website — Quick Setup Guide

## 1. Install Dependencies

```bash
cd website
npm install
```

## 2. Set Up Environment Variables

Copy the example file and add your Stripe credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_PRICE_ID=price_your_id_here
NEXT_PUBLIC_BASE_URL=https://boughapp.com
```

**How to get these values:**
- Go to [Stripe Dashboard](https://dashboard.stripe.com)
- Copy your Secret Key from the API Keys section
- Create a Product called "Bough" with a €29 one-time price
- Copy that Price ID

## 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000/en](http://localhost:3000/en) or [http://localhost:3000/de](http://localhost:3000/de)

The page will hot-reload as you edit files.

## 4. Build for Production

```bash
npm run build
npm run start
```

## 5. Deploy to Vercel (Optional)

### Via CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts and add environment variables in the Vercel dashboard.

### Via GitHub

1. Push code to GitHub
2. Import repo in [Vercel Dashboard](https://vercel.com/dashboard)
3. Add environment variables in project settings
4. Automatic deployments on push to `main`

## File Checklist

```
website/
├── ✅ .env.local.example        # Environment template
├── ✅ .gitignore                # Git ignore rules
├── ✅ package.json              # Dependencies
├── ✅ tsconfig.json             # TypeScript config
├── ✅ next.config.ts            # Next.js config
├── ✅ tailwind.config.ts        # Tailwind config
├── ✅ postcss.config.js         # PostCSS config
├── ✅ middleware.ts             # i18n routing
├── ✅ README.md                 # Full documentation
├── ✅ SETUP.md                  # This file
├── ✅ app/
│   ├── ✅ globals.css
│   ├── ✅ layout.tsx
│   ├── ✅ api/checkout/route.ts
│   └── ✅ [locale]/
│       ├── ✅ layout.tsx
│       ├── ✅ page.tsx
│       └── ✅ success/page.tsx
├── ✅ components/
│   ├── ✅ Nav.tsx
│   ├── ✅ Hero.tsx
│   ├── ✅ Stats.tsx
│   ├── ✅ Features.tsx
│   ├── ✅ Comparison.tsx
│   ├── ✅ Pricing.tsx
│   ├── ✅ FAQ.tsx
│   └── ✅ Footer.tsx
├── ✅ lib/
│   └── ✅ stripe.ts
├── ✅ messages/
│   ├── ✅ en.json
│   └── ✅ de.json
└── ✅ .github/workflows/
    └── ✅ website.yml
```

## Customization

### Colors

Edit `tailwind.config.ts`:
- `bg-dark`: Main background (`#07070f`)
- `accent-blue`: Primary accent (`#4f8ef7`)
- `accent-purple`: Secondary accent (`#a78bfa`)

### Text & Translations

Edit `messages/en.json` and `messages/de.json` to update all copy.

### Sections

Each section is a component in `components/`:
- `Hero.tsx` — Hero with mockup screenshot
- `Stats.tsx` — Statistics strip
- `Features.tsx` — Feature cards
- `Comparison.tsx` — Competitive table
- `Pricing.tsx` — Pricing card
- `FAQ.tsx` — Accordion FAQ

To reorder sections, edit `app/[locale]/page.tsx`.

### Download Links

Update download URLs in `components/Pricing.tsx` and `app/[locale]/success/page.tsx`:

```tsx
const downloadOptions = [
  { label: 'macOS (Apple Silicon)', url: 'https://...' },
  // ... etc
]
```

## Troubleshooting

### Port 3000 already in use

```bash
npm run dev -- -p 3001
```

### Build fails with TypeScript errors

```bash
npm run build -- --verbose
```

### Stripe checkout not working

1. Check `.env.local` has correct keys
2. Verify STRIPE_PRICE_ID exists in Stripe dashboard
3. Check browser console for errors
4. Try incognito mode to clear cache

### Styles not showing

Clear Next.js cache:
```bash
rm -rf .next
npm run dev
```

## Support

For issues or questions, contact [hello@boughapp.com](mailto:hello@boughapp.com)

## Next Steps

1. Update download URLs in Pricing & Success pages
2. Add real app screenshots to Hero section (replace the mockup)
3. Set up email provider to send license keys after purchase
4. Create Privacy Policy and Terms pages
5. Set up analytics (Vercel Analytics, PostHog, etc.)
6. Configure custom domain (boughapp.com)
7. Enable HTTPS and security headers

---

Happy building! 🚀
