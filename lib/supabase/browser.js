'use client'

import { createBrowserClient } from '@supabase/ssr'

let client

/** Single browser client, reused — creating several means several auth listeners. */
export function supabaseBrowser() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
  return client
}

/**
 * Every visitor needs an identity before they can own a server cart.
 *
 * Anonymous sign-in exists purely as cart plumbing: at checkout this same user
 * is upgraded in place to a real account, keeping the SAME uid, so the cart
 * never has to move and there is no merge step. See docs/decisions.md #6.
 */
export async function ensureSession() {
  const supabase = supabaseBrowser()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  // A stored refresh token can outlive its user (account deleted, project
  // reset), and Supabase then 400s on every refresh. Clear it rather than
  // letting the app sit in a half-authenticated state forever.
  if (sessionError) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } else if (session) {
    // getSession only reads the local JWT — it cannot tell that the user behind
    // it was deleted. The token stays validly signed until it expires, so
    // auth.uid() still resolves server-side while the profile row is gone, and
    // the next cart insert fails on carts_profile_id_fkey. getUser() asks the
    // server, which is the only thing that actually knows.
    const { error: userError } = await supabase.auth.getUser()
    if (!userError) return session

    console.warn('[auth] session belongs to a user that no longer exists; starting fresh')
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    // Anonymous sign-ins are a project setting; if they are off, the cart
    // cannot work. Surface it rather than failing silently on add-to-cart.
    console.error('[auth] anonymous sign-in failed:', error.message)
    return null
  }
  return data.session
}
