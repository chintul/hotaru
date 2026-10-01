import { safeQuery } from './apollo/safeQuery.ts'
import { STORE_CONTACT } from './queries.ts'
import { firstNode } from './format.ts'
import type { Connection, StoreSettings } from './types.ts'

export interface SocialLink {
  key: 'facebook' | 'instagram'
  label: string
  href: string
}

export interface StoreContact {
  email: string | null
  phone: string | null
  address: string | null
  facebook: string | null
  instagram: string | null
  phoneHref: string | null
  socials: SocialLink[]
  isEmpty: boolean
}

const PLACEHOLDER_MARKER = 'REPLACE_ME'

const publishable = (value: string | null | undefined): string | null => {
  const s = String(value ?? '').trim()
  return s && !s.includes(PLACEHOLDER_MARKER) ? s : null
}

const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

export async function storeContact(): Promise<StoreContact> {
  const { data } = await safeQuery<{ storeSettingsCollection: Connection<StoreSettings> | null }>(STORE_CONTACT)
  const row: StoreSettings = firstNode(data?.storeSettingsCollection) ?? {}

  const email = publishable(row.storeEmail)
  const phone = publishable(row.storePhone)
  const address = publishable(row.storeAddress)
  const facebook = publishable(row.facebookUrl)
  const instagram = publishable(row.instagramUrl)

  const socials: SocialLink[] = []
  if (facebook) socials.push({ key: 'facebook', label: 'Facebook', href: facebook })
  if (instagram) socials.push({ key: 'instagram', label: 'Instagram', href: instagram })

  return {
    email,
    phone,
    address,
    facebook,
    instagram,
    phoneHref: phone ? telHref(phone) : null,
    socials,
    isEmpty: !email && !phone && !address && !facebook && !instagram,
  }
}
