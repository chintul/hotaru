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
  // `app/favicon.ico` still emits the legacy .ico through the file convention;
  // every other size is listed here. These lists REPLACE the matching file
  // convention rather than adding to it — an app/apple-icon.png alongside this
  // emits nothing, which is why 180 has to appear in the list itself.
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/android-icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [57, 60, 72, 76, 114, 120, 144, 152, 180].map((size) => ({
      url: `/apple-icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
  },
  other: {
    'msapplication-TileColor': '#fffdfb',
    'msapplication-TileImage': '/ms-icon-144x144.png',
  },
}

// themeColor lives on the viewport export, not metadata (Next 14+). The value
// is --color-paper, so the browser chrome continues the page rather than
// cutting a cold white band above a warm neutral.
export const viewport = {
  themeColor: '#fffdfb',
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
