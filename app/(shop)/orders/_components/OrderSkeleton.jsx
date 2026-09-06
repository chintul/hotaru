/**
 * Loading state for the order page.
 *
 * Shaped like the real page rather than a spinner: this route is opened from an
 * email the moment an order is placed, and a layout that keeps still while it
 * fills in reads as fast, where a centred spinner that then jumps to a full
 * page reads as slow.
 */
export default function OrderSkeleton() {
  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Захиалга ачааллаж байна…</span>

      <div className="o-skeleton h-3.5 w-28" />

      <div className="o-card o-card-warm mt-4 p-5 sm:p-7">
        <div className="o-skeleton h-3 w-24" />
        <div className="o-skeleton mt-3 h-8 w-52" />
        <div className="o-skeleton mt-4 h-3.5 w-40" />
      </div>

      <div className="o-card mt-4 px-5 py-6">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="o-skeleton h-6 w-6 rounded-full" />
              <div className="o-skeleton h-2.5 w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className="o-card mt-4 p-5 sm:p-6">
        <div className="o-skeleton h-3 w-32" />
        <div className="o-skeleton mt-3 h-8 w-36" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="o-skeleton h-[92px] rounded-[18px]" />
          <div className="o-skeleton h-[92px] rounded-[18px]" />
        </div>
      </div>

      <div className="o-card mt-4 p-5 sm:p-6">
        <div className="o-skeleton h-3 w-20" />
        <ul className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4">
              <div className="o-skeleton h-16 w-16 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="o-skeleton h-3.5 w-2/5" />
                <div className="o-skeleton mt-2 h-3 w-1/4" />
              </div>
              <div className="o-skeleton h-3.5 w-16" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
