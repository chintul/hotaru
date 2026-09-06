import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Where an OAuth provider drops the shopper on the way back.
 *
 * Supabase's browser client uses the PKCE flow, so the provider returns a
 * one-time `code` rather than a session. That code has to be exchanged, and the
 * exchange has to happen somewhere that can WRITE cookies — a server component
 * cannot, so a landing page would leave the first render logged-out and the
 * session would only appear after the client caught up. A route handler sets
 * the auth cookies before the redirect, so the page the shopper lands on is
 * already signed in.
 *
 * The code_verifier that pairs with the code was stored as a cookie by
 * @supabase/ssr on the way out, which is why this route can complete an
 * exchange it did not start.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only ever redirect within this site. `next` arrives from a query string,
  // so an absolute or protocol-relative value would turn the sign-in link into
  // an open redirect — a phishing primitive worth more than the account.
  const requested = searchParams.get('next') ?? '/account'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/account'

  // Behind Vercel's proxy the request origin is the internal host, so a
  // redirect built from it would leave the shopper on a URL that is not the
  // shop. The forwarded host is the one the browser actually asked for.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const base =
    process.env.NODE_ENV === 'development' || !forwardedHost ? origin : `https://${forwardedHost}`

  if (code) {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
    console.error('[auth] oauth code exchange failed:', error.message)
  }

  // A denied consent screen comes back with `error`, not `code`. Either way the
  // shopper goes back to sign-in with something to read, not to a blank page.
  return NextResponse.redirect(`${base}/login?oauth=failed&next=${encodeURIComponent(next)}`)
}
