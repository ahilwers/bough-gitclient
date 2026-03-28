// Graph branch line colors — reads from CSS design tokens so light/dark theme works.
// Fallbacks match the values defined in index.css (--line-0 through --line-7).

const FALLBACK_COLORS = [
  '#0066CC', // --line-0  main/master
  '#00875A', // --line-1  feature/*
  '#D92D20', // --line-2  hotfix/*
  '#7C3AED', // --line-3  release/*
  '#C4680A', // --line-4  chore/*, other
  '#0891B2', // --line-5
  '#BE185D', // --line-6
  '#15803D', // --line-7
] as const

/**
 * Returns the 8 graph line colors from CSS custom properties.
 * Falls back to hardcoded values when CSS vars are not available (e.g. jsdom).
 */
export function getGraphColors(): string[] {
  const style = getComputedStyle(document.documentElement)
  return FALLBACK_COLORS.map((fallback, i) => {
    const value = style.getPropertyValue(`--line-${i}`).trim()
    return value || fallback
  })
}

/** Returns a single graph color by index (mod 8). */
export function graphColor(index: number): string {
  return getGraphColors()[index % FALLBACK_COLORS.length]
}
