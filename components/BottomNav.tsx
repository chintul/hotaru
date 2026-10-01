'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, ReactNode } from 'react'
import { useUI, type Overlay } from './UIProvider'
import { useCart } from './useCart'
import { useAccount } from './useAccount'
import { useTheme } from './ThemeProvider'
import { LINK_ICON, THEME_CHOICES } from './UserMenu'
import type { NavLink } from './Header'
import {
  IconBag,
  IconCategories,
  IconChevronRight,
  IconHome,
  IconLogOut,
  IconSearch,
  IconUser,
  type IconProps,
} from './Icons'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const INFO_LINKS: readonly NavLink[] = [
  { href: '/about', label: 'Бидний тухай' },
  { href: '/contact', label: 'Холбоо барих' },
  { href: '/faq', label: 'Түгээмэл асуулт' },
]

interface BottomNavProps {
  categories?: NavLink[]
}

export default function BottomNav({ categories = [] }: BottomNavProps) {
  const pathname = usePathname()
  const { isOpen, open, close, closeForNavigation } = useUI()
  const { count } = useCart()

  const shopLinks: NavLink[] = [{ href: '/shop', label: 'Бүх бүтээгдэхүүн' }, ...categories]
  const accountActive = ['/account', '/orders', '/wishlist', '/login'].some((p) => pathname.startsWith(p))

  return (
    <>
      <nav
        aria-label="Үндсэн цэс"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/97 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          <li>
            <Tab href="/" label="Нүүр" icon={IconHome} active={pathname === '/' && !isOpen('nav')} />
          </li>
          <li>
            <Tab overlay="nav" label="Ангилал" icon={IconCategories}
              active={isOpen('nav') || pathname.startsWith('/shop')} onOpen={open} />
          </li>
          <li>
            <Tab overlay="search" label="Хайх" icon={IconSearch} active={isOpen('search')} onOpen={open} />
          </li>
          <li>
            <Tab overlay="cart" label="Сагс" icon={IconBag} active={isOpen('cart')} onOpen={open}
              badge={count > 0 ? count : null} />
          </li>
          <li>
            <Tab overlay="account" label="Миний" icon={IconUser} active={isOpen('account') || accountActive} onOpen={open} />
          </li>
        </ul>
      </nav>

      <Sheet open={isOpen('nav')} onOpenChange={(next) => { if (!next) close() }}>
        <SheetContent side="bottom" aria-describedby={undefined} closeLabel="Хаах" className="gap-0 px-5 pb-6 pt-5 lg:hidden">
          <SheetTitle className="text-[17px] font-semibold">Ангилал</SheetTitle>
          <ul className="mt-3 overflow-y-auto">
            {shopLinks.map((link) => (
              <li key={link.href} className="border-b border-line last:border-0">
                <SheetRow href={link.href} onNavigate={closeForNavigation}>
                  {link.label}
                </SheetRow>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      <AccountSheet open={isOpen('account')} onClose={close} onNavigate={closeForNavigation} />
    </>
  )
}

type TabProps = {
  label: string
  icon: ComponentType<IconProps>
  active: boolean
  badge?: number | null
} & ({ href: string; overlay?: never; onOpen?: never } | { href?: never; overlay: Overlay; onOpen: (name: Overlay) => void })

function Tab({ label, icon: Icon, active, badge, ...target }: TabProps) {
  const className = cn(
    'relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] leading-none transition-colors',
    active ? 'font-semibold text-ink-strong' : 'text-ink-soft',
  )
  const content = (
    <>
      <span className="relative">
        <Icon width="22" height="22" strokeWidth={active ? 1.9 : 1.6} aria-hidden="true" />
        {badge != null && (
          <span
            key={badge}
            className="count-pop absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-primary-strong px-1 text-[10px] font-bold text-on-primary"
          >
            {badge}
          </span>
        )}
      </span>
      {label}
    </>
  )

  if (target.href !== undefined) {
    return (
      <Link href={target.href} className={className} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    )
  }
  const { overlay, onOpen } = target
  return (
    <button type="button" onClick={() => onOpen(overlay)} className={className} aria-expanded={active}>
      {content}
    </button>
  )
}

interface SheetRowProps {
  href: string
  onNavigate: () => void
  icon?: ComponentType<IconProps>
  children: ReactNode
}

function SheetRow({ href, onNavigate, icon: Icon, children }: SheetRowProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-12 items-center gap-3 text-[15px] text-ink"
    >
      {Icon && <Icon width="20" height="20" aria-hidden="true" className="text-ink-soft" />}
      <span className="flex-1">{children}</span>
      <IconChevronRight width="16" height="16" aria-hidden="true" className="text-ink-faint" />
    </Link>
  )
}

function AccountSheet({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: () => void }) {
  const { isAuthenticated, displayName, links, signOut } = useAccount()
  const { preference, setPreference } = useTheme()

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <SheetContent side="bottom" aria-describedby={undefined} closeLabel="Хаах" className="gap-0 overflow-y-auto px-5 pb-6 pt-5 lg:hidden">
        <SheetTitle className="pr-10 text-[17px] font-semibold">
          {isAuthenticated && displayName ? (
            <>
              <span className="block text-[12px] font-normal text-ink-faint">Нэвтэрсэн</span>
              <span className="block truncate">{displayName}</span>
            </>
          ) : 'Миний'}
        </SheetTitle>

        <ul className="mt-3">
          {links.map((link) => (
            <li key={link.href} className="border-b border-line last:border-0">
              <SheetRow href={link.href} onNavigate={onNavigate} icon={LINK_ICON[link.icon]}>{link.label}</SheetRow>
            </li>
          ))}
        </ul>

        <p className="label mt-5 text-ink-faint">Өнгөний горим</p>
        <div role="group" aria-label="Өнгөний горим" className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-shade p-1">
          {THEME_CHOICES.map(({ value, label, icon: Icon }) => {
            const selected = preference === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setPreference(value)}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors',
                  selected ? 'bg-paper font-semibold text-ink-strong shadow-(--t-lift)' : 'text-ink-soft',
                )}
              >
                <Icon width="16" height="16" aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>

        <p className="label mt-5 text-ink-faint">Мэдээлэл</p>
        <ul className="mt-1">
          {INFO_LINKS.map((link) => (
            <li key={link.href} className="border-b border-line last:border-0">
              <SheetRow href={link.href} onNavigate={onNavigate}>{link.label}</SheetRow>
            </li>
          ))}
        </ul>

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => { onClose(); void signOut() }}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-[14px] text-ink"
          >
            <IconLogOut width="18" height="18" aria-hidden="true" />
            Гарах
          </button>
        )}
      </SheetContent>
    </Sheet>
  )
}
