import Link from 'next/link'

/** Centred uppercase heading with a small underlined "View all" beneath it. */
export default function SectionHeading({ title, href, cta = 'Бүгдийг үзэх' }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="section-title uppercase">{title}</h2>
      {href && (
        <Link href={href} className="link-underline mt-2 inline-block text-[13px] text-ink">
          {cta}
        </Link>
      )}
    </div>
  )
}
