import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Prose, { Block } from '../_components/Prose'
import { storeContact } from '@/lib/store-contact'
import { IconFacebook, IconInstagram, IconMail, IconPhone, IconPin } from '@/components/Icons'

export const metadata: Metadata = { title: 'Холбоо барих' }

export default async function ContactPage() {
  const contact = await storeContact()

  return (
    <Prose title="Холбоо барих" lead="Ажлын өдрүүдэд 1 ажлын өдрийн дотор хариу өгнө.">
      {!contact.isEmpty && (
        <div className="grid gap-3 sm:grid-cols-2">
          {contact.phone && (
            <Tile icon={<IconPhone />} label="Утас" value={contact.phone} href={contact.phoneHref} mono />
          )}
          {contact.email && (
            <Tile icon={<IconMail />} label="Имэйл" value={contact.email} href={`mailto:${contact.email}`} />
          )}
          {contact.address && (
            <Tile icon={<IconPin />} label="Хаяг" value={contact.address} />
          )}
          {contact.socials.length > 0 && (
            <div className="border border-line p-4">
              <p className="label text-ink-faint">Сошиал</p>
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

      <Block heading="Захиалгын талаар">
        <p>
          Захиалгын дугаараа бэлдээд бичнэ үү — <Link href="/orders" className="link-underline text-ink">миний захиалга</Link>{' '}
          хуудсанд байгаа. Төлбөр баталгаажаагүй байвал захиалгын хуудсан дээрх дансны мэдээллийг
          дахин шалгана уу.
        </p>
      </Block>
      <Block heading="Бөөний захиалга">
        <p>
          Хамтран ажиллах, бөөний захиалгын саналыг
          {contact.email ? (
            <> <a href={`mailto:${contact.email}`} className="link-underline text-ink">{contact.email}</a> хаягаар</>
          ) : ' имэйлээр'}{' '}
          хүлээн авна.
        </p>
      </Block>
    </Prose>
  )
}

interface TileProps {
  icon: ReactNode
  label: string
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
