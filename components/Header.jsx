'use client'

import Link from 'next/link'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { useSession } from './useSession'
import { IconBag, IconClose, IconHeart, IconMenu, IconSearch, IconUser } from './Icons'

/**
 * Header laid out like the reference: logo left, centred uppercase nav,
 * icon cluster right (search, account, wishlist, cart with a count badge).
 *
 * `categories` arrives as a prop from the (shop) layout, which reads it on the
 * server with the anon key. It used to be a client useQuery, which meant the
 * top-level navigation of every page waited on a round trip to Tokyo before it
 * could render — and put the category list in the client bundle for a value
 * that changes about never.
 */
export default function Header({ categories = [] }) {
  const { isOpen, open, close, toggle } = useUI()
  const navOpen = isOpen('nav')
  const { count } = useCart()
  const { isAuthenticated } = useSession()

  const nav = [
    { href: '/', label: 'Нүүр' },
    { href: '/shop', label: 'Дэлгүүр' },
    ...categories.slice(0, 4),
  ]

  // Closing on navigation is UIProvider's job now. It used to live here as an
  // effect keyed on [setNavOpen] — a setState function, which never changes —
  // so it ran once on mount and never again, and Header does not remount
  // between routes. The menu survived every Android back press, scroll lock and
  // all.

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

        <Link href="/" className="shrink-0">
          {/* Plain <img>: next/image is unused project-wide (see ProductImage).
              width/height are the intrinsic size and only reserve the box. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 14KB static PNG, no loader wanted */}
          <img src="/logo.png" alt="hotaru" width={591} height={113} className="h-6 w-auto sm:h-7 lg:h-8" />
        </Link>

        <nav className="mx-auto hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <Link key={item.href + item.label} href={item.href} className="nav-link hover:opacity-60">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button onClick={() => open('search')} className="icon-btn" aria-label="Хайх">
            <IconSearch />
          </button>
          <Link href={isAuthenticated ? '/account' : '/login'} className="icon-btn" aria-label="Профайл">
            <IconUser />
          </Link>
          <Link href="/wishlist" className="icon-btn" aria-label="Хадгалсан">
            <IconHeart />
          </Link>
          <button onClick={() => open('cart')} className="icon-btn relative" aria-label="Сагс">
            <IconBag />
            {count > 0 && (
              // Keyed on the count so React remounts the node on every change,
              // which restarts the animation. Toggling a class instead would
              // need a timer to take it off again, and would not replay when
              // the count changed twice inside one animation.
              <span
                key={count}
                className="count-pop absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink-strong px-1 text-[10px] font-bold text-paper"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {navOpen && (
        <nav id="mobile-nav" className="overlay-in border-t border-line bg-paper px-5 py-3 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={close}
              className="nav-link block py-3"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/orders" onClick={close} className="nav-link block py-3">
            Захиалга
          </Link>
        </nav>
      )}
    </header>
  )
}
