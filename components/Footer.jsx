import Link from 'next/link'

const COLUMNS = [
  {
    title: 'Дэлгүүр',
    links: [
      { href: '/shop', label: 'Бүх бүтээгдэхүүн' },
      { href: '/shop?c=bags', label: 'Цүнх' },
      { href: '/shop?c=drinkware', label: 'Аяга сав' },
      { href: '/shop?c=accessories', label: 'Хэрэглэл' },
      { href: '/shop?c=jewelry', label: 'Гоёл чимэглэл' },
    ],
  },
  {
    title: 'Мэдээлэл',
    links: [
      { href: '/about', label: 'Бидний тухай' },
      { href: '/contact', label: 'Холбоо барих' },
    ],
  },
  {
    title: 'Үйлчилгээ',
    links: [
      { href: '/shipping', label: 'Хүргэлтийн нөхцөл' },
      { href: '/returns', label: 'Буцаалт, солилт' },
      { href: '/faq', label: 'Түгээмэл асуулт' },
      { href: '/orders', label: 'Захиалга хянах' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="mt-20 bg-footer text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-16 lg:grid-cols-4 lg:px-8">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="nav-link text-white">{col.title}</h3>
            <ul className="mt-5 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-[13px] text-white/70 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="nav-link text-white">Мэдээлэл авах</h3>
          <p className="mt-5 text-[13px] text-white/70">
            Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээллийг хамгийн түрүүнд аваарай.
          </p>
          <form className="mt-4 flex" action="/api/newsletter" method="post">
            <input
              type="email"
              name="email"
              required
              placeholder="Имэйл хаяг"
              className="min-w-0 flex-1 border border-white/25 bg-transparent px-3 py-3 text-[13px] placeholder:text-white/40 focus:border-white focus:outline-none"
            />
            <button type="submit" className="bg-white px-5 py-3 text-[13px] font-bold uppercase tracking-[0.7px] text-ink-strong">
              Илгээх
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 lg:px-8">
          <p className="text-[12px] text-white/50">© {new Date().getFullYear()} hotaru</p>
          <p className="text-[12px] text-white/50">Дансаар шилжүүлж төлнө · Улаанбаатар</p>
        </div>
      </div>
    </footer>
  )
}
