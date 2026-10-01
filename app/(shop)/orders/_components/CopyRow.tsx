'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconCopy } from '@/components/Icons'

interface CopyRowProps {
  label: string
  value: string | number | null | undefined
  mono?: boolean
  accent?: boolean
}

export default function CopyRow({ label, value, mono = false, accent = false }: CopyRowProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!value) return null

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(String(value))
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
        accent ? 'bg-cream' : 'bg-paper-warm'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold uppercase tracking-[.6px] ${accent ? 'text-cream-ink' : 'text-ink-faint'}`}>
          {label}
        </p>
        <p className={`mt-0.5 break-words text-[15px] ${mono ? 'tabular-nums tracking-[.3px]' : ''} font-medium`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${label} хуулах`}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${
          copied ? 'border-mint-ink bg-mint text-mint-ink' : 'border-line bg-paper text-ink-soft hover:border-ink hover:text-ink'
        }`}
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
    </div>
  )
}
