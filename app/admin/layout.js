import Link from 'next/link'

export const metadata = { title: 'Админ' }

export default function AdminLayout({ children }) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-line pb-4">
        <Link href="/admin" className="display text-xl">Админ</Link>
        <nav className="flex gap-6">
          <Link href="/admin" className="label link-underline text-ink-soft">Захиалга</Link>
          <Link href="/admin/inventory" className="label link-underline text-ink-soft">Бараа</Link>
          <Link href="/admin/images" className="label link-underline text-ink-soft">Зураг</Link>
          <Link href="/admin/settings" className="label link-underline text-ink-soft">Тохиргоо</Link>
        </nav>
        <Link href="/" className="label link-underline ml-auto text-ink-faint">Дэлгүүр →</Link>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  )
}
