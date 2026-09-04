import { Poppins } from 'next/font/google'
import './globals.css'
import { ApolloWrapper } from '@/lib/apollo/ApolloWrapper'
import { UIProvider } from '@/components/UIProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CartDrawer from '@/components/CartDrawer'
import SearchOverlay from '@/components/SearchOverlay'

// The reference storefront runs Poppins; it is OFL-licensed, so self-hosting
// through next/font is free and removes the render-blocking Google request.
const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata = {
  title: { default: 'hotaru', template: '%s · hotaru' },
  description: 'Гар аргаар хийсэн, өдөр тутам зүүх энгийн гоёл чимэглэл.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className={poppins.variable}>
      <body className="font-sans antialiased">
        <ApolloWrapper>
          <UIProvider>
            <Header />
            <main className="min-h-[70vh]">{children}</main>
            <Footer />
            <CartDrawer />
            <SearchOverlay />
          </UIProvider>
        </ApolloWrapper>
      </body>
    </html>
  )
}
