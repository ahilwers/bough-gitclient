# Website setup

Use Node.js 22 and pnpm 10. From `website/`:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Visit `/en` or `/de` on `http://localhost:3000`. No environment variables are needed.

For production verification, run `pnpm build` followed by `pnpm test`. The build fetches the Inter font through Next.js and may require network access. The GitHub Actions workflow at `../.github/workflows/website.yml` builds and deploys the website to Vercel.

The download section currently displays an availability notice. Replace it with verified public release URLs once they exist; keep both locales consistent.
