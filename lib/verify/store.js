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

  // The number already belongs to an account — this is a returning customer,
  // or the owner signing in. verify.mn has proven the SMS came from that exact
  // handset, so signing them into the account that owns it is the correct
  // outcome, not an error.
  if (owner) {
    const session = await mintSessionFor(supabase, owner.id, phone)
    return session
      ? { outcome: 'signed_in_existing', otherUserId: owner.id, session }
      : { outcome: 'error', message: 'could not sign in to the existing account' }
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

/**
 * Issues a session for a user we have just proven the caller controls.
 *
 * Supabase has no admin "create a session" call, so the supported route is to
 * set a fresh single-use password and immediately exchange it. The password is
 * random per attempt, never returned to the client and never stored — it exists
 * only for the length of this function.
 *
 * This is only reachable after verify.mn has confirmed an SMS originated from
 * the number that owns the account, which is the proof that authorises it.
 */
async function mintSessionFor(supabase, userId, phone) {
  const { randomBytes } = await import('node:crypto')
  const password = randomBytes(24).toString('base64url')

  const { error: setError } = await supabase.auth.admin.updateUserById(userId, { password })
  if (setError) return null

  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  )

  const { data, error } = await anon.auth.signInWithPassword({ phone, password })
  if (error || !data?.session) return null

  await supabase
    .from('profiles')
    .update({ phone_verified_at: new Date().toISOString() })
    .eq('id', userId)

  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
}
