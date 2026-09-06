'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconCopy } from '@/components/Icons'

/**
 * A label/value pair whose value can be copied.
 *
 * Copying matters more here than anywhere else in the shop: the customer is
 * about to retype an account number and a transfer reference into a banking
 * app, and one wrong digit means the payment lands unmatched and the order
 * stalls until someone reconciles it by hand.
 */
export default function CopyRow({ label, value, mono = false, accent = false }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!value) return null

  const copy = async () => {
    try {
      // Absent outside a secure context (plain http on a phone on the LAN).
      // Silently doing nothing is better than throwing at the customer.
      await navigator.clipboard?.writeText(String(value))
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      /* no clipboard — the value is on screen and selectable anyway */
    }
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
