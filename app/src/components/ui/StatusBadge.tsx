import { cn } from '@/lib/utils'

type StatusVariant = 'active' | 'running' | 'paused' | 'error'

const styles: Record<StatusVariant, string> = {
  active: 'bg-forge-success/10 text-forge-success border-forge-success/30',
  running: 'bg-forge-orange/10 text-forge-orange border-forge-orange/30 animate-pulse',
  paused: 'bg-forge-warning/10 text-forge-warning border-forge-warning/30',
  error: 'bg-forge-danger/10 text-forge-danger border-forge-danger/30',
}

const labels: Record<StatusVariant, string> = {
  active: 'Active',
  running: 'Running',
  paused: 'Paused',
  error: 'Error',
}

export function StatusBadge({
  variant,
  label,
  className,
}: {
  variant: StatusVariant
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
    >
      {label ?? labels[variant]}
    </span>
  )
}
