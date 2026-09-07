import Link from 'next/link'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, cols = 4, emptyMessage = 'Бүтээгдэхүүн олдсонгүй.' }) {
  if (!products?.length) {
    // Was a grey sentence and nothing else. On a phone the filters that
    // produced the empty result are now behind a sheet, so the way out has to
    // be here rather than 800px up the page.
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{emptyMessage}</p>
        <p className="mt-1 text-[13px] text-ink-faint">Шүүлтүүрээ өөрчилж үзнэ үү.</p>
        <Link href="/shop" className="label link-underline mt-5 inline-block">
          Бүх бүтээгдэхүүн харах
        </Link>
      </div>
    )
  }
  const grid =
    cols === 3
      ? 'grid-cols-2 md:grid-cols-3'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  return (
    <div className={`grid gap-x-5 gap-y-12 ${grid}`}>
      {products.map((p, i) => (
        <div key={p.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  )
}
