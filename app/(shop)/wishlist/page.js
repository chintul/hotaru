'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { MY_WISHLIST } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'
import { useSession } from '@/components/useSession'

export default function WishlistPage() {
  const { isAuthenticated, ready } = useSession()
  const { data, loading } = useQuery(MY_WISHLIST, { skip: !isAuthenticated })
  const products = nodes(data?.wishlistItemCollection).map((w) => w.product).filter(Boolean)

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">Хадгалсан</h1>
      <div className="mt-10">
        {!ready || loading ? (
          <p className="label text-ink-faint">Ачааллаж байна…</p>
        ) : !isAuthenticated ? (
          <div className="border border-line bg-paper-warm px-5 py-16 text-center">
            <p className="text-ink-soft">Хадгалсан бараагаа харахын тулд нэвтэрнэ үү.</p>
            <Link href="/login?next=/wishlist" className="label link-underline mt-4 inline-block">Нэвтрэх</Link>
          </div>
        ) : (
          <ProductGrid products={products} emptyMessage="Хадгалсан бараа алга." />
        )}
      </div>
    </div>
  )
}
