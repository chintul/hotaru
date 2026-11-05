import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Prose, { Block } from '../_components/Prose'
import { storeContact } from '@/lib/store-contact'
import { IconFacebook, IconInstagram, IconMail, IconPhone, IconPin } from '@/components/Icons'
import { T } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Холбоо барих' }

export default async function ContactPage() {
  const contact = await storeContact()

  return (
    <Prose
      title={<T mn="Холбоо барих" en="Contact us" />}
      lead={<T mn="Ажлын өдрүүдэд 1 ажлын өдрийн дотор хариу өгнө." en="On working days we reply within one working day." />}
    >
      {!contact.isEmpty && (
        <div className="grid gap-3 sm:grid-cols-2">
          {contact.phone && (
            <Tile icon={<IconPhone />} label={<T mn="Утас" en="Phone" />} value={contact.phone} href={contact.phoneHref} mono />
          )}
          {contact.email && (
            <Tile icon={<IconMail />} label={<T mn="Имэйл" en="Email" />} value={contact.email} href={`mailto:${contact.email}`} />
          )}
          {contact.address && (
            <Tile icon={<IconPin />} label={<T mn="Хаяг" en="Address" />} value={contact.address} />
          )}
          {contact.socials.length > 0 && (
            <div className="border border-line p-4">
              <p className="label text-ink-faint"><T mn="Сошиал" en="Social" /></p>
              <div className="mt-2.5 flex gap-2">
                {contact.socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 border border-line px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink"
                  >
                    {s.key === 'facebook' ? <IconFacebook /> : <IconInstagram />}
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Block heading={<T mn="Захиалгын талаар" en="About an order" />}>
        <p>
          <T
            mn={<>Захиалгын дугаараа бэлдээд бичнэ үү — <Link href="/orders" className="link-underline text-ink">миний захиалга</Link>{' '}хуудсанд байгаа. Төлбөр баталгаажаагүй байвал захиалгын хуудсан дээрх дансны мэдээллийг дахин шалгана уу.</>}
            en={<>Have your order number ready; you can find it on the <Link href="/orders" className="link-underline text-ink">my orders</Link> page. If your payment is not confirmed yet, check the account details on the order page again.</>}
          />
        </p>
      </Block>
      <Block heading={<T mn="Бөөний захиалга" en="Wholesale" />}>
        <p>
          {contact.email ? (
            <T
              mn={<>Хамтран ажиллах, бөөний захиалгын саналыг <a href={`mailto:${contact.email}`} className="link-underline text-ink">{contact.email}</a> хаягаар хүлээн авна.</>}
              en={<>For partnerships and wholesale orders, write to <a href={`mailto:${contact.email}`} className="link-underline text-ink">{contact.email}</a>.</>}
            />
          ) : (
            <T mn="Хамтран ажиллах, бөөний захиалгын саналыг имэйлээр хүлээн авна." en="For partnerships and wholesale orders, write to us by email." />
          )}
        </p>
      </Block>
    </Prose>
  )
}

interface TileProps {
  icon: ReactNode
  label: ReactNode
  value: string
  href?: string | null
  mono?: boolean
}

function Tile({ icon, label, value, href, mono = false }: TileProps) {
  const body = (
    <>
      <p className="label flex items-center gap-2 text-ink-faint">
        <span className="text-ink-soft">{icon}</span>
        {label}
      </p>
      <p className={`mt-2 break-words text-[15px] font-medium text-ink ${mono ? 'tabular-nums' : ''}`}>{value}</p>
    </>
  )
  return href ? (
    <a href={href} className="border border-line p-4 transition-colors hover:border-ink">{body}</a>
  ) : (
    <div className="border border-line p-4">{body}</div>
  )
}
