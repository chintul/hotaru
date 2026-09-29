import dynamic from 'next/dynamic'
import AnnouncementBar from '@/components/AnnouncementBar'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { NAV_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'

/**
 * Nothing below the fold and nothing behind a tap belongs in the first load.
 *
 * The cart drawer, the search overlay and the back-to-top button render
 * nothing at all until the shopper asks for them, and CartHandoff renders
 * nothing ever — it only redeems a parked cart after OAuth. Statically
 * imported, all four were parsed before the first product photograph could
 * paint, on a mid-range Android over Mongolian mobile data.
 */
const CartDrawer = dynamic(() => import('@/components/CartDrawer'))
const SearchOverlay = dynamic(() => import('@/components/SearchOverlay'))
const BackToTop = dynamic(() => import('@/components/BackToTop'))
const CartHandoff = dynamic(() => import('@/components/CartHandoff'))

/**
 * Storefront chrome. Lives in a route group so /admin can opt out entirely —
 * an operations console showing a shopping cart drawer would be nonsense.
 */
export default async function ShopLayout({ children }) {
  // Catalog data with the anon key, cached for 60s by the RSC client. The
  // header used to fetch this from the browser on every page.
  const { data } = await safeQuery(NAV_CATEGORIES)
  const categories = nodes(data?.categoryCollection).map((c) => ({
    href: `/shop?c=${c.slug}`,
    label: firstNode(c.categoryTranslationCollection)?.name ?? c.slug,
  }))

  return (
    <>
      <AnnouncementBar />
      <Header categories={categories} />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <BackToTop />
      {/* Renders nothing. OAuth returns the shopper to any storefront page, so
          the parked cart has to be redeemed from the layout, not one route. */}
      <CartHandoff />
    </>
  )
}
