/**
 * BoughLogo — reusable inline SVG logo component.
 *
 * Usage:
 *   <BoughLogo />                    // mark + wordmark, inherits text color
 *   <BoughLogo variant="mark" />     // icon only
 *   <BoughLogo size={24} />          // custom mark height in px (wordmark scales proportionally)
 *   <BoughLogo textColor="#F0F0F0" />
 *
 * The gradient mark works on any background.
 * textColor defaults to "currentColor" so it adapts to whatever color the
 * parent sets — white on dark, dark on light.
 */

interface BoughLogoProps {
  /** "lockup" renders mark + wordmark side by side (default). "mark" renders the icon only. */
  variant?: 'lockup' | 'mark'
  /** Height of the mark in px. Default: 32 */
  size?: number
  /** Fill color for the wordmark. Defaults to currentColor. */
  textColor?: string
  className?: string
}

// Stable gradient IDs — inline SVGs share the DOM, so we use a fixed ID.
// If multiple instances appear on one page, they share the same gradient
// definition (identical, so no visual conflict).
const GRAD_ID = 'bough-mark-grad'

export function BoughMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={GRAD_ID}
          x1="0" y1="0" x2="52" y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* trunk */}
      <line
        x1="26" y1="44" x2="26" y2="26"
        stroke={`url(#${GRAD_ID})`} strokeWidth="2.8" strokeLinecap="round"
      />

      {/* main branches */}
      <path
        d="M26 26 Q26 14 14 14"
        stroke={`url(#${GRAD_ID})`} strokeWidth="2.8" strokeLinecap="round" fill="none"
      />
      <path
        d="M26 26 Q26 14 38 14"
        stroke={`url(#${GRAD_ID})`} strokeWidth="2.8" strokeLinecap="round" fill="none"
      />

      {/* sub-branches */}
      <path
        d="M14 14 Q14 8 8 8"
        stroke={`url(#${GRAD_ID})`} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75"
      />
      <path
        d="M14 14 Q14 8 20 8"
        stroke={`url(#${GRAD_ID})`} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75"
      />
      <path
        d="M38 14 Q38 8 44 8"
        stroke={`url(#${GRAD_ID})`} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75"
      />

      {/* nodes */}
      <circle cx="26" cy="26" r="3.2" fill={`url(#${GRAD_ID})`} />
      <circle cx="14" cy="14" r="3.2" fill={`url(#${GRAD_ID})`} />
      <circle cx="38" cy="14" r="3.2" fill={`url(#${GRAD_ID})`} />
      <circle cx="8"  cy="8"  r="2.2" fill={`url(#${GRAD_ID})`} opacity="0.8" />
      <circle cx="20" cy="8"  r="2.2" fill={`url(#${GRAD_ID})`} opacity="0.8" />
      <circle cx="44" cy="8"  r="2.2" fill={`url(#${GRAD_ID})`} opacity="0.8" />
      <circle cx="26" cy="44" r="2.8" fill={`url(#${GRAD_ID})`} opacity="0.45" />
    </svg>
  )
}

export default function BoughLogo({
  variant = 'lockup',
  size = 32,
  textColor = 'currentColor',
  className = '',
}: BoughLogoProps) {
  if (variant === 'mark') {
    return <BoughMark size={size} />
  }

  // Font size scales with the mark height: at size=32, fontSize ≈ 22px
  const fontSize = Math.round(size * 0.69)
  const gap = Math.round(size * 0.28)

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap }}
      aria-label="Bough"
    >
      <BoughMark size={size} />
      <span
        style={{
          fontSize,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: textColor,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
        }}
      >
        Bough
      </span>
    </span>
  )
}
