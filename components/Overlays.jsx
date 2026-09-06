'use client'

import dynamic from 'next/dynamic'
import { useUI } from './UIProvider'

/**
 * The cart drawer and the search overlay, fetched only once someone opens one.
 *
 * Both already returned null until opened, but their code shipped with every
 * page regardless. Splitting them has to happen from a Client Component: a
 * Server Component that dynamically imports a Client Component does not get
 * code splitting, and `ssr: false` is only honoured inside a Client Component
 * (next docs, lazy-loading.md:60,66).
 *
 * Gating on the open flag rather than rendering them unconditionally is what
 * defers the request — otherwise the chunk is fetched during hydration and
 * nothing is saved on the visit that never opens either one.
 */
const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false })
const SearchOverlay = dynamic(() => import('./SearchOverlay'), { ssr: false })

export default function Overlays() {
  const { cartOpen, searchOpen } = useUI()
  return (
    <>
      {cartOpen && <CartDrawer />}
      {searchOpen && <SearchOverlay />}
    </>
  )
}
