'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { SEARCH_PRODUCTS } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes } from '@/lib/format'
import type { Connection, Product } from '@/lib/types'
import { useUI } from './UIProvider'
import ProductImage from './ProductImage'
import { IconClose, IconSearch } from './Icons'
import type { NavLink } from './Header'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface SearchProductsData {
  searchProducts: Connection<Product> | null
}

interface SearchProductsVars {
  term: string
  first?: number
}

interface SearchOverlayProps {
  categories?: NavLink[]
}

const MIN_TERM_LENGTH = 2
const DEBOUNCE_MS = 220
const RESULT_LIMIT = 12
const SKELETON_TILES = 4

export default function SearchOverlay({ categories = [] }: SearchOverlayProps) {
  const { isOpen, close, closeForNavigation } = useUI()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={isOpen('search')} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent
        placement="top-on-phone"
        showCloseButton={false}
        aria-describedby={undefined}
        overlayProps={{ className: 'bg-foreground/20 backdrop-blur-[2px]' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus({ preventScroll: true })
        }}
        className="flex flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Хайлт</DialogTitle>
        <SearchPanel inputRef={inputRef} categories={categories} onNavigate={closeForNavigation} />
      </DialogContent>
    </Dialog>
  )
}

interface SearchPanelProps {
  inputRef: RefObject<HTMLInputElement | null>
  categories: NavLink[]
  onNavigate: () => void
}

function SearchPanel({ inputRef, categories, onNavigate }: SearchPanelProps) {
  const [term, setTerm] = useState('')
  const [run, { data, loading }] = useLazyQuery<SearchProductsData, SearchProductsVars>(SEARCH_PRODUCTS)

  useEffect(() => {
    const trimmed = term.trim()
    if (trimmed.length < MIN_TERM_LENGTH) return undefined
    const id = setTimeout(() => void run({ variables: { term: trimmed, first: RESULT_LIMIT } }), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term, run])

  const searchable = term.trim().length >= MIN_TERM_LENGTH
  const results = nodes(data?.searchProducts)
  const firstLoad = loading && !data

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3 lg:px-5">
        <label className="relative flex h-10 flex-1 items-center rounded-full bg-shade px-3.5">
          <IconSearch width="17" height="17" aria-hidden="true" className="shrink-0 text-ink-soft" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Юу хайж байна вэ?"
            aria-label="Бүтээгдэхүүн хайх"
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-ink-strong sm:text-[14px] outline-none placeholder:text-ink-faint focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {term && (
            <button
              type="button"
              onClick={() => { setTerm(''); inputRef.current?.focus() }}
              aria-label="Арилгах"
              className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-line-soft hover:text-ink"
            >
              <IconClose width="14" height="14" />
            </button>
          )}
        </label>
        <DialogClose className="min-h-10 shrink-0 px-1.5 text-[13px] text-ink-soft hover:text-ink lg:hidden">
          Болих
        </DialogClose>
        <DialogClose
          aria-label="Хаах"
          className="hidden h-7 shrink-0 items-center rounded-md border border-line px-2 text-[11px] font-medium text-ink-faint hover:text-ink lg:inline-flex"
        >
          Esc
        </DialogClose>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 lg:px-5">
        {!searchable && <Suggestions categories={categories} onNavigate={onNavigate} />}

        {searchable && (
          <div className="mt-4" aria-live="polite">
            {firstLoad ? (
              <ResultGrid>
                {Array.from({ length: SKELETON_TILES }, (_, i) => (
                  <li key={i}>
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="mt-2 h-3 w-3/4 rounded-full" />
                    <Skeleton className="mt-1.5 h-3 w-1/3 rounded-full" />
                  </li>
                ))}
              </ResultGrid>
            ) : results.length === 0 ? (
              <div className="rounded-2xl bg-shade px-4 py-6 text-center">
                <p className="text-[14px] font-semibold text-ink-strong">“{term.trim()}” олдсонгүй</p>
                <p className="mx-auto mt-1 max-w-xs text-[12px] text-ink-soft">
                  Үгийн үндсэн хэлбэрээр хайж үзээрэй, жишээ нь “ээмэг”, “цүнх”.
                </p>
                <Suggestions categories={categories} onNavigate={onNavigate} compact />
              </div>
            ) : (
              <>
                <p className="mb-2.5 text-[11px] text-ink-faint">{results.length} бүтээгдэхүүн</p>
                <ResultGrid>
                  {results.map((p) => {
                    const c = copy(p)
                    const img = firstNode(p.productImageCollection)
                    return (
                      <li key={p.id ?? p.slug}>
                        <Link href={`/shop/${p.slug}`} onClick={onNavigate} className="group block">
                          <span className="relative block aspect-square overflow-hidden rounded-xl bg-shade">
                            <ProductImage
                              filePath={img?.filePath}
                              alt={c.title}
                              seed={p.slug}
                              sizes="(min-width: 1024px) 140px, (min-width: 640px) 22vw, 30vw"
                            />
                          </span>
                          <span className="mt-1.5 line-clamp-2 block text-[12px] leading-snug text-ink group-hover:text-ink-strong">
                            {c.title}
                          </span>
                          <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-ink-strong">
                            {formatMnt(p.minPriceMnt)}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ResultGrid>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 sm:gap-x-3">{children}</ul>
}

interface SuggestionsProps {
  categories: NavLink[]
  onNavigate: () => void
  compact?: boolean
}

function Suggestions({ categories, onNavigate, compact = false }: SuggestionsProps) {
  const links: NavLink[] = [{ href: '/shop', label: 'Бүх бүтээгдэхүүн' }, ...categories]
  return (
    <div className="mt-4">
      {!compact && <p className="mb-2 text-[11px] font-medium text-ink-faint">Ангилалаар үзэх</p>}
      <ul className={`flex flex-wrap gap-1.5 ${compact ? 'justify-center' : ''}`}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              className="inline-flex min-h-8 items-center rounded-full border border-line bg-paper px-3 text-[12px] text-ink transition-colors hover:border-ink-soft hover:text-ink-strong"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
