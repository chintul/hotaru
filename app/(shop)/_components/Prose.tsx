import type { ReactNode } from 'react'

interface ProseProps {
  title: ReactNode
  lead?: ReactNode
  children: ReactNode
}

export default function Prose({ title, lead, children }: ProseProps) {
  return (
    <div className="mx-auto max-w-[760px] px-5 pb-20 pt-12 lg:px-8 lg:pt-16">
      <h1 className="section-title text-[clamp(32px,4.2vw,46px)]">{title}</h1>
      {lead && <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-10 space-y-8 text-[15px] leading-[1.75] text-ink-soft">{children}</div>
    </div>
  )
}

interface BlockProps {
  heading: ReactNode
  children: ReactNode
}

export function Block({ heading, children }: BlockProps) {
  return (
    <section className="border-t border-line pt-7">
      <h2 className="mb-2 text-[18px] font-semibold tracking-[-0.01em] text-primary-strong">{heading}</h2>
      {children}
    </section>
  )
}
