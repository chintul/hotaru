'use client'

import { useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'
import { CART_HANDOFF_KEY } from './CartHandoff'

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z" />
  </svg>
)

const AppleMark = () => (
  <svg viewBox="0 0 16 20" width="16" height="18" fill="currentColor" aria-hidden="true">
    <path d="M13.3 10.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.2.8-.6 0-1.7-.7-2.8-.7-1.4 0-2.7.8-3.5 2.1-1.5 2.6-.4 6.4 1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.7 2.7-.7s1.6.7 2.7.65c1.1-.02 1.8-1 2.5-2a9 9 0 0 0 1.1-2.3c-.03-.01-2.2-.85-2.2-3.4ZM11.2 3.9c.6-.7 1-1.7.9-2.7-.85.04-1.9.57-2.5 1.28-.55.62-1.03 1.63-.9 2.6.95.07 1.92-.48 2.5-1.18Z" />
  </svg>
)

/**
 * Social sign-in.
 *
 * Wired to Supabase OAuth rather than stubbed: turning these on later is a
 * dashboard switch plus one env var, not a code change.
 *
 * Gated on NEXT_PUBLIC_OAUTH_PROVIDERS because signInWithOAuth cannot fail
 * gracefully: it does not return an error, it NAVIGATES to Supabase, which
 * answers `{"code":400,"msg":"Unsupported provider: provider is not enabled"}`
 * as raw JSON. A client-side try/catch never runs. So an un-enabled provider is
 * rendered disabled rather than being allowed to dump the shopper on an error
 * page mid-checkout.
 *
 * OAuth navigates away, so the cart handoff token is minted BEFORE the redirect
 * and parked in sessionStorage — component state does not survive the round
 * trip, and a shopper who signs in with Google mid-basket must not lose it.
 */
const ENABLED = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? '')
  .split(',')
  .map((p) => p.trim().toLowerCase())
  .filter(Boolean)

/**
 * Whether any provider is on, so the login page can drop the "эсвэл" divider
 * instead of leaving it hanging over nothing.
 */
export const hasOAuth = ENABLED.length > 0

export default function OAuthButtons({ next = '/account' }) {
  const apollo = useApolloClient()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const isEnabled = (provider) => ENABLED.includes(provider)

  const start = async (provider) => {
    if (!isEnabled(provider)) return
    setError(null)
    setBusy(provider)
    try {
      await ensureSession()
      try {
        const t = await apollo.mutate({ mutation: ISSUE_CART_TRANSFER })
        const token = t.data?.issueCartTransferToken
        if (token) sessionStorage.setItem(CART_HANDOFF_KEY, token)
      } catch { /* empty cart, nothing to carry */ }

      // Back through /auth/callback, not straight to `next`: PKCE returns a
      // code that has to be exchanged for a session by something that can
      // write cookies. The destination rides along as a query param.
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) throw error
      // On success the browser navigates away; nothing after this runs.
    } catch (e) {
      setBusy(null)
      const message = String(e?.message ?? '')
      setError(
        message.toLowerCase().includes('not enabled')
          ? `${provider === 'google' ? 'Google' : 'Apple'}-ээр нэвтрэх түр боломжгүй байна.`
          : message || 'Нэвтэрч чадсангүй.',
      )
    }
  }

  // An un-enabled provider is not rendered at all, rather than rendered greyed
  // out under a "(удахгүй)" label. A dead button is a worse answer than no
  // button: it takes up the same room, invites the same click, and tells the
  // shopper about a feature they cannot have. Adding the provider back to
  // NEXT_PUBLIC_OAUTH_PROVIDERS brings the button back with no code change.
  if (!hasOAuth) return null

  return (
    <div>
      <div className="space-y-2.5">
        {isEnabled('google') && (
          <button
            onClick={() => start('google')}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-paper py-3.5 text-[14px] font-medium transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line"
          >
            <GoogleMark />
            {busy === 'google' ? 'Түр хүлээнэ үү…' : 'Google-ээр үргэлжлүүлэх'}
          </button>
        )}

        {isEnabled('apple') && (
          <button
            onClick={() => start('apple')}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink-strong py-3.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <AppleMark />
            {busy === 'apple' ? 'Түр хүлээнэ үү…' : 'Apple-ээр үргэлжлүүлэх'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
    </div>
  )
}
