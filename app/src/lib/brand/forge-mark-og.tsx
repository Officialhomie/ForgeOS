/**
 * Inline Forge mark for `next/og` ImageResponse (edge runtime).
 * Geometry matches ForgeMark.tsx and public/forge-mark.svg.
 */

import { FORGE_BRAND } from './tokens'

type ForgeMarkOgProps = {
  width: number
  height: number
  gradientId?: string
  showContainer?: boolean
}

export function ForgeMarkOg({
  width,
  height,
  gradientId = 'og-fg',
  showContainer = true,
}: ForgeMarkOgProps) {
  return (
    <svg viewBox="0 0 40 40" width={width} height={height}>
      <defs>
        <linearGradient id={gradientId} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor={FORGE_BRAND.orangeDim} />
          <stop offset="60%" stopColor={FORGE_BRAND.orange} />
          <stop offset="100%" stopColor={FORGE_BRAND.orangeBright} />
        </linearGradient>
      </defs>
      {showContainer ? (
        <>
          <rect x="0" y="0" width="40" height="40" rx="9" fill={FORGE_BRAND.surface} />
          <rect
            x="0.5"
            y="0.5"
            width="39"
            height="39"
            rx="8.75"
            stroke={FORGE_BRAND.orange}
            strokeWidth="1"
            strokeOpacity="0.5"
          />
        </>
      ) : null}
      <rect x="11" y="10" width="4.5" height="20" rx="2.25" fill={`url(#${gradientId})`} />
      <rect x="11" y="10" width="14.5" height="4.5" rx="2.25" fill={`url(#${gradientId})`} />
      <rect x="11" y="18.75" width="10.5" height="3.75" rx="1.875" fill={`url(#${gradientId})`} />
      <circle cx="28" cy="12.25" r="2.75" fill={FORGE_BRAND.orangeBright} />
    </svg>
  )
}
