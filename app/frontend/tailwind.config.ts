import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        ui:   ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        acc: 'var(--acc)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warn: 'var(--warn)',
      },
    },
  },
} satisfies Config
