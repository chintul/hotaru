'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { SEARCH_PRODUCTS } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes } from '@/lib/format'
import { useUI } from './UIProvider'
import { useFocusTrap } from './useFocusTrap'
import ProductImage from './ProductImage'
import { IconClose, IconSearch } from './Icons'

/**
 * The panel is a separate component mounted only while the overlay is open, so
 * the term resets by unmounting rather than by an effect that clears it on the
 * way down. The old shape kept one mounted instance forever and reset it with
 * `if (open) focus(); else setTerm('')`, which is setState-in-effect and is
 * what this repo's react-hooks config rejects.
 */
export default function SearchOverlay() {
  const { isOpen, close } = useUI()
  if (!isOpen('search')) return null
  return <SearchPanel onClose={close} />
}

function SearchPanel({ onClose }) {
  const [term, setTerm] = useState('')
  const inputRef = useRef(null)
  const panelRef = useFocusTrap()
  const [run, { data, loading }] = useLazyQuery(SEARCH_PRODUCTS)

  // A DOM call on mount, not a state write: the trap has already put focus on
  // the first control, and this moves it to the field the shopper came for.
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }) }, [])

  // Debounced so a fast typist does not fire a query per keystroke.
  useEffect(() => {
    if (term.trim().length < 2) return undefined
    const id = setTimeout(() => run({ variables: { term: term.trim(), first: 8 } }), 220)
    return () => clearTimeout(id)
  }, [term, run])

  const results = nodes(data?.searchProducts)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Хайлт">
      <button className="overlay-in absolute inset-0 bg-ink/25" onClick={onClose} aria-label="Хаах" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="overlay-in absolute inset-x-0 top-0 max-h-[80vh] overflow-y-auto bg-paper outline-none"
      >
        <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
          <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
            <IconSearch className="shrink-0 text-ink-soft" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Бүтээгдэхүүн хайх…"
              aria-label="Бүтээгдэхүүн хайх"
              className="w-full bg-transparent text-[22px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-faint sm:text-[26px]"
            />
            <button onClick={onClose} className="icon-btn shrink-0" aria-label="Хаах">
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
                        onClick={onClose}
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
