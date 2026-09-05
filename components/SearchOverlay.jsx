'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { SEARCH_PRODUCTS } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes } from '@/lib/format'
import { useUI } from './UIProvider'
import ProductImage from './ProductImage'
import { IconClose, IconSearch } from './Icons'

export default function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useUI()
  const [term, setTerm] = useState('')
  const inputRef = useRef(null)
  const [run, { data, loading }] = useLazyQuery(SEARCH_PRODUCTS)

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 60)
    else setTerm('')
  }, [searchOpen])

  // Debounced so a fast typist does not fire a query per keystroke.
  useEffect(() => {
    if (term.trim().length < 2) return
    const id = setTimeout(() => run({ variables: { term: term.trim(), first: 8 } }), 220)
    return () => clearTimeout(id)
  }, [term, run])

  if (!searchOpen) return null
  const results = nodes(data?.searchProducts)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Хайлт">
      <button className="overlay-in absolute inset-0 bg-ink/25" onClick={() => setSearchOpen(false)} aria-label="Хаах" />
      <div className="overlay-in absolute inset-x-0 top-0 max-h-[80vh] overflow-y-auto bg-paper">
        <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
          <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
            <IconSearch className="shrink-0 text-ink-soft" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Бүтээгдэхүүн хайх…"
              className="w-full bg-transparent text-[22px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-faint sm:text-[26px]"
            />
            <button onClick={() => setSearchOpen(false)} className="icon-btn shrink-0" aria-label="Хаах">
              <IconClose />
            </button>
          </div>

          {term.trim().length >= 2 && (
            <div className="py-6">
              {loading && <p className="label text-ink-faint">Хайж байна…</p>}
              {!loading && results.length === 0 && (
                <div className="text-ink-soft">
                  <p>Илэрц олдсонгүй.</p>
                  {/* Honest about a real limitation: Postgres has no Mongolian
                      stemmer, so suffixed word forms will not match. */}
                  <p className="label mt-2 text-ink-faint">
                    Үгийн үндсэн хэлбэрээр хайж үзнэ үү (жишээ нь “ээмэг”).
                  </p>
                </div>
              )}
              <ul className="divide-y divide-line">
                {results.map((p) => {
                  const c = copy(p)
                  const img = firstNode(p.productImageCollection)
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/shop/${p.slug}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-4 py-4"
                      >
                        <span className="relative aspect-square w-16 shrink-0 overflow-hidden bg-paper-warm">
                          <ProductImage filePath={img?.filePath} alt={c.title} seed={p.slug} sizes="56px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.title}</span>
                          <span className="label block text-ink-faint">{c.subtitle}</span>
                        </span>
                        <span className="tabular-nums text-ink-soft">{formatMnt(p.minPriceMnt)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
