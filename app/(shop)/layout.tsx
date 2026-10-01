import dynamic from 'next/dynamic'
import AnnouncementBar from '@/components/AnnouncementBar'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BottomNav from '@/components/BottomNav'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { NAV_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes, stocked } from '@/lib/format'
import type { Category, Connection } from '@/lib/types'

const CartDrawer = dynamic(() => import('@/components/CartDrawer'))
const SearchOverlay = dynamic(() => import('@/components/SearchOverlay'))
const BackToTop = dynamic(() => import('@/components/BackToTop'))
const CartHandoff = dynamic(() => import('@/components/CartHandoff'))

interface NavCategoriesData {
  categoryCollection: Connection<Category> | null
}

export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const { data } = await safeQuery<NavCategoriesData>(NAV_CATEGORIES)
  const categories = stocked(nodes(data?.categoryCollection)).map((c) => ({
    href: `/shop?c=${c.slug}`,
    label: firstNode(c.categoryTranslationCollection)?.name ?? c.slug,
  }))

  return (
    <>
      <AnnouncementBar />
      <Header categories={categories} />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <div aria-hidden className="h-(--bottom-nav-h) lg:hidden" />
      <BottomNav categories={categories} />
      <CartDrawer />
      <SearchOverlay categories={categories} />
      <BackToTop />
      <CartHandoff />
    </>
  )
}
