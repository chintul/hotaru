'use client'

import { useId, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconGrid } from './Icons'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'

const SORTS = [
  ['featured', 'Онцлох', 'Featured'],
  ['price-asc', 'Үнэ: багаас их', 'Price: low to high'],
  ['price-desc', 'Үнэ: ихээс бага', 'Price: high to low'],
  ['newest', 'Шинэ эхэндээ', 'Newest first'],
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
  const t = useT()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-4 border-b border-line pb-4 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      <div className="hidden items-center gap-2 md:flex">
        <span className="text-[12px] text-ink-soft">{t('Харах', 'View')}</span>
        {COLUMN_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => set('cols', String(n))}
            aria-label={t(`${n} багана`, `${n} columns`)}
            className={`grid h-8 w-8 place-items-center border ${
              cols === n ? 'border-ink text-ink' : 'border-line text-ink-faint hover:text-ink'
            }`}
          >
            <IconGrid cols={n} />
          </button>
        ))}
      </div>

      <span className="text-[13px] text-ink-soft">{t(`${total} бүтээгдэхүүн`, `${total} ${total === 1 ? 'product' : 'products'}`)}</span>

      <div className="ml-auto flex items-center gap-2">
        <Label
          htmlFor={sortId}
          className="sr-only text-[12px] font-normal leading-normal text-ink-soft sm:not-sr-only"
        >
          {t('Эрэмбэлэх', 'Sort by')}
        </Label>
        <Select value={params.get('sort') ?? 'featured'} onValueChange={(value) => set('sort', value)}>
          <SelectTrigger
            id={sortId}
            size="touch"
            className="rounded-full px-3 text-[13px] sm:data-[size=touch]:h-9"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end" className="rounded-xl border-line bg-paper">
            {SORTS.map(([v, mn, en]) => (
              <SelectItem key={v} value={v} className="rounded-lg text-[13px]">{t(mn, en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
