import { cn } from '@/lib/utils'

interface ForgeMarkProps {
  className?: string
  size?: number
}

export function ForgeMark({ className, size = 40 }: ForgeMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      width={size}
      height={size}
      aria-label="Forge OS mark"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="forge-fg" x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="60%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <radialGradient id="forge-spark-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Squircle container */}
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="#18181b" />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="9.5"
        stroke="#f97316"
        strokeWidth="0.75"
        strokeOpacity="0.35"
      />

      {/* F mark: vertical stroke */}
      <rect x="11" y="10" width="4.5" height="20" rx="2.25" fill="url(#forge-fg)" />
      {/* F mark: top crossbar */}
      <rect x="11" y="10" width="14.5" height="4.5" rx="2.25" fill="url(#forge-fg)" />
      {/* F mark: middle crossbar */}
      <rect x="11" y="18.75" width="10.5" height="3.75" rx="1.875" fill="url(#forge-fg)" />

      {/* Spark glow halo */}
      <circle cx="28" cy="12.25" r="5" fill="url(#forge-spark-glow)" />
      {/* Spark dot */}
      <circle cx="28" cy="12.25" r="2.75" fill="#fb923c" />
    </svg>
  )
}
