import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-organiser-muted">
        <Icon aria-hidden="true" className="size-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-organiser-muted">{hint}</p> : null}
    </div>
  )
}
