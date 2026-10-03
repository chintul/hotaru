'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { TypedDocumentNode } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PRODUCTS } from '@/lib/queries'
import { copy, formatMnt, nodes } from '@/lib/format'
import type { Connection, Order, Product } from '@/lib/types'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export interface PaletteNavItem {
  href: string
  label: string
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  nav: readonly PaletteNavItem[]
}

interface PaletteResult {
  id: string
  group: string
  label: string
  hint?: string
  href: string
}

interface IlikeFilter {
  ilike: string
}

interface OrderFilter {
  or: ({ orderNumber: IlikeFilter } | { email: IlikeFilter })[]
}

type PaletteProduct = Product & { id: string }

const ordersQuery: TypedDocumentNode<
  { orderCollection: Connection<Order> | null },
  { first: number; filter: OrderFilter | null }
> = ADMIN_ALL_ORDERS

const productsQuery: TypedDocumentNode<
  { productCollection: Connection<PaletteProduct> | null },
  { first: number }
> = ADMIN_PRODUCTS

const ORDER_RESULT_LIMIT = 6
const PRODUCT_RESULT_LIMIT = 6
const CATALOG_WINDOW = 100

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`)

export default function CommandPalette({ open, onClose, nav }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-0 right-0 left-0 w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none rounded-b-xl border-x-0 border-t-0 p-0 pt-[env(safe-area-inset-top)] sm:top-[15vh] sm:right-auto sm:left-[50%] sm:w-[min(560px,92vw)] sm:max-w-none sm:translate-x-[-50%] sm:rounded-xl sm:border sm:pt-0"
      >
        <DialogTitle className="sr-only">Хайх</DialogTitle>
        <Palette onClose={onClose} nav={nav} />
      </DialogContent>
    </Dialog>
  )
}

function Palette({ onClose, nav }: Omit<CommandPaletteProps, 'open'>) {
  const router = useRouter()
  const [q, setQ] = useState('')

  const term = q.trim()

  const orderFilter = useMemo<OrderFilter | null>(() => {
    if (!term) return null
    const like = `%${escapeLike(term)}%`
    return { or: [{ orderNumber: { ilike: like } }, { email: { ilike: like } }] }
  }, [term])

  const { data: orderData } = useQuery(ordersQuery, {
    variables: { first: ORDER_RESULT_LIMIT, filter: orderFilter },
    skip: !term,
  })
  const { data: productData } = useQuery(productsQuery, { variables: { first: CATALOG_WINDOW } })

  const results = useMemo<PaletteResult[]>(() => {
    const lower = term.toLowerCase()
    const pages: PaletteResult[] = nav
      .filter((n) => !lower || n.label.toLowerCase().includes(lower))
      .map((n) => ({ id: `nav-${n.href}`, group: 'Хуудас', label: n.label, href: n.href }))

    if (!lower) return pages

    const orders: PaletteResult[] = nodes(orderData?.orderCollection)
      .map((o) => ({
        id: `o-${o.id}`, group: 'Захиалга',
        label: `${o.orderNumber} · ${o.email}`, hint: formatMnt(o.totalMnt),
        href: `/admin/orders/${o.orderNumber}`,
      }))

    const titleOf = (p: PaletteProduct) => copy(p).title ?? p.slug

    const products: PaletteResult[] = nodes(productData?.productCollection)
      .filter((p) => titleOf(p).toLowerCase().includes(lower) || p.slug.includes(lower))
      .slice(0, PRODUCT_RESULT_LIMIT)
      .map((p) => ({
        id: `p-${p.id}`, group: 'Бараа',
        label: titleOf(p), hint: formatMnt(p.minPriceMnt),
        href: `/admin/products/${p.id}`,
      }))

    return [...pages, ...orders, ...products]
  }, [term, nav, orderData, productData])

  const groups = useMemo(() => {
    const byGroup = new Map<string, PaletteResult[]>()
    for (const r of results) byGroup.set(r.group, [...(byGroup.get(r.group) ?? []), r])
    return [...byGroup.entries()]
  }, [results])

  const go = (item: PaletteResult) => { router.push(item.href); onClose() }

  return (
    <Command shouldFilter={false} className="rounded-none bg-transparent **:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:gap-2.5 **:data-[slot=command-input-wrapper]:px-4">
      <div className="relative">
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Захиалгын дугаар, бараа, хуудас…"
          className="h-12 text-[16px] sm:pr-12 sm:text-[14px]"
        />
        <kbd className="pointer-events-none absolute right-4 hidden sm:block top-1/2 -translate-y-1/2 rounded border border-border px-1.5 text-[11px] text-muted-foreground">esc</kbd>
      </div>
      <CommandList className="max-h-[60dvh] py-1.5 sm:max-h-[50vh]">
        <CommandEmpty className="px-4 py-8 text-center text-[13px] text-muted-foreground">Илэрц алга</CommandEmpty>
        {groups.map(([group, items]) => (
          <CommandGroup key={group} heading={group} className="px-1.5 py-0 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide">
            {items.map((r) => (
              <CommandItem key={r.id} value={r.id} onSelect={() => go(r)} className="min-h-11 gap-3 px-2.5 py-2 sm:min-h-0">
                <span className="min-w-0 flex-1 truncate text-[13px]">{r.label}</span>
                {r.hint && <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{r.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}
