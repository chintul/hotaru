import { createClient } from '@supabase/supabase-js'
import type { AdminClient } from '../supabase/admin.ts'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../env.ts'

export { adminClient } from '../supabase/admin.ts'

export type VerificationStatus = 'pending' | 'verified' | 'expired' | 'failed'

export interface PhoneVerificationRow {
  id: string
  session_id: string
  phone: string
  profile_id: string | null
  status: VerificationStatus
  code: string | null
  verified_at: string | null
  expires_at: string
  created_at: string
}

export interface NewVerificationSession {
  sessionId: string
  phone: string
  profileId?: string | null
  code: string
  expiresAt: string
}

export interface MintedSession {
  access_token: string
  refresh_token: string
}

export type AttachResult =
  | { outcome: 'attached'; session?: undefined }
  | { outcome: 'signed_in_existing'; otherUserId: string; session: MintedSession }
  | { outcome: 'error'; message: string; session?: undefined }

const now = (): string => new Date().toISOString()

export async function recordSession(
  supabase: AdminClient,
  { sessionId, phone, profileId, code, expiresAt }: NewVerificationSession,
): Promise<void> {
  const { error } = await supabase.from('phone_verifications').insert({
    session_id: sessionId,
    phone,
    profile_id: profileId ?? null,
    code,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`could not record verification session: ${error.message}`)
}

export async function findSession(
  supabase: AdminClient,
  sessionId: string,
): Promise<PhoneVerificationRow | null> {
  const { data } = await supabase
    .from('phone_verifications')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle<PhoneVerificationRow>()
  return data
}

export async function markSession(
  supabase: AdminClient,
  sessionId: string,
  status: VerificationStatus,
): Promise<void> {
  await supabase
    .from('phone_verifications')
    .update({ status, verified_at: status === 'verified' ? now() : null })
    .eq('session_id', sessionId)
}

export async function attachPhoneToUser(
  supabase: AdminClient,
  { userId, phone }: { userId: string; phone: string },
): Promise<AttachResult> {
  const { data: ownerId, error: lookupError } = await supabase.rpc('find_user_id_by_phone', {
    p_phone: phone,
  })
  if (lookupError) {
    return { outcome: 'error', message: `owner lookup failed: ${lookupError.message}` }
  }

  if (typeof ownerId === 'string' && ownerId && ownerId !== userId) {
    const session = await mintSessionFor(supabase, ownerId, phone)
    return session
      ? { outcome: 'signed_in_existing', otherUserId: ownerId, session }
      : { outcome: 'error', message: 'could not sign in to the existing account' }
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    phone,
    phone_confirm: true,
  })
  if (error) return { outcome: 'error', message: error.message }

  await supabase
    .from('profiles')
    .update({ phone, phone_verified_at: now() })
    .eq('id', userId)

  return { outcome: 'attached' }
}

export function placeholderEmailFor(phone: string): string {
  return `${String(phone).replace(/\D/g, '')}@phone.hotaru.invalid`
}

async function loginEmailFor(supabase: AdminClient, userId: string, phone: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return null

  const existing = data.user.email || null
  if (existing) return existing

  const placeholder = placeholderEmailFor(phone)
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    email: placeholder,
    email_confirm: true,
  })
  return updateError ? null : placeholder
}

async function mintSessionFor(supabase: AdminClient, userId: string, phone: string): Promise<MintedSession | null> {
  const email = await loginEmailFor(supabase, userId, phone)
  if (!email) return null

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) return null

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

  const { data, error } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error || !data?.session) return null

  await supabase
    .from('profiles')
    .update({ phone_verified_at: now() })
    .eq('id', userId)

  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
}
