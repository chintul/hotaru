import Link from 'next/link'
import NewsletterForm from './NewsletterForm'
import { paymentCopy } from '@/lib/payment-copy'
import { storeContact } from '@/lib/store-contact'
import { IconFacebook, IconInstagram, IconMail, IconPhone, IconPin } from './Icons'

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

export default async function Footer() {
  // Two independent reads of the same singleton row; they run together rather
  // than one after the other so the footer costs one round trip, not two.
  const [pay, contact] = await Promise.all([paymentCopy(), storeContact()])

  return (
    <footer className="mt-20 bg-footer text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-6 lg:px-8">
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

        {/* Nothing here is hardcoded: every line is dropped when the owner has
            not filled that field in at /admin, so the footer never advertises a
            placeholder address or a dead social link. */}
        {!contact.isEmpty && (
          <div>
            <h3 className="nav-link text-white">Холбоо барих</h3>
            <ul className="mt-5 space-y-3">
              {contact.phone && (
                <li>
                  <a href={contact.phoneHref}
                    className="flex items-start gap-2.5 text-[13px] text-white/70 transition-colors hover:text-white">
                    <IconPhone className="mt-px shrink-0 opacity-70" width="16" height="16" />
                    <span className="tabular-nums">{contact.phone}</span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`}
                    className="flex items-start gap-2.5 text-[13px] text-white/70 transition-colors hover:text-white">
                    <IconMail className="mt-px shrink-0 opacity-70" width="16" height="16" />
                    <span className="break-all">{contact.email}</span>
                  </a>
                </li>
              )}
              {contact.address && (
                <li className="flex items-start gap-2.5 text-[13px] text-white/70">
                  <IconPin className="mt-px shrink-0 opacity-70" width="16" height="16" />
                  <span>{contact.address}</span>
                </li>
              )}
            </ul>

            {contact.socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {contact.socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white hover:text-white"
                  >
                    {s.key === 'facebook' ? <IconFacebook /> : <IconInstagram />}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lg:col-span-2">
          <h3 className="nav-link text-white">Мэдээлэл авах</h3>
          <p className="mt-5 text-[13px] text-white/70">
            Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээллийг хамгийн түрүүнд аваарай.
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 lg:px-8">
          <p className="text-[12px] text-white/50">© {new Date().getFullYear()} hotaru</p>
          <p className="text-[12px] text-white/50">{pay.short} · Улаанбаатар</p>
        </div>
      </div>
    </footer>
  )
}
