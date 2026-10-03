'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from './ui'

export const TONE_FILL: Record<Tone, string> = {
  green: 'bg-success', amber: 'bg-warn', red: 'bg-danger',
  blue: 'bg-info', grey: 'bg-a-muted', purple: 'bg-note',
}

const count = new Intl.NumberFormat('mn-MN')
export const formatCount = (n: number): string => count.format(n)

export interface StatTileProps {
  label: string
  value: ReactNode
  hint?: ReactNode
}

export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-3 py-3 shadow-xs sm:px-4">
      <p className="truncate text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[18px] font-semibold leading-tight tracking-[-.01em] text-foreground [overflow-wrap:anywhere] sm:text-[22px]">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export interface MeterProps {
  value: number
  max: number
  label: string
}

export function Meter({ value, max, label }: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className="block h-1.5 w-full overflow-hidden rounded-full bg-warn-soft"
    >
      <span className="block h-full rounded-full bg-warn" style={{ width: `${pct}%` }} />
    </span>
  )
}

export interface BarListItem {
  key: string
  label: ReactNode
  value: number
  display: ReactNode
  tone: Tone
}

export function BarList({ items }: { items: readonly BarListItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-2 text-[13px] sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-foreground">
            <span className={cn('h-[7px] w-[7px] shrink-0 rounded-[2px]', TONE_FILL[i.tone])} />
            <span className="truncate">{i.label}</span>
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn('h-3 shrink-0 rounded-r-[4px]', TONE_FILL[i.tone])}
              style={{ width: `calc((100% - 3.5rem) * ${i.value / max})`, minWidth: i.value > 0 ? 2 : 0 }}
            />
            <span className="shrink-0 tabular-nums text-muted-foreground">{i.display}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export interface ColumnSeries {
  key: string
  title: string
  values: readonly number[]
  format: (n: number) => string
}

export interface ColumnChartsProps {
  labels: readonly string[]
  series: readonly ColumnSeries[]
}

export function ColumnCharts({ labels, series }: ColumnChartsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const last = labels.length - 1
  const focus = hover ?? last

  return (
    <div className="space-y-5" onMouseLeave={() => setHover(null)}>
      {series.map((s) => {
        const max = Math.max(0, ...s.values)
        return (
          <figure key={s.key}>
            <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
              <span className="font-medium text-foreground">{s.title}</span>
              <span className="tabular-nums text-muted-foreground">
                {labels[focus]}: <span className="font-medium text-foreground">{s.format(s.values[focus] ?? 0)}</span>
              </span>
            </figcaption>
            <div className="relative mt-4">
              <span className="pointer-events-none absolute -top-4 right-0 text-[11px] leading-4 tabular-nums text-muted-foreground">
                {s.format(max)}
              </span>
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" />
              <div className="flex h-24 items-end gap-px border-b border-border sm:gap-[2px]" role="group" aria-label={s.title}>
                {s.values.map((v, i) => (
                  <button
                    key={labels[i]}
                    type="button"
                    tabIndex={-1}
                    aria-label={`${labels[i]}: ${s.format(v)}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onClick={() => setHover(i)}
                    className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                  >
                    <span
                      className={cn(
                        'block w-full max-w-6 rounded-t-[4px] bg-a-focus transition-opacity',
                        hover != null && hover !== i && 'opacity-40',
                      )}
                      style={{ height: max > 0 ? `${(v / max) * 100}%` : 0, minHeight: v > 0 ? 2 : 0 }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </figure>
        )
      })}
      <div className="flex justify-between gap-3 text-[11px] tabular-nums text-muted-foreground">
        <span>{labels[0]}</span>
        {last > 0 && <span>{labels[last]}</span>}
      </div>
    </div>
  )
}
