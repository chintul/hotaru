import { Poppins } from 'next/font/google'
import './globals.css'
import { ApolloWrapper } from '@/lib/apollo/ApolloWrapper'
import { UIProvider } from '@/components/UIProvider'

// Only the four weights the design actually uses. 300 and 800 were requested
// and downloaded but referenced nowhere — grep the codebase and the set is
// 400 (body), 500 (font-medium), 600 (font-semibold, .label, .eyebrow) and
// 700 (font-bold, .nav-link, .section-title). Two dead weights across two
// subsets is four font files a shopper waited on for nothing.
const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata = {
  title: { default: 'hotaru', template: '%s · hotaru' },
  description: 'Өдөр тутмын хэрэглээний загварлаг бүтээгдэхүүн.',
}

// Root holds only the document and the providers. Chrome belongs to each
// section: (shop) gets the storefront header/footer, /admin gets the console.
export default function RootLayout({ children }) {
  return (
    <html lang="mn" className={poppins.variable}>
      <body className="font-sans antialiased">
        <ApolloWrapper>
          <UIProvider>{children}</UIProvider>
        </ApolloWrapper>
      </body>
    </html>
  )
}
