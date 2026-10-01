'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { IconChevronDown, IconClose } from './Icons'
import { useUI } from './UIProvider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'

export interface ShopFilterCategory {
  slug: string
  label: string
}

interface ShopFiltersProps {
  categories: ShopFilterCategory[]
  counts: { inStock: number; outOfStock: number }
}

type StockFilter = 'in' | 'out'

export default function ShopFilters({ categories, counts }: ShopFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()

  const [pending, startTransition] = useTransition()
  const activeCat = params.get('c')
  const stock = params.get('stock')
  const { isOpen, open: openOverlay, close: closeOverlay } = useUI()
  const sheetOpen = isOpen('filters')
  const idBase = useId()
  const [min, setMin] = useState(params.get('min') ?? '')
  const [max, setMax] = useState(params.get('max') ?? '')

  const navigateWith = (next: URLSearchParams) => {
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    navigateWith(next)
  }

  const applyPriceRange = () => {
    const next = new URLSearchParams(params.toString())
    if (min) next.set('min', min)
    else next.delete('min')
    if (max) next.set('max', max)
    else next.delete('max')
    navigateWith(next)
  }

  const activeCount = [activeCat, stock, params.get('min'), params.get('max')].filter(Boolean).length

  const stockOptions: [StockFilter, string][] = [
    ['in', `Бэлэн (${counts.inStock})`],
    ['out', `Дууссан (${counts.outOfStock})`],
  ]

  const renderBody = (scope: string) => (
    <>
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
        {stockOptions.map(([value, label]) => {
          const id = `${idBase}-${scope}-stock-${value}`
          return (
            <div key={value} className="flex items-center gap-2.5 py-1.5">
              <Checkbox
                id={id}
                checked={stock === value}
                onCheckedChange={(checked) => setParam('stock', checked === true ? value : null)}
              />
              <Label htmlFor={id} className="cursor-pointer text-[13px] font-normal text-ink-soft">
                {label}
              </Label>
            </div>
          )
        })}
      </Group>

      <Group title="Үнэ">
        <div className="flex items-center gap-2">
          <Input
            value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="0"
            aria-label="Доод үнэ"
            className="h-10 rounded-none px-2 text-[13px] md:text-[13px]"
          />
          <span className="text-ink-faint">—</span>
          <Input
            value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder="500000"
            aria-label="Дээд үнэ"
            className="h-10 rounded-none px-2 text-[13px] md:text-[13px]"
          />
        </div>
        <Button variant="solid" size="touch" onClick={applyPriceRange} className="mt-3 w-full">
          Шүүх
        </Button>
      </Group>
    </>
  )

  return (
    <>
      <div className="lg:hidden">
        <button
          onClick={() => openOverlay('filters')}
          className={`flex w-full items-center justify-between border border-line px-4 py-3 transition-opacity ${pending ? 'opacity-60' : ''}`}
        >
          <span className="nav-link text-[13px]">Шүүх</span>
          {activeCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink-strong px-1.5 text-[11px] font-semibold text-paper">
              {activeCount}
            </span>
          ) : (
            <IconChevronDown />
          )}
        </button>
      </div>

      <aside
        className={`hidden w-full shrink-0 transition-opacity duration-200 lg:block lg:w-[230px] ${
          pending ? 'opacity-60' : ''
        }`}
      >
        {renderBody('aside')}
      </aside>

      <Sheet open={sheetOpen} onOpenChange={(next) => { if (!next) closeOverlay() }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          overlayProps={{ className: 'lg:hidden' }}
          className="gap-0 lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <SheetTitle className="nav-link text-[14px] font-bold text-ink-strong">Шүүх</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon-touch" className="-mr-2" aria-label="Хаах">
                <IconClose />
              </Button>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">{renderBody('sheet')}</div>
          <div className="border-t border-line px-5 py-4">
            <SheetClose asChild>
              <Button variant="solid" size="cta" className="w-full">
                Үр дүнг харах
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
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
