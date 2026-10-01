'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { IconBag, IconChevronDown, IconSearch } from './Icons'
import Logo from './Logo'
import UserMenu from './UserMenu'
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
}

interface HeaderProps {
  categories?: NavLink[]
}

const INFO_LINKS: NavLink[] = [
  { href: '/about', label: 'Бидний тухай' },
  { href: '/contact', label: 'Холбоо барих' },
]

const activeUnderline = (active: boolean) =>
  active
    ? 'after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-ink-strong'
    : ''

export default function Header({ categories = [] }: HeaderProps) {
  const { open } = useUI()
  const { count } = useCart()
  const pathname = usePathname()

  const shopLinks: NavLink[] = [{ href: '/shop', label: 'Бүх бүтээгдэхүүн' }, ...categories]

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  const [shopOpen, setShopOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (shopOpen) setShopOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-center gap-4 px-4 sm:px-5 lg:h-[72px] lg:justify-start lg:px-8">
        <Link href="/" className="flex min-h-11 min-w-0 shrink items-center">
          <Logo className="h-6 w-auto max-w-full object-contain sm:h-7 lg:h-8 lg:object-left" />
        </Link>

        <nav aria-label="Үндсэн цэс" className="mx-auto hidden items-center gap-8 lg:flex">
          <TopLink href="/" label="Нүүр" active={isActive('/')} />

          <DropdownMenu modal={false} open={shopOpen} onOpenChange={setShopOpen}>
            <DropdownMenuTrigger
              className={`nav-link relative flex cursor-pointer items-center gap-1 hover:opacity-60 ${activeUnderline(isActive('/shop'))}`}
            >
              Дэлгүүр
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

          {INFO_LINKS.map((item) => (
            <TopLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          <Button variant="ghost" size="icon-touch" onClick={() => open('search')} aria-label="Хайх" title="Хайх (⌘K)">
            <IconSearch />
          </Button>
          <Button variant="ghost" size="icon-touch" onClick={() => open('cart')} className="relative" aria-label="Сагс">
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
