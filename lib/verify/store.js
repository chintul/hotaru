import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client for the verification routes.
 *
 * phone_verifications has RLS on with no policy, so only a role that bypasses
 * RLS can touch it. That is deliberate: a phone/code pair should never be
 * readable by a client, not even its owner.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  })
}

export async function recordSession(supabase, { sessionId, phone, profileId, code, expiresAt }) {
  const { error } = await supabase.from('phone_verifications').insert({
    session_id: sessionId,
    phone,
    profile_id: profileId ?? null,
    code,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`could not record verification session: ${error.message}`)
}

export async function findSession(supabase, sessionId) {
  const { data } = await supabase
    .from('phone_verifications')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  return data
}

export async function markSession(supabase, sessionId, status) {
  await supabase
    .from('phone_verifications')
    .update({ status, verified_at: status === 'verified' ? new Date().toISOString() : null })
    .eq('session_id', sessionId)
}

/**
 * Attaches the proven number to the account.
 *
 * The anonymous case is the important one: updating the EXISTING user keeps the
 * same uid, so the cart they have been filling survives untouched — exactly the
 * property the email flow relies on. Only a phone that already belongs to a
 * different account forces a switch, and the caller handles the cart handoff.
 */
export async function attachPhoneToUser(supabase, { userId, phone }) {
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const owner = existing?.users?.find((u) => u.phone === phone && u.id !== userId)

  if (owner) {
    return { outcome: 'belongs_to_other', otherUserId: owner.id }
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    phone,
    phone_confirm: true,
  })
  if (error) return { outcome: 'error', message: error.message }

  await supabase
    .from('profiles')
    .update({ phone, phone_verified_at: new Date().toISOString() })
    .eq('id', userId)

  return { outcome: 'attached' }
}
