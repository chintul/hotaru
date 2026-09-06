'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { NAV_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { useSession } from './useSession'
import { IconBag, IconClose, IconHeart, IconMenu, IconSearch, IconUser } from './Icons'

/**
 * Header laid out like the reference: logo left, centred uppercase nav,
 * icon cluster right (search, account, wishlist, cart with a count badge).
 */
export default function Header() {
  const { setCartOpen, setSearchOpen, navOpen, setNavOpen } = useUI()
  const { count } = useCart()
  const { isAuthenticated } = useSession()
  const { data } = useQuery(NAV_CATEGORIES)

  const categories = nodes(data?.categoryCollection).map((c) => ({
    href: `/shop?c=${c.slug}`,
    label: firstNode(c.categoryTranslationCollection)?.name ?? c.slug,
  }))

  const nav = [
    { href: '/', label: 'Нүүр' },
    { href: '/shop', label: 'Дэлгүүр' },
    ...categories.slice(0, 4),
  ]

  // Close the mobile sheet on route change; otherwise it hangs over the page.
  useEffect(() => { setNavOpen(false) }, [setNavOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-4 px-5 lg:px-8">
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="icon-btn -ml-2 lg:hidden"
          aria-label="Цэс"
          aria-expanded={navOpen}
        >
          {navOpen ? <IconClose /> : <IconMenu />}
        </button>

        <Link href="/" className="shrink-0">
          {/* Plain <img>: next/image is unused project-wide (see ProductImage).
              width/height are the intrinsic size and only reserve the box. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 14KB static PNG, no loader wanted */}
          <img src="/logo.png" alt="hotaru" width={591} height={113} className="h-7 w-auto lg:h-8" />
        </Link>

        <nav className="mx-auto hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <Link key={item.href + item.label} href={item.href} className="nav-link hover:opacity-60">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button onClick={() => setSearchOpen(true)} className="icon-btn" aria-label="Хайх">
            <IconSearch />
          </button>
          <Link href={isAuthenticated ? '/account' : '/login'} className="icon-btn" aria-label="Профайл">
            <IconUser />
          </Link>
          <Link href="/wishlist" className="icon-btn" aria-label="Хадгалсан">
            <IconHeart />
          </Link>
          <button onClick={() => setCartOpen(true)} className="icon-btn relative" aria-label="Сагс">
            <IconBag />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sale px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {navOpen && (
        <nav className="overlay-in border-t border-line bg-paper px-5 py-3 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={() => setNavOpen(false)}
              className="nav-link block py-3"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/orders" onClick={() => setNavOpen(false)} className="nav-link block py-3">
            Захиалга
          </Link>
        </nav>
      )}
    </header>
  )
}
