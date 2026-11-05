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
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-5 lg:h-[72px] lg:justify-start lg:px-8">
        <Link href="/" className="flex min-h-11 min-w-0 shrink items-center">
          <Logo className="h-6 w-auto max-w-full object-contain sm:h-7 lg:h-8 lg:object-left" />
        </Link>

        <nav aria-label={t('Үндсэн цэс', 'Main menu')} className="mx-auto hidden items-center gap-8 lg:flex">
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

        <div className="flex items-center gap-1">
          <LangSwitch className="mr-1 hidden lg:inline-flex" />
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'mn' : 'en')}
            aria-label={lang === 'en' ? 'Монгол хэл рүү шилжих' : 'Switch to English'}
            className="grid h-11 min-w-11 place-items-center rounded-full px-2 text-[13px] font-semibold text-ink-strong hover:bg-line-soft lg:hidden"
          >
            {lang === 'en' ? 'МН' : 'EN'}
          </button>
          <Button variant="ghost" size="touch" onClick={() => open('search')} aria-label={t('Хайх', 'Search')} title={t('Хайх (⌘K)', 'Search (⌘K)')} className="min-w-11 gap-2.5 rounded-full px-3">
            <IconSearch /><span className="hidden text-xs xl:inline">{t('Бараа хайх', 'Search products')}</span>
          </Button>
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
