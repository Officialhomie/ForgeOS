import { cn } from '@/lib/utils'
import { ForgeMark } from './ForgeMark'

interface ForgeLogoProps {
  className?: string
  /** Controls overall scale. Mark is markSize x markSize, text scales proportionally. */
  markSize?: number
  /** Show just the mark without the wordmark */
  markOnly?: boolean
  /** Variant for use on light backgrounds */
  variant?: 'dark' | 'light'
}

export function ForgeLogo({
  className,
  markSize = 32,
  markOnly = false,
  variant = 'dark',
}: ForgeLogoProps) {
  const textSize = Math.round(markSize * 0.5)
  const textColor = variant === 'dark' ? '#fafafa' : '#09090b'

  if (markOnly) {
    return <ForgeMark size={markSize} className={className} />
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)} aria-label="Forge OS">
      <ForgeMark size={markSize} />
      <span
        className="font-bold tracking-tight leading-none select-none"
        style={{ fontSize: textSize, color: textColor }}
      >
        Forge<span style={{ color: '#f97316' }}>OS</span>
      </span>
    </div>
  )
}
