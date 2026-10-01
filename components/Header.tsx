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

export interface NavLink {
  href: string
  label: string
}

interface HeaderProps {
  categories?: NavLink[]
}

const INFO_LINKS: NavLink[] = [
  { href: '/about', label: 'Бидний тухай' },
  { href: '/contact', label: 'Холбоо барих' },
]

const PHONE_ONLY_HELP_LINK: NavLink = { href: '/faq', label: 'Түгээмэл асуулт' }

const pathOf = (href: string) => href.split('?')[0]

const activeUnderline = (active: boolean) =>
  active
    ? 'after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-ink-strong'
    : ''

export default function Header({ categories = [] }: HeaderProps) {
  const { isOpen, open, closeForNavigation, toggle } = useUI()
  const navOpen = isOpen('nav')
  const { count } = useCart()
  const { isAuthenticated } = useSession()
  const pathname = usePathname()

  const shopLinks: NavLink[] = [{ href: '/shop', label: 'Бүх бүтээгдэхүүн' }, ...categories]

  const accountLinks: NavLink[] = [
    isAuthenticated
      ? { href: '/account', label: 'Профайл' }
      : { href: '/login', label: 'Нэвтрэх' },
    { href: '/wishlist', label: 'Хадгалсан' },
    { href: '/orders', label: 'Захиалга хянах' },
  ]

  const isActive = (href: string) => {
    const path = pathOf(href)
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  const shopActive = pathname.startsWith('/shop')

  const closeIfSamePath = (href: string) =>
    pathOf(href) === pathname ? closeForNavigation : undefined

  const [shopOpen, setShopOpen] = useState(false)
  const shopRef = useRef<HTMLDivElement>(null)

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (shopOpen) setShopOpen(false)
  }

  useEffect(() => {
    if (!shopOpen) return undefined
    const onPointerDown = (e: PointerEvent) => {
      const insideMenu = e.target instanceof Node && shopRef.current?.contains(e.target)
      if (!insideMenu) setShopOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
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
              className={`nav-link relative flex items-center gap-1 hover:opacity-60 ${activeUnderline(shopActive)}`}
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
          <ThemeToggle />
          <button onClick={() => open('search')} className="icon-btn" aria-label="Хайх">
            <IconSearch />
          </button>
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
            links={[...INFO_LINKS, PHONE_ONLY_HELP_LINK]}
            isActive={isActive}
            closeIfSamePath={closeIfSamePath}
          />
        </nav>
      )}
    </header>
  )
}

interface TopLinkProps extends NavLink {
  active: boolean
}

function TopLink({ href, label, active }: TopLinkProps) {
  return (
    <Link href={href} className={`nav-link relative hover:opacity-60 ${activeUnderline(active)}`}>
      {label}
    </Link>
  )
}

interface MobileLinkProps extends NavLink {
  active: boolean
  onSamePath?: () => void
}

function MobileLink({ href, label, active, onSamePath }: MobileLinkProps) {
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

interface MobileGroupProps {
  title: string
  links: NavLink[]
  isActive: (href: string) => boolean
  closeIfSamePath: (href: string) => (() => void) | undefined
}

function MobileGroup({ title, links, isActive, closeIfSamePath }: MobileGroupProps) {
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
