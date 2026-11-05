'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { IconBag, IconChevronDown, IconSearch } from './Icons'
import Logo from './Logo'
import UserMenu from './UserMenu'
import { LangSwitch, categoryName, setLang, useLang, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface NavLink {
  href: string
  label: string
  slug?: string
}

interface HeaderProps {
  categories?: NavLink[]
}

const subscribeScroll = (onChange: () => void) => {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}
const getScrolled = () => window.scrollY > 8
const getServerScrolled = () => false

const activeUnderline = (active: boolean) =>
  active
    ? 'after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-ink-strong'
    : ''

export default function Header({ categories = [] }: HeaderProps) {
  const { open } = useUI()
  const { count } = useCart()
  const pathname = usePathname()
  const t = useT()
  const lang = useLang()
  const infoLinks: NavLink[] = [
    { href: '/about', label: t('Бидний тухай', 'About us') },
    { href: '/contact', label: t('Холбоо барих', 'Contact') },
  ]
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getServerScrolled)

  const shopLinks: NavLink[] = [
    { href: '/shop', label: t('Бүх бүтээгдэхүүн', 'All products') },
    ...categories.map((c) => ({ ...c, label: c.slug ? categoryName(c.slug, c.label, lang) : c.label })),
  ]

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  const [shopOpen, setShopOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (shopOpen) setShopOpen(false)
  }

  return (
    <header data-clear={pathname === '/' && !scrolled} className="glass-header storefront-header sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-5 lg:h-[72px] lg:gap-5 lg:px-8 xl:gap-6">
        <Link href="/" className="flex min-h-11 shrink-0 items-center">
          <Logo className="h-[22px] w-auto object-contain object-left sm:h-7 lg:h-7 xl:h-8" />
        </Link>

        <button
          type="button"
          onClick={() => open('search')}
          aria-label={t('Хайх', 'Search')}
          className="header-search hidden h-10 min-w-0 items-center gap-2.5 rounded-full px-3.5 text-left text-[14px] text-ink-faint lg:flex lg:w-44 lg:flex-none xl:w-72"
        >
          <IconSearch width="18" height="18" aria-hidden="true" className="shrink-0 text-ink-soft" />
          <span className="truncate">{t('Бараа хайх', 'Search products')}</span>
          <kbd className="ml-auto hidden rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px] text-ink-faint xl:inline">⌘K</kbd>
        </button>

        <nav aria-label={t('Үндсэн цэс', 'Main menu')} className="mx-auto hidden items-center gap-5 whitespace-nowrap lg:flex xl:gap-9">
          <TopLink href="/" label={t('Нүүр', 'Home')} active={isActive('/')} />

          <DropdownMenu modal={false} open={shopOpen} onOpenChange={setShopOpen}>
            <DropdownMenuTrigger
              className={`nav-link relative flex cursor-pointer items-center gap-1 hover:opacity-60 ${activeUnderline(isActive('/shop'))}`}
            >
              {t('Дэлгүүр', 'Shop')}
              <IconChevronDown
                width="16"
                height="16"
                aria-hidden="true"
                className={`transition-transform duration-200 ${shopOpen ? 'rotate-180' : ''}`}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              sideOffset={16}
              className="max-h-[70vh] w-60 rounded-xl border-line bg-paper-raise p-2"
            >
              {shopLinks.map((item) => (
                <DropdownMenuItem key={item.href + item.label} asChild>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-[14px] text-ink transition-colors focus:bg-line-soft focus:text-ink-strong"
                  >
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {infoLinks.map((item) => (
            <TopLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center lg:ml-0">
          <div className="hidden lg:block">
            <LangSwitch compact />
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'mn' : 'en')}
            aria-label={lang === 'en' ? 'Монгол хэл рүү шилжих' : 'Switch to English'}
            className="grid h-10 min-w-11 place-items-center rounded-full border border-line px-2.5 text-[12px] font-semibold text-ink-strong lg:hidden"
          >
            {lang === 'en' ? 'МН' : 'EN'}
          </button>
          <span aria-hidden="true" className="mx-3 hidden h-6 w-px bg-line lg:block xl:mx-4" />
          <div className="hidden items-center gap-1 lg:flex">
            <Button variant="ghost" size="icon-touch" onClick={() => open('cart')} className="relative" aria-label={t('Сагс', 'Cart')}>
              <IconBag />
              {count > 0 && (
                <span
                  key={count}
                  className="count-pop absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary-strong px-1 text-[10px] font-bold text-on-primary"
                >
                  {count}
                </span>
              )}
            </Button>
            <UserMenu />
          </div>
        </div>
      </div>
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
