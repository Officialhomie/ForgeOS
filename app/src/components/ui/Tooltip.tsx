'use client'

import { useState } from 'react'

// ─── CORE TOOLTIP ─────────────────────────────────────────────────────────────

interface TooltipProps {
  /** The explanation text shown on hover */
  content: string
  /** Which side the bubble appears on (default: top) */
  side?: 'top' | 'bottom' | 'right' | 'left'
  className?: string
}

/**
 * Small ⓘ icon that reveals an explanation bubble on hover or focus.
 * Drop it next to any label, heading, or value the user might not understand.
 *
 * Usage:
 *   <span className="flex items-center gap-1.5">
 *     Spend cap <Tooltip content="The max USDC the agent can spend per action." />
 *   </span>
 */
export function Tooltip({ content, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  const bubble: Record<string, string> = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  }

  const caret: Record<string, string> = {
    top:    'absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-800',
    bottom: 'absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-800',
    right:  'absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-800',
    left:   'absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-zinc-800',
  }

  return (
    <span
      className={`relative inline-flex cursor-help items-center ${className ?? ''}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="button"
      aria-label="More information"
    >
      {/* Info circle icon */}
      <svg
        className="h-3.5 w-3.5 text-forge-text-subtle transition-colors hover:text-forge-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 16v-4" />
        <path strokeLinecap="round" d="M12 8h.01" />
      </svg>

      {/* Bubble */}
      {visible && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-64 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs leading-relaxed text-zinc-100 shadow-2xl ${bubble[side]}`}
        >
          {content}
          <span className={caret[side]} />
        </span>
      )}
    </span>
  )
}

// ─── CONVENIENCE WRAPPER ──────────────────────────────────────────────────────

/**
 * Renders a label + tooltip icon in a row.
 * Replaces repetitive <span className="flex items-center gap-1.5"> patterns.
 *
 * Usage:
 *   <FieldLabel label="Spend cap" tooltip="The max USDC per action." />
 */
export function FieldLabel({
  label,
  tooltip,
  side = 'top',
  className,
}: {
  label: string
  tooltip: string
  side?: 'top' | 'bottom' | 'right' | 'left'
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      {label}
      <Tooltip content={tooltip} side={side} />
    </span>
  )
}
