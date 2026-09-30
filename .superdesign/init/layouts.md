# Layouts — shared chrome

Route groups own their chrome: `app/(shop)/` gets the storefront header/footer,
`app/admin/` opts out entirely and uses `AdminShell` behind `AdminGate`.

## RootLayout
- Source: `app/layout.js`
- Document, Poppins, theme boot script, Apollo + Theme + UI providers. No chrome.

```jsx
import { Poppins } from "next/font/google";
import "./globals.css";
import { ApolloWrapper } from "@/lib/apollo/ApolloWrapper";
import { UIProvider } from "@/components/UIProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
// From lib/, not from ThemeProvider: that file is 'use client', and a constant
// imported across that boundary arrives here as undefined. See lib/theme.js.
import { THEME_KEY } from "@/lib/theme";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata = {
  title: { default: "hotaru", template: "%s · hotaru" },
  description: "Өдөр тутмын хэрэглээний загварлаг бүтээгдэхүүн.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [57, 60, 72, 76, 114, 120, 144, 152, 180].map((size) => ({
      url: `/apple-icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  },
  other: {
    "msapplication-TileColor": "#fbfcfe",
    "msapplication-TileImage": "/ms-icon-144x144.png",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#13191f" },
  ],
};

// An undefined key interpolates to `localStorage.getItem(undefined)`: no throw,
// no match, every load painting the OS theme before hydration corrects it.
if (typeof THEME_KEY !== "string") {
  throw new Error("THEME_KEY must be a string on the server");
}

const THEME_BOOT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});
var d=p==='dark'||((!p||p==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');
}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="font-sans antialiased">
        <ApolloWrapper>
          <ThemeProvider>
            <UIProvider>{children}</UIProvider>
          </ThemeProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
```

## ShopLayout
- Source: `app/(shop)/layout.js`
- Storefront chrome: announcement bar, header, footer, and the lazy overlays.

```jsx
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
```

## Header
- Source: `components/Header.jsx`
- Sticky header: hamburger, wordmark, desktop nav + shop dropdown, icon cluster, mobile panel.

```jsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { useSession } from './useSession'
import {
  IconBag,
  IconChevronDown,
  IconClose,
  IconHeart,
  IconMenu,
  IconSearch,
  IconUser,
} from './Icons'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'

/**
 * Logo left, centred uppercase nav, icon cluster right.
 *
 * `categories` is a prop from the (shop) layout, read on the server with the
 * anon key — the header must not cost a round trip to Tokyo to render.
 *
 * The desktop bar and the phone panel are built from the same groups below, so
 * they cannot drift apart.
 */

/** Non-catalogue pages worth a top-level slot. */
const INFO_LINKS = [
  { href: '/about', label: 'Бидний тухай' },
  { href: '/contact', label: 'Холбоо барих' },
]

/** Phone-only: a phone has no footer above the fold. */
const HELP_LINK = { href: '/faq', label: 'Түгээмэл асуулт' }

export default function Header({ categories = [] }) {
  const { isOpen, open, close, closeForNavigation, toggle } = useUI()
  const navOpen = isOpen('nav')
  const { count } = useCart()
  const { isAuthenticated } = useSession()
  const pathname = usePathname()

  // All of them; the dropdown scrolls if the shop grows.
  const shopLinks = [{ href: '/shop', label: 'Бүх бүтээгдэхүүн' }, ...categories]

  const accountLinks = [
    isAuthenticated
      ? { href: '/account', label: 'Профайл' }
      : { href: '/login', label: 'Нэвтрэх' },
    { href: '/wishlist', label: 'Хадгалсан' },
    { href: '/orders', label: 'Захиалга хянах' },
  ]

  /* Path only. Marking the active category needs `?c=`, and useSearchParams
     would opt every prerendered page out of its static render. */
  const isActive = (href) => {
    const path = href.split('?')[0]
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  const shopActive = pathname.startsWith('/shop')

  // Only for a link that lands on the path we are already on: nothing else
  // would close the panel, because the path never changes.
  const closeIfSamePath = (href) =>
    (href.split('?')[0] === pathname ? closeForNavigation : undefined)

  const [shopOpen, setShopOpen] = useState(false)
  const shopRef = useRef(null)

  /* Navigating closes the dropdown. Render-phase reset, as UIProvider does for
     the overlays — an effect would paint the stale frame first. */
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (shopOpen) setShopOpen(false)
  }

  // Escape, and any click outside — including on search or the cart button.
  useEffect(() => {
    if (!shopOpen) return undefined
    const onPointerDown = (e) => {
      if (!shopRef.current?.contains(e.target)) setShopOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setShopOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [shopOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-2 px-3 sm:gap-4 sm:px-5 lg:px-8">
        <button
          onClick={() => toggle('nav')}
          className="icon-btn -ml-2 shrink-0 lg:hidden"
          aria-label="Цэс"
          aria-expanded={navOpen}
          aria-controls="mobile-nav"
        >
          {navOpen ? <IconClose /> : <IconMenu />}
        </button>

        {/* Shrinks rather than pushing the cart off the bar on a 320px phone.
            The flex band gives the 20px wordmark a 44px target. */}
        <Link href="/" className="flex min-h-11 min-w-0 shrink items-center">
          <Logo className="h-5 w-auto max-w-full object-contain object-left sm:h-7 lg:h-8" />
        </Link>

        <nav aria-label="Үндсэн цэс" className="mx-auto hidden items-center gap-8 lg:flex">
          <TopLink href="/" label="Нүүр" active={isActive('/')} />

          <div ref={shopRef} className="relative">
            <button
              type="button"
              onClick={() => setShopOpen((v) => !v)}
              aria-expanded={shopOpen}
              aria-controls="shop-menu"
              className={`nav-link relative flex items-center gap-1 hover:opacity-60 ${UNDERLINE(shopActive)}`}
            >
              Дэлгүүр
              <IconChevronDown
                width="16"
                height="16"
                aria-hidden="true"
                className={`transition-transform duration-200 ${shopOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {shopOpen && (
              <div
                id="shop-menu"
                className="overlay-in absolute left-1/2 top-full z-50 mt-4 max-h-[70vh] w-60 -translate-x-1/2 overflow-y-auto rounded-xl border border-line bg-paper-raise p-2 shadow-[var(--t-lift)]"
              >
                {shopLinks.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setShopOpen(false)}
                    className="block rounded-lg px-3 py-2 text-[14px] text-ink transition-colors hover:bg-line-soft hover:text-ink-strong"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {INFO_LINKS.map((item) => (
            <TopLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {/* Before search, so the cart keeps the rightmost thumb position. */}
          <ThemeToggle />
          <button onClick={() => open('search')} className="icon-btn" aria-label="Хайх">
            <IconSearch />
          </button>
          {/* Six 40px targets plus the wordmark do not fit a 360px phone, and
              the one that fell off the end was the cart. These two are in the
              menu panel's Миний group, so the phone bar keeps search and cart. */}
          <Link
            href={isAuthenticated ? '/account' : '/login'}
            className="icon-btn hidden sm:grid"
            aria-label="Профайл"
          >
            <IconUser />
          </Link>
          <Link href="/wishlist" className="icon-btn hidden sm:grid" aria-label="Хадгалсан">
            <IconHeart />
          </Link>
          <button onClick={() => open('cart')} className="icon-btn relative" aria-label="Сагс">
            <IconBag />
            {count > 0 && (
              // Keyed on the count so the node remounts and replays the pop.
              <span
                key={count}
                className="count-pop absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary-strong px-1 text-[10px] font-bold text-on-primary"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {navOpen && (
        // The body is locked while this is open, so the panel scrolls itself.
        <nav
          id="mobile-nav"
          aria-label="Гар утасны цэс"
          className="overlay-in max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-line bg-paper px-5 pb-6 lg:hidden"
        >
          <MobileLink href="/" label="Нүүр" active={isActive('/')} onSamePath={closeIfSamePath('/')} />
          <MobileGroup title="Дэлгүүр" links={shopLinks} isActive={() => false} closeIfSamePath={closeIfSamePath} />
          <MobileGroup title="Миний" links={accountLinks} isActive={isActive} closeIfSamePath={closeIfSamePath} />
          <MobileGroup
            title="Мэдээлэл"
            links={[...INFO_LINKS, HELP_LINK]}
            isActive={isActive}
            closeIfSamePath={closeIfSamePath}
          />
        </nav>
      )}
    </header>
  )
}

/* A hairline, not a colour swap: .nav-link is pinned to ink-strong, so marking
   the active item by colour means dimming the rest below AA. */
const UNDERLINE = (active) =>
  active
    ? 'after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-ink-strong'
    : ''

function TopLink({ href, label, active }) {
  return (
    <Link href={href} className={`nav-link relative hover:opacity-60 ${UNDERLINE(active)}`}>
      {label}
    </Link>
  )
}

/* Closing on click cancels the navigation (see UIProvider), so the panel is
   left to UIProvider, which closes it when the path changes. `onSamePath` is
   the exception: ?c=bags from /shop never changes the path, so nothing else
   would close it. */
function MobileLink({ href, label, active, onSamePath }) {
  return (
    <Link
      href={href}
      onClick={onSamePath}
      className={`block py-2.5 text-[15px] ${active ? 'font-semibold text-ink-strong' : 'text-ink'}`}
    >
      {label}
    </Link>
  )
}

function MobileGroup({ title, links, isActive, closeIfSamePath }) {
  return (
    <div className="mt-2 border-t border-line pt-3">
      <p className="label text-ink-faint">{title}</p>
      <div className="mt-1">
        {links.map((item) => (
          <MobileLink
            key={item.href + item.label}
            href={item.href}
            label={item.label}
            active={isActive(item.href)}
            onSamePath={closeIfSamePath(item.href)}
          />
        ))}
      </div>
    </div>
  )
}
```

## Footer
- Source: `components/Footer.jsx`
- Dark footer band: link columns, store contact, socials, newsletter.

```jsx
import Link from "next/link";
import NewsletterForm from "./NewsletterForm";
import { paymentCopy } from "@/lib/payment-copy";
import { storeContact } from "@/lib/store-contact";
import {
  IconFacebook,
  IconInstagram,
  IconMail,
  IconPhone,
  IconPin,
} from "./Icons";

const COLUMNS = [
  {
    title: "Дэлгүүр",
    links: [
      { href: "/shop", label: "Бүх бүтээгдэхүүн" },
    ],
  },
  {
    title: "Мэдээлэл",
    links: [
      { href: "/about", label: "Бидний тухай" },
      { href: "/contact", label: "Холбоо барих" },
    ],
  },
  {
    title: "Үйлчилгээ",
    links: [
      { href: "/shipping", label: "Хүргэлтийн нөхцөл" },
      { href: "/returns", label: "Буцаалт, солилт" },
      { href: "/faq", label: "Түгээмэл асуулт" },
      { href: "/orders", label: "Захиалга хянах" },
    ],
  },
];

export default async function Footer() {
  // Two independent reads of the same singleton row; they run together rather
  // than one after the other so the footer costs one round trip, not two.
  const [pay, contact] = await Promise.all([paymentCopy(), storeContact()]);

  return (
    // --color-footer is a dark band in BOTH themes, so the white-alpha scale
    // below is correct in both and is deliberately not tokenised.
    <footer className="bg-footer text-white">
      <div className="mx-auto grid max-w-350 gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-6 lg:px-8">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="nav-link text-white">{col.title}</h3>
            {/* A 13px link is a 19px target. On a phone each row is a full
                44px band; the cursor layout keeps its tighter rhythm. */}
            <ul className="mt-2 sm:mt-5 sm:space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="flex min-h-11 items-center text-[13px] text-white/70 transition-colors hover:text-white sm:min-h-0"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Nothing here is hardcoded: every line is dropped when the owner has
            not filled that field in at /admin, so the footer never advertises a
            placeholder address or a dead social link. */}
        {!contact.isEmpty && (
          <div>
            <h3 className="nav-link text-white">Холбоо барих</h3>
            <ul className="mt-5 space-y-3">
              {contact.phone && (
                <li>
                  <a
                    href={contact.phoneHref}
                    className="flex min-h-11 items-start gap-2.5 py-1 text-[13px] text-white/70 transition-colors hover:text-white sm:min-h-0 sm:py-0"
                  >
                    <IconPhone
                      className="mt-px shrink-0 opacity-70"
                      width="16"
                      height="16"
                    />
                    <span className="tabular-nums">{contact.phone}</span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex min-h-11 items-start gap-2.5 py-1 text-[13px] text-white/70 transition-colors hover:text-white sm:min-h-0 sm:py-0"
                  >
                    <IconMail
                      className="mt-px shrink-0 opacity-70"
                      width="16"
                      height="16"
                    />
                    <span className="break-all">{contact.email}</span>
                  </a>
                </li>
              )}
              {contact.address && (
                <li className="flex items-start gap-2.5 text-[13px] text-white/70">
                  <IconPin
                    className="mt-px shrink-0 opacity-70"
                    width="16"
                    height="16"
                  />
                  <span>{contact.address}</span>
                </li>
              )}
            </ul>

            {contact.socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {contact.socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={s.label}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white hover:text-white sm:h-9 sm:w-9"
                  >
                    {s.key === "facebook" ? (
                      <IconFacebook />
                    ) : (
                      <IconInstagram />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lg:col-span-2">
          <h3 className="nav-link text-white">Мэдээлэл авах</h3>
          <p className="mt-5 text-[13px] text-white/70">
            Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээллийг хамгийн түрүүнд аваарай.
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 lg:px-8">
          <p className="text-[12px] text-white/50">
            © {new Date().getFullYear()} hotaru
          </p>
          <p className="text-[12px] text-white/50">{pay.short} · Улаанбаатар</p>
        </div>
      </div>
    </footer>
  );
}
```

## AnnouncementBar
- Source: `components/AnnouncementBar.jsx`
- Looping marquee of delivery/promo lines above the header.

```jsx
const MESSAGES = [
  '🚚 Улаанбаатар доторх хүргэлт 5,000₮',
  '✨ Шинэ цуглуулга: 2026 Намар',
  '🎁 100,000₮-с дээш захиалгад 10% хөнгөлөлт',
  '📦 Ажлын 1–2 хоногт хүргэнэ',
]

/**
 * Scrolling announcement strip above the header.
 * The message list is rendered twice so the -50% translate loops seamlessly;
 * hovering pauses it, which is the only way to actually read a moving line.
 */
export default function AnnouncementBar() {
  const track = [...MESSAGES, ...MESSAGES]
  return (
    <div className="overflow-hidden border-b border-line bg-shade py-2.5">
      <div className="marquee-track">
        {track.map((m, i) => (
          <span key={i} className="whitespace-nowrap px-8 text-[13px] text-ink">
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
```

## CartDrawer
- Source: `components/CartDrawer.jsx`
- Right-hand cart drawer overlay.

```jsx
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { useFocusTrap } from './useFocusTrap'
import { copy, firstNode, formatMnt, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'
import { IconClose, IconMinus, IconPlus } from './Icons'

export default function CartDrawer() {
  const { isOpen, close: closeOverlay, addPending, cartStale, setCartStale } = useUI()
  const cartOpen = isOpen('cart')
  const { items, subtotal, count, loading, setQuantity, clear, refetch } = useCart()
  // Two taps to empty a cart. The button sat 12px under the checkout CTA, at
  // the bottom of a full-height drawer, exactly in the one-handed thumb arc,
  // with no confirm and no undo. One slip there is a whole lost order from a
  // shopper who will not come back to rebuild it.
  const [confirmClear, setConfirmClear] = useState(false)
  const listRef = useRef(null)
  const panelRef = useFocusTrap(cartOpen)

  // Every dismissal goes through here, so an armed "empty the cart" confirm can
  // never survive a close and be waiting on the next open. Resetting it in an
  // effect keyed on cartOpen would be setState-in-effect, which this repo's
  // react-hooks config rejects.
  const close = useCallback(() => {
    setConfirmClear(false)
    closeOverlay()
  }, [closeOverlay])

  // The drawer opens on the click, and the line that was just added arrives
  // LAST — below the fold on any cart past three items. All the optimistic work
  // bought a confirmation the shopper never saw. Scroll to it.
  useEffect(() => {
    if (!cartOpen || addPending || !listRef.current) return
    const last = listRef.current.lastElementChild
    if (last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cartOpen, addPending, items.length])

  // Escape, the scroll lock and Android's back button are handled once in
  // UIProvider now, for every overlay rather than only for this one.

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Сагс">
      <button
        className="overlay-in absolute inset-0 bg-ink/25"
        onClick={close}
        aria-label="Хаах"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-paper outline-none"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          {/* Same total as the header badge: units, not line items. The two
              disagreed when a single line held more than one of something. */}
          <p className="nav-link text-[14px]">Сагс{count ? ` (${count})` : ''}</p>
          <button onClick={close} className="icon-btn -mr-2" aria-label="Хаах">
            <IconClose />
          </button>
        </div>

        {/* The drawer measures 390px on a 390px viewport, so the overlay
            dismiss behind it is completely covered and the only exit was a
            40x40 target in the far top corner. This one is reachable one-handed. */}
        <div className="border-b border-line px-6 py-2">
          <button
            onClick={close}
            className="tap label text-ink-soft transition-colors hover:text-ink"
          >
            ← Дэлгүүр рүү буцах
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {loading && !addPending && <p className="label py-10 text-ink-faint">Ачааллаж байна…</p>}

          {/* The add succeeded and the refetch after it did not, so this list is
              older than the basket the server holds. That used to be swallowed
              (`refetch().catch(() => {})`), which meant a tap that worked could
              render as "Сагс хоосон байна" — the worst available answer, and the
              one most likely to make a shopper give up and leave. */}
          {cartStale && (
            <div className="mt-4 flex items-center gap-3 border border-line bg-paper-warm px-4 py-3">
              <p className="flex-1 text-[13px] text-ink-soft">
                Сагсыг шинэчилж чадсангүй. Энд харагдаж байгаа нь бүрэн бус байж болно.
              </p>
              <button
                onClick={() => { setCartStale(false); refetch().catch(() => setCartStale(true)) }}
                className="label link-underline shrink-0 text-ink"
              >
                Дахин оролдох
              </button>
            </div>
          )}

          {/* The drawer now opens on the click, not on the server's answer, so
              for the length of one round trip there is a line on its way that
              nothing can show yet. A skeleton says "this is arriving" where an
              empty basket would say "that did nothing" — which is exactly the
              wrong answer to a tap that just worked. */}
          {addPending && (
            <div className="flex animate-pulse gap-4 py-5">
              <div className="aspect-square w-20 shrink-0 bg-shade" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-2/3 rounded bg-shade" />
                <div className="h-3 w-1/3 rounded bg-shade" />
                <div className="mt-4 h-8 w-24 rounded bg-shade" />
              </div>
            </div>
          )}

          {!loading && !addPending && items.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-ink-soft">Сагс хоосон байна.</p>
              <Link
                href="/shop"
                className="label link-underline mt-4 inline-block"
              >
                Дэлгүүр рүү
              </Link>
            </div>
          )}

          {/* Lines arrive staggered rather than all at once, so a full basket
              reads as a list being dealt out instead of a block appearing. The
              index feeds the delay; globals.css caps it so a long cart does not
              leave the last line waiting. */}
          <ul ref={listRef} className="stagger divide-y divide-line">
            {items.map((item, i) => {
              const variant = item.variant
              const product = variant?.product
              const title = copy(product).title ?? 'Бүтээгдэхүүн'
              const image = firstNode(product?.productImageCollection)
              const line = toNumber(variant?.priceMnt) * item.quantity
              return (
                <li key={item.id} style={{ '--i': i }} className="flex gap-4 py-5">
                  <Link
                    href={`/shop/${product?.slug ?? ''}`}
                    className="relative aspect-square w-20 shrink-0 overflow-hidden bg-paper-warm"
                  >
                    <ProductImage filePath={image?.filePath} alt={title} seed={product?.slug} sizes="80px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    {variant?.optionLabel && (
                      <p className="label mt-0.5 text-ink-faint">
                        {variant.optionLabel}: {variant.optionValue}
                      </p>
                    )}
                    <p className="mt-1 text-ink-soft">{formatMnt(variant?.priceMnt)}</p>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-line">
                        {/* "Тоо хасах", not "Хасах": the remove-line control
                            further down is also labelled Хасах, so a screen
                            reader heard the same word for "one fewer" and for
                            "delete this line". */}
                        <button
                          className="grid h-11 w-11 place-items-center text-ink-soft hover:text-ink sm:h-8 sm:w-8"
                          onClick={() => setQuantity(variant.id, item.quantity - 1)}
                          aria-label="Тоо хасах"
                        >
                          <IconMinus />
                        </button>
                        <span className="min-w-7 text-center tabular-nums">{item.quantity}</span>
                        <button
                          className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-30"
                          onClick={() => setQuantity(variant.id, item.quantity + 1)}
                          disabled={!variant?.allowBackorder && item.quantity >= variant?.quantity}
                          aria-label="Нэмэх"
                        >
                          <IconPlus />
                        </button>
                      </div>
                      <button
                        onClick={() => setQuantity(variant.id, 0)}
                        className="label link-underline text-ink-faint"
                      >
                        Хасах
                      </button>
                      <span className="ml-auto tabular-nums">{formatMnt(line)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {items.length > 0 && (
          <div className="border-t border-line px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="label text-ink-faint">Дүн</span>
              <span className="text-[15px] tabular-nums">{formatMnt(subtotal)}</span>
            </div>
            <p className="label mt-1 text-ink-faint">Хүргэлтийн төлбөр төлбөрийн хэсэгт нэмэгдэнэ</p>
            <Link
              href="/checkout"
              className="btn-solid mt-4 block py-4 text-center"
            >
              Захиалах
            </Link>
            {confirmClear ? (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => { clear(); setConfirmClear(false) }}
                  className="label text-sale underline underline-offset-4"
                >
                  Тийм, хоослох
                </button>
                <button onClick={() => setConfirmClear(false)} className="label text-ink-soft">
                  Болих
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="label link-underline mt-3 text-ink-soft"
              >
                Сагс хоослох
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
```

## SearchOverlay
- Source: `components/SearchOverlay.jsx`
- Full-screen search overlay.

```jsx
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { SEARCH_PRODUCTS } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes } from '@/lib/format'
import { useUI } from './UIProvider'
import { useFocusTrap } from './useFocusTrap'
import ProductImage from './ProductImage'
import { IconClose, IconSearch } from './Icons'

/**
 * The panel is a separate component mounted only while the overlay is open, so
 * the term resets by unmounting rather than by an effect that clears it on the
 * way down. The old shape kept one mounted instance forever and reset it with
 * `if (open) focus(); else setTerm('')`, which is setState-in-effect and is
 * what this repo's react-hooks config rejects.
 */
export default function SearchOverlay() {
  const { isOpen, close } = useUI()
  if (!isOpen('search')) return null
  return <SearchPanel onClose={close} />
}

function SearchPanel({ onClose }) {
  const [term, setTerm] = useState('')
  const inputRef = useRef(null)
  const panelRef = useFocusTrap()
  const [run, { data, loading }] = useLazyQuery(SEARCH_PRODUCTS)

  // A DOM call on mount, not a state write: the trap has already put focus on
  // the first control, and this moves it to the field the shopper came for.
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }) }, [])

  // Debounced so a fast typist does not fire a query per keystroke.
  useEffect(() => {
    if (term.trim().length < 2) return undefined
    const id = setTimeout(() => run({ variables: { term: term.trim(), first: 8 } }), 220)
    return () => clearTimeout(id)
  }, [term, run])

  const results = nodes(data?.searchProducts)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Хайлт">
      <button className="overlay-in absolute inset-0 bg-ink/25" onClick={onClose} aria-label="Хаах" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="overlay-in absolute inset-x-0 top-0 max-h-[80vh] overflow-y-auto bg-paper outline-none"
      >
        <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8">
          <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
            <IconSearch className="shrink-0 text-ink-soft" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Бүтээгдэхүүн хайх…"
              aria-label="Бүтээгдэхүүн хайх"
              className="w-full bg-transparent text-[22px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-faint sm:text-[26px]"
            />
            <button onClick={onClose} className="icon-btn shrink-0" aria-label="Хаах">
              <IconClose />
            </button>
          </div>

          {term.trim().length >= 2 && (
            <div className="py-6">
              {loading && <p className="label text-ink-faint">Хайж байна…</p>}
              {!loading && results.length === 0 && (
                <div className="text-ink-soft">
                  <p>Илэрц олдсонгүй.</p>
                  {/* Honest about a real limitation: Postgres has no Mongolian
                      stemmer, so suffixed word forms will not match. */}
                  <p className="label mt-2 text-ink-faint">
                    Үгийн үндсэн хэлбэрээр хайж үзнэ үү (жишээ нь “ээмэг”).
                  </p>
                </div>
              )}
              <ul className="divide-y divide-line">
                {results.map((p) => {
                  const c = copy(p)
                  const img = firstNode(p.productImageCollection)
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/shop/${p.slug}`}
                        className="flex items-center gap-4 py-4"
                      >
                        <span className="relative aspect-square w-16 shrink-0 overflow-hidden bg-paper-warm">
                          <ProductImage filePath={img?.filePath} alt={c.title} seed={p.slug} sizes="56px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.title}</span>
                          <span className="label block text-ink-faint">{c.subtitle}</span>
                        </span>
                        <span className="tabular-nums text-ink-soft">{formatMnt(p.minPriceMnt)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

## UIProvider
- Source: `components/UIProvider.jsx`
- Single-overlay state, scroll lock, Escape, Android back, close-on-navigate.

```jsx
'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Pure UI state — which overlay is open. Deliberately a small context rather
 * than Apollo local state: nothing here is server data, and a context keeps the
 * cache free of things that are not.
 *
 * There is exactly ONE open overlay at a time, held as a name rather than as a
 * boolean per surface. Four separate booleans meant four surfaces could each
 * believe they owned the page: the cart drawer and the shop's filter sheet both
 * wrote `document.body.style.overflow` directly, so closing the filter sheet
 * released the scroll lock the drawer still needed. A single value makes the
 * lock, the Escape key, the Android back button and the close-on-navigation
 * rule impossible to implement inconsistently, because each is written once.
 */
const UIContext = createContext(null)

/** Every dismissable surface in the storefront. */
export const OVERLAYS = ['cart', 'search', 'nav', 'filters']

export function UIProvider({ children }) {
  const [overlay, setOverlay] = useState(null)

  /**
   * An add is in flight somewhere on the page.
   *
   * It lives here rather than on useCart because useCart is a hook: every
   * caller builds its own useMutation, so the drawer's `adding` is a different
   * boolean from the product page's and stays false while the product page is
   * actually mid-request. The drawer needs to know about a request it did not
   * make, which makes this shared UI state, not cart state.
   */
  const [addPending, setAddPending] = useState(false)

  /**
   * The cart mutation succeeded but the refetch that follows it did not, so
   * what the drawer is showing is older than what the server holds. Also
   * shared state: the refetch belongs to whichever useCart ran the add, and
   * the drawer that has to own up to it is a different instance.
   */
  const [cartStale, setCartStale] = useState(false)

  const close = useCallback(() => setOverlay(null), [])

  /**
   * Close because a link inside the overlay is navigating.
   *
   * Same as close(), minus the history unwind: the router has not updated the
   * URL yet when the cleanup runs, so an unwind there cannot tell a dismissal
   * from a navigation and would pop the navigation instead. Only needed for a
   * link whose path matches the current one — any other link changes the path,
   * and the reset below closes the overlay for free.
   */
  const skipUnwindRef = useRef(false)
  const closeForNavigation = useCallback(() => {
    skipUnwindRef.current = true
    setOverlay(null)
  }, [])
  const open = useCallback((name) => setOverlay(name), [])
  const toggle = useCallback((name) => setOverlay((v) => (v === name ? null : name)), [])

  /**
   * Navigating closes whatever is open.
   *
   * This used to be an effect in Header with `[setNavOpen]` as its dependency —
   * a setState function, which never changes — so it ran once on mount and
   * never again. Header lives in the (shop) layout and does not remount, so the
   * mobile menu survived every navigation. Tapping a link inside it was fine
   * (each link closed it by hand), but the Android back button was not: the
   * route changed underneath an open menu that still held the scroll lock, and
   * the shopper landed on a page they could not scroll.
   *
   * Setting state during render is React's documented way to reset state when a
   * prop changes; an effect here would be setState-in-effect, which this repo's
   * react-hooks config rejects, and would also paint the stale frame first.
   */
  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (overlay) setOverlay(null)
  }

  // Escape closes whatever is open. Expected on any overlay — and now it really
  // is any overlay, including the shop filter sheet, which was outside the old
  // boolean set and so was the one surface Escape could not dismiss.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOverlay(null)
      // Cmd/Ctrl-K opens search, the convention people already have muscle memory for.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOverlay((v) => (v === 'search' ? null : 'search'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lock the page behind any open overlay. One writer, so nothing can release
  // a lock another surface is still relying on.
  useEffect(() => {
    if (!overlay) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [overlay])

  /**
   * Android's back button dismisses the overlay rather than leaving the page.
   *
   * The entry is pushed in the ONE shape Next integrates with: a URL, and no
   * custom state (see "Native History API" in the Next docs). A bare
   * `pushState({ hotaruOverlay: true }, '')` detaches the App Router — while
   * any overlay was open, every link inside it silently did nothing, including
   * Захиалах in the cart drawer. Ours is the same URL, so Back lands on the
   * page the shopper is already looking at and only the overlay goes away.
   *
   * A ref marks the entry instead of the state object, which is now null.
   */
  const pushedRef = useRef(false)
  useEffect(() => {
    if (!overlay) return undefined
    const startHref = window.location.href
    window.history.pushState(null, '', window.location.href)
    pushedRef.current = true
    const onPop = () => { pushedRef.current = false; setOverlay(null) }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!pushedRef.current) return
      pushedRef.current = false
      if (skipUnwindRef.current) { skipUnwindRef.current = false; return }
      // The router may already have moved us on; unwinding then would pop the
      // new page rather than our own entry.
      if (window.location.href !== startHref) return
      window.history.back()
    }
  }, [overlay])

  const value = useMemo(
    () => ({
      overlay,
      open,
      close,
      closeForNavigation,
      toggle,
      isOpen: (name) => overlay === name,
      addPending,
      setAddPending,
      cartStale,
      setCartStale,
    }),
    [overlay, open, close, closeForNavigation, toggle, addPending, cartStale],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export const useUI = () => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
```

## ThemeProvider
- Source: `components/ThemeProvider.jsx`
- Theme preference store; writes data-theme before paint.

```jsx
'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
// In lib/ because app/layout.js needs them on the server. See lib/theme.js.
import { PREFERENCES, THEME_COLOR, THEME_KEY } from '@/lib/theme'

/**
 * Light/dark theme: the preference the visitor chose, plus what it resolves to.
 *
 * Storing PREFERENCE rather than RESOLVED is what keeps 'system' following the
 * OS — storing the resolved value would freeze the shop at whatever their phone
 * was set to the first time they opened it.
 *
 * localStorage and matchMedia are external mutable state, so this is a
 * useSyncExternalStore rather than useState seeded in an effect: the seeding
 * effect is a cascading render, which this repo's react-hooks config rejects.
 */
const ThemeContext = createContext(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

/* localStorage throws in a private window, it does not just return null. */
function readPreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return PREFERENCES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

const systemTheme = () => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

/* One snapshot string, so React can compare it by value. */
const compute = () => {
  const preference = readPreference()
  return `${preference}:${preference === 'system' ? systemTheme() : preference}`
}

const listeners = new Set()
let snapshot = null

function invalidate() {
  snapshot = compute()
  listeners.forEach((l) => l())
}

function subscribe(onChange) {
  listeners.add(onChange)
  const mql = window.matchMedia(DARK_QUERY)
  // `storage` keeps other tabs in step; it does not fire in the tab that wrote.
  mql.addEventListener('change', invalidate)
  window.addEventListener('storage', invalidate)
  return () => {
    listeners.delete(onChange)
    mql.removeEventListener('change', invalidate)
    window.removeEventListener('storage', invalidate)
  }
}

const getSnapshot = () => (snapshot ??= compute())

/* The server cannot know either value. React re-renders after hydration if the
   client disagrees, and only the toggle's label depends on it — the palette and
   the icons are already correct from the boot script's attribute. */
const getServerSnapshot = () => 'system:light'

export function ThemeProvider({ children }) {
  const [preference, resolved] = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  ).split(':')

  /**
   * One effect, so the attribute and the browser chrome cannot disagree.
   * Layout, not passive: React's dev remount clears the attribute the boot
   * script stamped, and a passive effect restores it a paint too late.
   * It re-reads the store because `resolved` is still the server's 'light'
   * on the hydration pass; `resolved` is only the trigger.
   */
  useLayoutEffect(() => {
    const current = compute().split(':')[1]
    document.documentElement.dataset.theme = current
    const meta =
      document.querySelector('meta[name="theme-color"]:not([media])')
      ?? document.head.appendChild(
        Object.assign(document.createElement('meta'), { name: 'theme-color' }),
      )
    meta.setAttribute('content', THEME_COLOR[current])
  }, [resolved])

  const setPreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Private window: applies for this page view, will not survive a reload.
    }
    invalidate()
  }, [])

  /* Flips RESOLVED rather than cycling PREFERENCES: one icon button cannot show
     which of three states you are in. setPreference is exported for a settings
     screen that can. */
  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
```
