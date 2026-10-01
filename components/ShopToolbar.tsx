'use client'

import { useId, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconGrid } from './Icons'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const SORTS = [
  ['featured', 'Онцлох'],
  ['price-asc', 'Үнэ: багаас их'],
  ['price-desc', 'Үнэ: ихээс бага'],
  ['newest', 'Шинэ эхэндээ'],
] as const

const COLUMN_OPTIONS = [2, 3, 4] as const

interface ShopToolbarProps {
  total: number
  cols: number
}

export default function ShopToolbar({ total, cols }: ShopToolbarProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const sortId = useId()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-4 border-b border-line pb-4 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      <div className="hidden items-center gap-2 md:flex">
        <span className="text-[12px] uppercase tracking-[0.6px] text-ink-soft">Харах</span>
        {COLUMN_OPTIONS.map((n) => (
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

      <div className="ml-auto flex items-center gap-2">
        <Label
          htmlFor={sortId}
          className="sr-only text-[12px] font-normal uppercase leading-normal tracking-[0.6px] text-ink-soft sm:not-sr-only"
        >
          Эрэмбэлэх
        </Label>
        <Select value={params.get('sort') ?? 'featured'} onValueChange={(value) => set('sort', value)}>
          <SelectTrigger
            id={sortId}
            size="touch"
            className="rounded-none px-3 text-[13px] sm:data-[size=touch]:h-9"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end" className="rounded-none border-line bg-paper">
            {SORTS.map(([v, l]) => (
              <SelectItem key={v} value={v} className="rounded-none text-[13px]">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
