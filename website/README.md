# Bough website

The Next.js website for the free Bough Git client. The landing page is available in English and German, and includes feature information, download availability and a FAQ.

## Development

Requires Node.js 22 and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000/en](http://localhost:3000/en) or [http://localhost:3000/de](http://localhost:3000/de). No environment variables are required for the website.

## Build and test

```bash
pnpm build
pnpm test
pnpm start
```

The tests start the production build locally, so run `pnpm build` first. The build uses the Inter font from Google Fonts and may need network access.

## Structure

- `app/[locale]/`: localized layout, metadata and landing page
- `components/`: landing-page sections, including `Download.tsx`
- `messages/`: English and German translations
- `i18n/` and `middleware.ts`: locale routing
- `../.github/workflows/website.yml`: build and Vercel deployment

The download section deliberately shows an availability notice rather than placeholder download buttons. Add links only when public release URLs are verified, and update both translations and tests accordingly.

## Deployment

The website workflow builds on changes under `website/` and deploys to Vercel. It requires the Vercel token, organization ID and project ID in GitHub Actions secrets. SEO metadata and canonical URLs are configured in `app/[locale]/layout.tsx`.
