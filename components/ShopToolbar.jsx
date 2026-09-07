'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconGrid } from './Icons'

const SORTS = [
  ['featured', 'Онцлох'],
  ['price-asc', 'Үнэ: багаас их'],
  ['price-desc', 'Үнэ: ихээс бага'],
  ['newest', 'Шинэ эхэндээ'],
]

export default function ShopToolbar({ total, cols }) {
  const router = useRouter()
  const params = useSearchParams()
  // Sorting is a server round trip. Without a pending state the control looks
  // ignored until the new page streams in, which on a slow connection is long
  // enough to click again.
  const [pending, startTransition] = useTransition()

  const set = (key, value) => {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-4 border-b border-line pb-4 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] uppercase tracking-[0.6px] text-ink-soft">Харах</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => set('cols', String(n))}
            aria-label={`${n} багана`}
            className={`grid h-8 w-8 place-items-center border ${
              cols === n ? 'border-ink text-ink' : 'border-line text-ink-faint hover:text-ink'
            }`}
          >
            <IconGrid cols={n} />
          </button>
        ))}
      </div>

      <span className="text-[13px] text-ink-soft">{total} бүтээгдэхүүн</span>

      <label className="ml-auto flex items-center gap-2">
        <span className="text-[12px] uppercase tracking-[0.6px] text-ink-soft">Эрэмбэлэх</span>
        <select
          value={params.get('sort') ?? 'featured'}
          onChange={(e) => set('sort', e.target.value)}
          className="border border-line px-3 py-2 text-[13px] focus:border-ink focus:outline-none"
        >
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    </div>
  )
}
