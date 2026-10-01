'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { TypedDocumentNode } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PENDING, ME } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import type { Connection, Profile } from '@/lib/types'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import CommandPalette from './CommandPalette'
import { ConfirmProvider } from './confirm'
import { Button, IconButton } from './ui'
import Logo from '@/components/Logo'
import {
  Bell, Chevron, Dots, Folder, Orders, Panel, Products,
  Search as SearchIcon, Settings, Star, Tag,
} from './icons'
import type { IconProps } from './icons'

interface NavItem {
  href: string
  label: string
  icon: (props: IconProps) => ReactNode
  badge?: 'pending'
  owns?: (pathname: string) => boolean
}

interface Crumb {
  label: string
  href?: string
}

const NAV: readonly NavItem[] = [
  { href: '/admin', label: 'Захиалга', icon: Orders, badge: 'pending',
    owns: (p) => p === '/admin' || p.startsWith('/admin/orders') },
  { href: '/admin/products', label: 'Бараа', icon: Products },
  { href: '/admin/categories', label: 'Ангилал', icon: Folder },
  { href: '/admin/discounts', label: 'Хөнгөлөлт', icon: Tag },
  { href: '/admin/reviews', label: 'Сэтгэгдэл', icon: Star },
  { href: '/admin/settings', label: 'Тохиргоо', icon: Settings },
]

const owns = (item: NavItem, pathname: string) =>
  item.owns ? item.owns(pathname) : pathname.startsWith(item.href)

function sectionFor(pathname: string) {
  const longestHrefFirst = [...NAV].sort((a, b) => b.href.length - a.href.length)
  return longestHrefFirst.find((n) => owns(n, pathname))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEAF: Record<string, string> = { new: 'Шинэ' }

function crumbsFor(pathname: string): Crumb[] {
  const section = sectionFor(pathname)
  if (!section) return [{ label: 'Админ', href: '/admin' }]

  const crumbs: Crumb[] = [{ label: section.label, href: section.href }]
  if (pathname === section.href) return crumbs

  const leaf = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '')
  if (leaf) crumbs.push({ label: LEAF[leaf] ?? (UUID.test(leaf) ? 'Засварлах' : leaf) })
  return crumbs
}

const meQuery: TypedDocumentNode<
  { profileCollection: Connection<Profile> | null },
  { id: string | undefined }
> = ME

interface CountOnly {
  totalCount?: number | null
}

const pendingQuery: TypedDocumentNode<
  { awaiting: CountOnly | null; oversold: CountOnly | null },
  Record<string, never>
> = ADMIN_PENDING

const PENDING_POLL_MS = 60000

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user } = useSession()
  const { signOut } = useAuthUpgrade()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: meData } = useQuery(meQuery, { variables: { id: user?.id }, skip: !user?.id })
  const { data: pendingData } = useQuery(pendingQuery, { pollInterval: PENDING_POLL_MS })
  const me = firstNode(meData?.profileCollection)
  const pending = pendingData?.awaiting?.totalCount ?? 0
  const oversold = pendingData?.oversold?.totalCount ?? 0
  const crumbs = crumbsFor(pathname)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div data-ui="admin" className="min-h-screen bg-background text-foreground">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} nav={NAV} />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-a-line bg-a-bg transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <Logo className="h-5 w-auto" />
          <IconButton asChild className="ml-auto size-6">
            <Link href="/" title="Дэлгүүр">
              <Dots />
            </Link>
          </IconButton>
        </div>

        <div className="mx-3 border-t border-dashed border-a-line" />

        <Button
          variant="ghost"
          onClick={() => setPaletteOpen(true)}
          className="mx-2 mt-2 flex h-auto w-[calc(100%-16px)] justify-start gap-2.5 px-2 py-1.5 text-[14px] font-normal has-[>svg]:px-2"
        >
          <SearchIcon />
          <span className="flex-1 text-left">Хайх</span>
          <kbd className="text-[11px] text-muted-foreground">⌘K</kbd>
        </Button>

        <nav className="mt-1 px-2">
          {NAV.map((item) => {
            const active = owns(item, pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] transition-colors ${
                  active
                    ? 'border border-a-line bg-a-surface font-medium text-a-ink shadow-[0_1px_2px_rgba(0,0,0,.04)]'
                    : 'border border-transparent text-a-muted hover:bg-a-hover hover:text-a-ink'
                }`}
              >
                <Icon />
                <span className="flex-1">{item.label}</span>
                {item.badge === 'pending' && pending > 0 && (
                  <span className="rounded bg-warn-soft px-1.5 text-[11px] font-semibold text-warn-ink">{pending}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {oversold > 0 && (
          <Link href="/admin" className="mx-3 mt-3 block rounded-md border border-danger-line bg-danger-soft px-3 py-2.5">
            <p className="text-[12px] font-semibold text-danger-ink">{oversold} захиалга нөөцгүй</p>
            <p className="mt-0.5 text-[12px] text-danger-ink">Буцаалт шаардлагатай</p>
          </Link>
        )}

        <div className="absolute inset-x-0 bottom-0 px-3 py-3">
          <div className="mx-1 border-t border-dashed border-a-line pt-3">
            <p className="truncate px-1 text-[12px] text-a-muted">{me?.email ?? '—'}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="mt-1 h-auto px-1 py-1 font-normal hover:bg-transparent dark:hover:bg-transparent"
            >
              Гарах
            </Button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Хаах" />
      )}

      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-a-line bg-a-bg/95 px-4 backdrop-blur">
          <IconButton onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden">
            <Panel />
          </IconButton>
          <span className="hidden text-a-muted lg:block"><Panel /></span>
          <nav className="flex items-center gap-1.5 text-[13px]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-a-muted"><Chevron width="12" height="12" /></span>}
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href} className="text-a-muted hover:text-a-ink">{c.label}</Link>
                ) : (
                  <span className={i === crumbs.length - 1 ? 'text-a-ink' : 'text-a-muted'}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          <span className="ml-auto grid h-7 w-7 place-items-center rounded-md text-a-muted" title={pending ? `${pending} захиалга хүлээгдэж байна` : 'Мэдэгдэл алга'}>
            <Bell />
            {pending > 0 && <span className="absolute mt-[-14px] ml-[14px] h-1.5 w-1.5 rounded-full bg-warn" />}
          </span>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">
          <ConfirmProvider>{children}</ConfirmProvider>
        </main>
      </div>
    </div>
  )
}
