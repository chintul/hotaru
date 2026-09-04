import ProductCard from './ProductCard'

export default function ProductGrid({ products, emptyMessage = 'Бүтээгдэхүүн олдсонгүй.' }) {
  if (!products?.length) {
    return <p className="py-20 text-center text-ink-soft">{emptyMessage}</p>
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {products.map((p, i) => (
        <div key={p.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  )
}
