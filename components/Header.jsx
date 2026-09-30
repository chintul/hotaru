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
