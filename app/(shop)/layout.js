import AnnouncementBar from '@/components/AnnouncementBar'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CartDrawer from '@/components/CartDrawer'
import SearchOverlay from '@/components/SearchOverlay'
import BackToTop from '@/components/BackToTop'

/**
 * Storefront chrome. Lives in a route group so /admin can opt out entirely —
 * an operations console showing a shopping cart drawer would be nonsense.
 */
export default function ShopLayout({ children }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <BackToTop />
    </>
  )
}
