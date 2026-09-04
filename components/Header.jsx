'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { useSession } from './useSession'

const NAV = [
  { href: '/shop', label: 'Бүх бүтээгдэхүүн' },
  { href: '/shop?c=earrings', label: 'Ээмэг' },
  { href: '/shop?c=necklaces', label: 'Зүүлт' },
  { href: '/shop?c=rings', label: 'Бөгж' },
]

export default function Header() {
  const { setCartOpen, setSearchOpen, navOpen, setNavOpen } = useUI()
  const { count } = useCart()
  const { isAuthenticated } = useSession()
  const [lifted, setLifted] = useState(false)

  // The header is transparent over the hero and gains a hairline once the page
  // moves — the border appearing is what signals "sticky" without a shadow.
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 bg-paper/90 backdrop-blur-sm transition-colors duration-300 ${
        lifted ? 'border-b border-line' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="label -ml-1 p-1 md:hidden"
          aria-label="Цэс"
          aria-expanded={navOpen}
        >
          {navOpen ? 'Хаах' : 'Цэс'}
        </button>

        <Link href="/" className="display text-[17px] font-medium tracking-[0.28em] uppercase">
          hotaru
        </Link>

        <nav className="ml-6 hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="label link-underline text-ink-soft hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <button onClick={() => setSearchOpen(true)} className="label link-underline text-ink-soft hover:text-ink">
            Хайх
          </button>
          <Link href={isAuthenticated ? '/account' : '/login'} className="label link-underline hidden text-ink-soft hover:text-ink sm:inline">
            {isAuthenticated ? 'Профайл' : 'Нэвтрэх'}
          </Link>
          <button onClick={() => setCartOpen(true)} className="label link-underline hover:text-ink" aria-label="Сагс">
            Сагс{count > 0 ? ` (${count})` : ''}
          </button>
        </div>
      </div>

      {navOpen && (
        <nav className="overlay-in border-t border-line bg-paper px-5 py-4 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setNavOpen(false)}
              className="label block py-2.5 text-ink-soft"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/orders" onClick={() => setNavOpen(false)} className="label block py-2.5 text-ink-soft">
            Захиалга
          </Link>
        </nav>
      )}
    </header>
  )
}
