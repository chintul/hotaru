'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { MY_WISHLIST } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'
import { useSession } from '@/components/useSession'
import type { Connection, Product, WishlistItem } from '@/lib/types'
import { useT } from '@/lib/i18n'

interface MyWishlistData {
  wishlistItemCollection: Connection<WishlistItem> | null
}

export default function WishlistPage() {
  const { isAuthenticated, ready } = useSession()
  const t = useT()
  const { data, loading } = useQuery<MyWishlistData>(MY_WISHLIST, { skip: !isAuthenticated })
  const products = nodes(data?.wishlistItemCollection).map((w) => w.product).filter((p): p is Product => p != null)

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">{t('Хадгалсан', 'Saved')}</h1>
      <div className="mt-10">
        {!ready || loading ? (
          <p className="label text-ink-faint">{t('Ачааллаж байна…', 'Loading…')}</p>
        ) : !isAuthenticated ? (
          <div className="border border-line bg-paper-warm px-5 py-16 text-center">
            <p className="text-ink-soft">{t('Хадгалсан бараагаа харахын тулд нэвтэрнэ үү.', 'Log in to see your saved items.')}</p>
            <Link href="/login?next=/wishlist" className="label link-underline mt-4 inline-block">{t('Нэвтрэх', 'Log in')}</Link>
          </div>
        ) : (
          <ProductGrid products={products} emptyMessage={t('Хадгалсан бараа алга.', 'No saved items yet.')} />
        )}
      </div>
    </div>
  )
}
