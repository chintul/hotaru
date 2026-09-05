/** Shared shell for the static content pages. */
export default function Prose({ title, lead, children }) {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-14 lg:px-8">
      <h1 className="section-title uppercase">{title}</h1>
      {lead && <p className="mx-auto mt-3 max-w-xl text-center text-[14px] text-ink-soft">{lead}</p>}
      <div className="mt-10 space-y-7 text-[14px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  )
}

export function Block({ heading, children }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-bold text-ink">{heading}</h2>
      {children}
    </section>
  )
}
