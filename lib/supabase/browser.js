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
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    // Anonymous sign-ins are a project setting; if they are off, the cart
    // cannot work. Surface it rather than failing silently on add-to-cart.
    console.error('[auth] anonymous sign-in failed:', error.message)
    return null
  }
  return data.session
}
