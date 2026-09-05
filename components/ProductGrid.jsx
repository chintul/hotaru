import ProductCard from './ProductCard'

export default function ProductGrid({ products, cols = 4, emptyMessage = 'Бүтээгдэхүүн олдсонгүй.' }) {
  if (!products?.length) {
    return <p className="py-20 text-center text-ink-soft">{emptyMessage}</p>
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
