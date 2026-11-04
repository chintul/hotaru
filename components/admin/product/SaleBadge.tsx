import { cn } from '@/lib/utils'

export interface SaleBadgeProps {
  pct: number
  labelled?: boolean
  className?: string
}

export default function SaleBadge({ pct, labelled = false, className }: SaleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border border-danger-line bg-danger-soft px-2 py-0.5 text-[12px] font-medium tabular-nums text-danger-ink',
        className,
      )}
    >
      {labelled ? `хямдрал −${pct}%` : `−${pct}%`}
    </span>
  )
}
