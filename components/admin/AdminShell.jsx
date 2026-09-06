'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PENDING, ME } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import CommandPalette from './CommandPalette'
import {
  Bell, Chevron, Dots, ImageIcon, Inventory, Orders, Panel, Products,
  Search as SearchIcon, Settings, Star, Tag,
} from './icons'

const NAV = [
  { href: '/admin', label: 'Захиалга', icon: Orders, exact: true, badge: 'pending' },
  { href: '/admin/inventory', label: 'Бараа', icon: Products },
  { href: '/admin/images', label: 'Зураг', icon: ImageIcon },
  { href: '/admin/discounts', label: 'Хөнгөлөлт', icon: Tag },
  { href: '/admin/reviews', label: 'Сэтгэгдэл', icon: Star },
  { href: '/admin/settings', label: 'Тохиргоо', icon: Settings },
]

/** Human breadcrumb from the path, so the top bar always says where you are. */
function useCrumbs(pathname) {
  const match = NAV.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))
  const crumbs = [{ label: match?.label ?? 'Админ', href: match?.href ?? '/admin' }]
  if (match && !match.exact && pathname !== match.href) crumbs.push({ label: '…' })
  if (match?.exact && pathname !== '/admin') {
    crumbs.push({ label: decodeURIComponent(pathname.split('/').pop()) })
  }
  return crumbs
}

export default function AdminShell({ children }) {
  const pathname = usePathname()
  const { user } = useSession()
  const { signOut } = useAuthUpgrade()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: meData } = useQuery(ME, { variables: { id: user?.id }, skip: !user?.id })
  const { data: pendingData } = useQuery(ADMIN_PENDING, { pollInterval: 60000 })
  const me = nodes(meData?.profileCollection)[0]
  const pending = pendingData?.awaiting?.totalCount ?? 0
  const oversold = pendingData?.oversold?.totalCount ?? 0
  const crumbs = useCrumbs(pathname)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-a-bg text-a-ink">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} nav={NAV} />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[240px] border-r border-a-line bg-a-bg transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- see ProductImage: no next/image here */}
          <img src="/logo.png" alt="hotaru" width={1200} height={258} className="h-5 w-auto" />
          <Link href="/" className="ml-auto grid h-6 w-6 place-items-center rounded-md text-a-muted hover:bg-a-hover hover:text-a-ink" title="Дэлгүүр">
            <Dots />
          </Link>
        </div>

        <div className="mx-3 border-t border-dashed border-a-line" />

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-2 mt-2 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] text-a-muted transition-colors hover:bg-a-hover hover:text-a-ink"
        >
          <SearchIcon />
          <span className="flex-1 text-left">Хайх</span>
          <kbd className="text-[11px] text-a-muted">⌘K</kbd>
        </button>

        <nav className="mt-1 px-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] transition-colors ${
                  active
                    ? 'border border-a-line bg-white font-medium text-a-ink shadow-[0_1px_2px_rgba(0,0,0,.04)]'
                    : 'border border-transparent text-a-muted hover:bg-a-hover hover:text-a-ink'
                }`}
              >
                <Icon />
                <span className="flex-1">{item.label}</span>
                {item.badge === 'pending' && pending > 0 && (
                  <span className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">{pending}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {oversold > 0 && (
          <Link href="/admin" className="mx-3 mt-3 block rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-[12px] font-semibold text-red-700">{oversold} захиалга нөөцгүй</p>
            <p className="mt-0.5 text-[12px] text-red-600">Буцаалт шаардлагатай</p>
          </Link>
        )}

        <div className="absolute inset-x-0 bottom-0 px-3 py-3">
          <div className="mx-1 border-t border-dashed border-a-line pt-3">
            <p className="truncate px-1 text-[12px] text-a-muted">{me?.email ?? '—'}</p>
            <button
              onClick={signOut}
              className="mt-1 rounded-md px-1 py-1 text-[12px] text-a-muted transition-colors hover:text-a-ink"
            >
              Гарах
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Хаах" />
      )}

      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-a-line bg-a-bg/95 px-4 backdrop-blur">
          <button onClick={() => setMenuOpen(!menuOpen)} className="grid h-7 w-7 place-items-center rounded-md text-a-muted hover:bg-a-hover lg:hidden">
            <Panel />
          </button>
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
            {pending > 0 && <span className="absolute mt-[-14px] ml-[14px] h-1.5 w-1.5 rounded-full bg-amber-500" />}
          </span>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
