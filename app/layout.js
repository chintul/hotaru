import { Poppins } from 'next/font/google'
import './globals.css'
import { ApolloWrapper } from '@/lib/apollo/ApolloWrapper'
import { UIProvider } from '@/components/UIProvider'

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800'],
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
