import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-warm">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
        <div>
          <p className="display text-[17px] tracking-[0.28em] uppercase">hotaru</p>
          <p className="mt-3 max-w-xs text-ink-soft">
            Гар аргаар хийсэн, өдөр тутам зүүх энгийн гоёл чимэглэл.
          </p>
        </div>
        <div>
          <p className="label text-ink-faint">Дэлгүүр</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/shop" className="link-underline text-ink-soft">Бүх бүтээгдэхүүн</Link></li>
            <li><Link href="/wishlist" className="link-underline text-ink-soft">Хадгалсан</Link></li>
          </ul>
        </div>
        <div>
          <p className="label text-ink-faint">Захиалга</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/orders" className="link-underline text-ink-soft">Миний захиалга</Link></li>
            <li><Link href="/account" className="link-underline text-ink-soft">Профайл</Link></li>
          </ul>
        </div>
        <div>
          <p className="label text-ink-faint">Төлбөр</p>
          <p className="mt-3 text-ink-soft">
            Дансаар шилжүүлэн төлнө. Захиалга өгсний дараа дансны мэдээлэл харагдана.
          </p>
        </div>
      </div>
      <div className="border-t border-line px-5 py-5 sm:px-8">
        <p className="label mx-auto max-w-[1400px] text-ink-faint">
          © {new Date().getFullYear()} hotaru
        </p>
      </div>
    </footer>
  )
}
