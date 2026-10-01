import type { ReactNode } from 'react'

interface ProseProps {
  title: ReactNode
  lead?: ReactNode
  children: ReactNode
}

export default function Prose({ title, lead, children }: ProseProps) {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-14 lg:px-8">
      <h1 className="section-title uppercase">{title}</h1>
      {lead && <p className="mx-auto mt-3 max-w-xl text-center text-[14px] text-ink-soft">{lead}</p>}
      <div className="mt-10 space-y-7 text-[14px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  )
}

interface BlockProps {
  heading: ReactNode
  children: ReactNode
}

export function Block({ heading, children }: BlockProps) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-bold text-ink">{heading}</h2>
      {children}
    </section>
  )
}
