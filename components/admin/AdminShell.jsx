'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PENDING, ME } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'

const NAV = [
  { href: '/admin', label: 'Захиалга', exact: true },
  { href: '/admin/inventory', label: 'Бараа' },
  { href: '/admin/images', label: 'Зураг' },
  { href: '/admin/discounts', label: 'Хөнгөлөлт' },
  { href: '/admin/reviews', label: 'Сэтгэгдэл' },
  { href: '/admin/settings', label: 'Тохиргоо' },
]

/**
 * Console shell: fixed sidebar, thin top bar, grey canvas. The pending-payment
 * count sits in the sidebar because with manual bank transfer that queue IS the
 * job — it should be visible from every screen, not just the orders page.
 */
export default function AdminShell({ children }) {
  const pathname = usePathname()
  const { user } = useSession()
  const { signOut } = useAuthUpgrade()
  const { data: meData } = useQuery(ME, { variables: { id: user?.id }, skip: !user?.id })
  const { data: pendingData } = useQuery(ADMIN_PENDING, { pollInterval: 60000 })

  const me = nodes(meData?.profileCollection)[0]
  const pending = pendingData?.awaiting?.totalCount ?? 0
  const oversold = pendingData?.oversold?.totalCount ?? 0

  return (
    <div className="min-h-screen bg-a-bg">
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 border-r border-a-line bg-white lg:block">
          <div className="flex h-[56px] items-center border-b border-a-line px-5">
            <Link href="/admin" className="text-[15px] font-bold tracking-tight text-a-ink">
              hotaru<span className="text-a-muted">/admin</span>
            </Link>
          </div>

          <nav className="p-3">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mb-0.5 flex items-center justify-between rounded-md px-3 py-2 text-[13px] transition-colors ${
                    active ? 'bg-a-hover font-medium text-a-ink' : 'text-a-muted hover:bg-a-hover hover:text-a-ink'
                  }`}
                >
                  {item.label}
                  {item.href === '/admin' && pending > 0 && (
                    <span className="rounded-md bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">
                      {pending}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {oversold > 0 && (
            <div className="mx-3 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-[12px] font-semibold text-red-700">{oversold} захиалга нөөцгүй</p>
              <p className="mt-0.5 text-[12px] text-red-600">Буцаалт шаардлагатай</p>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 border-t border-a-line p-3">
            <p className="truncate px-3 text-[12px] text-a-muted">{me?.email ?? '—'}</p>
            <div className="mt-1 flex gap-1">
              <Link href="/" className="rounded-md px-3 py-1.5 text-[12px] text-a-muted hover:bg-a-hover hover:text-a-ink">
                Дэлгүүр
              </Link>
              <button onClick={signOut} className="rounded-md px-3 py-1.5 text-[12px] text-a-muted hover:bg-a-hover hover:text-a-ink">
                Гарах
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[56px] items-center gap-4 border-b border-a-line bg-white/95 px-5 backdrop-blur lg:px-8">
            <Link href="/admin" className="text-[14px] font-bold text-a-ink lg:hidden">
              hotaru/admin
            </Link>
            <nav className="flex gap-3 overflow-x-auto lg:hidden">
              {NAV.map((i) => (
                <Link key={i.href} href={i.href} className="whitespace-nowrap text-[13px] text-a-muted hover:text-a-ink">
                  {i.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto hidden text-[12px] text-a-muted lg:block">
              {pending > 0 ? `${pending} захиалга төлбөр хүлээж байна` : 'Хүлээгдэж буй захиалга алга'}
            </span>
          </header>

          <div className="px-5 py-6 lg:px-8 lg:py-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
