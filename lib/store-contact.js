import { safeQuery } from '@/lib/apollo/safeQuery'
import { STORE_CONTACT } from '@/lib/queries'
import { nodes } from '@/lib/format'

/**
 * How the shop can be reached.
 *
 * Read from store_settings rather than hardcoded, for the same reason the
 * payment copy is: the owner edits these at /admin and a phone number in a
 * component would need a deploy to change — and would then disagree with the
 * one the email footers already read out of this table.
 *
 * The seed ships deliberate REPLACE_ME placeholders. Rendering one in the
 * footer of a live shop is worse than rendering nothing, so anything still
 * carrying the marker is dropped here, once, instead of being guarded at every
 * call site.
 */
const real = (v) => {
  const s = String(v ?? '').trim()
  return s && !s.includes('REPLACE_ME') ? s : null
}

export async function storeContact() {
  const { data } = await safeQuery(STORE_CONTACT)
  const row = nodes(data?.storeSettingsCollection)[0] ?? {}

  const email = real(row.storeEmail)
  const phone = real(row.storePhone)
  const address = real(row.storeAddress)
  const facebook = real(row.facebookUrl)
  const instagram = real(row.instagramUrl)

  return {
    email,
    phone,
    address,
    facebook,
    instagram,
    // tel: must not contain spaces or dashes; the display form keeps them.
    phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null,
    socials: [
      facebook && { key: 'facebook', label: 'Facebook', href: facebook },
      instagram && { key: 'instagram', label: 'Instagram', href: instagram },
    ].filter(Boolean),
    // True when there is nothing to show at all, so a caller can drop the whole
    // block rather than render an empty heading.
    isEmpty: !email && !phone && !address && !facebook && !instagram,
  }
}
