/**
 * Service-role client for the verification routes.
 *
 * phone_verifications has RLS on with no policy, so only a role that bypasses
 * RLS can touch it. That is deliberate: a phone/code pair should never be
 * readable by a client, not even its owner. QPay needs the same client, so it
 * now lives in lib/supabase/admin.js and is re-exported here for the callers
 * that already import it from this module.
 */
export { adminClient } from '../supabase/admin.js'

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
  // Ask the database which account owns this number rather than paging through
  // every user and scanning in JS: that was capped at one page of 1000, so past
  // that the owner silently stopped being found and the attach branch below
  // would fail on the unique phone constraint instead.
  const { data: ownerId, error: lookupError } = await supabase.rpc('find_user_id_by_phone', {
    p_phone: phone,
  })
  if (lookupError) {
    return { outcome: 'error', message: `owner lookup failed: ${lookupError.message}` }
  }

  // The number already belongs to an account — this is a returning customer,
  // or the owner signing in. verify.mn has proven the SMS came from that exact
  // handset, so signing them into the account that owns it is the correct
  // outcome, not an error.
  if (ownerId && ownerId !== userId) {
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
    .update({ phone, phone_verified_at: new Date().toISOString() })
    .eq('id', userId)

  return { outcome: 'attached' }
}

/**
 * A login-only address for an account that has only ever used its phone.
 *
 * `.invalid` is reserved by RFC 2606 and can never resolve, so this can never
 * reach a stranger's inbox. It is a login identity, not a contact address:
 * 20260906090000_phone_signin_support.sql keeps it out of profiles.email so
 * order mail is never addressed to it.
 */
export function placeholderEmailFor(phone) {
  return `${String(phone).replace(/\D/g, '')}@phone.hotaru.invalid`
}

/**
 * Issues a session for a user we have just proven the caller controls.
 *
 * Supabase has no admin "create a session" call. This used to set a throwaway
 * password and exchange it with signInWithPassword({ phone }) — which could
 * never work here, because SMS goes through verify.mn and GoTrue's phone
 * provider is therefore disabled, so every one of those calls came back 422
 * phone_provider_disabled. It also rewrote the account's password on each
 * attempt for nothing.
 *
 * The email channel is enabled, and admin.generateLink issues a token without
 * sending anything, so the session is minted there instead and the account's
 * credentials are left alone. An account that has only signed in by phone has
 * no address, so it gets a placeholder one.
 *
 * Only reachable once verify.mn has confirmed an SMS originated from the
 * number that owns the account, which is the proof that authorises it.
 */
async function mintSessionFor(supabase, userId, phone) {
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
  if (userError || !userData?.user) return null

  // Supabase returns '' rather than null for an absent address, so `??` would
  // happily pick the empty string here.
  let email = userData.user.email || null

  if (!email) {
    email = placeholderEmailFor(phone)
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    })
    if (error) return null
  }

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) return null

  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  )

  const { data, error } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error || !data?.session) return null

  await supabase
    .from('profiles')
    .update({ phone_verified_at: new Date().toISOString() })
    .eq('id', userId)

  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
}
