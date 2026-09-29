import dynamic from 'next/dynamic'
import AnnouncementBar from '@/components/AnnouncementBar'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { NAV_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'

const CartDrawer = dynamic(() => import('@/components/CartDrawer'))
const SearchOverlay = dynamic(() => import('@/components/SearchOverlay'))
const BackToTop = dynamic(() => import('@/components/BackToTop'))
const CartHandoff = dynamic(() => import('@/components/CartHandoff'))

export default async function ShopLayout({ children }) {
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
      <CartHandoff />
    </>
  )
}
