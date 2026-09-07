'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconChevronDown } from './Icons'

/**
 * Collection filters. Every control writes to the URL rather than local state,
 * so a filtered view is linkable, back/forward works, and the page stays
 * server-rendered.
 */
export default function ShopFilters({ categories, counts }) {
  const router = useRouter()
  const params = useSearchParams()

  // Same reason as the toolbar: every filter is a navigation, and an
  // unacknowledged checkbox invites a second click that queues a second
  // navigation.
  const [pending, startTransition] = useTransition()

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString())
    if (value === null || value === '' || value === undefined) next.delete(key)
    else next.set(key, value)
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  const activeCat = params.get('c')
  const stock = params.get('stock')
  const [min, setMin] = useState(params.get('min') ?? '')
  const [max, setMax] = useState(params.get('max') ?? '')

  return (
    <aside className={`w-full shrink-0 transition-opacity duration-200 lg:w-[230px] ${pending ? 'opacity-60' : ''}`}>
      <Group title="Ангилал">
        <ul className="space-y-2.5">
          <li>
            <button
              onClick={() => setParam('c', null)}
              className={`text-[13px] ${!activeCat ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              Бүгд
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <button
                onClick={() => setParam('c', c.slug)}
                className={`text-[13px] ${activeCat === c.slug ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Нөөц">
        {[
          ['in', `Бэлэн (${counts.inStock})`],
          ['out', `Дууссан (${counts.outOfStock})`],
        ].map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={stock === value}
              onChange={(e) => setParam('stock', e.target.checked ? value : null)}
              className="h-4 w-4 accent-black"
            />
            {label}
          </label>
        ))}
      </Group>

      <Group title="Үнэ">
        <div className="flex items-center gap-2">
          <input
            value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="0"
            className="w-full border border-line px-2 py-2 text-[13px] focus:border-ink focus:outline-none"
          />
          <span className="text-ink-faint">—</span>
          <input
            value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder="500000"
            className="w-full border border-line px-2 py-2 text-[13px] focus:border-ink focus:outline-none"
          />
        </div>
        <button
          onClick={() => {
            const next = new URLSearchParams(params.toString())
            min ? next.set('min', min) : next.delete('min')
            max ? next.set('max', max) : next.delete('max')
            startTransition(() => router.push(`/shop?${next.toString()}`))
          }}
          className="btn-solid mt-3 w-full py-2.5"
        >
          Шүүх
        </button>
      </Group>
    </aside>
  )
}

function Group({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-line py-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <span className="nav-link text-[13px]">{title}</span>
        <IconChevronDown className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  )
}
