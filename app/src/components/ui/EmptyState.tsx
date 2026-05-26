import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-forge-border bg-forge-surface p-12 text-center">
      <h3 className="text-base font-semibold text-forge-text">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-forge-text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
