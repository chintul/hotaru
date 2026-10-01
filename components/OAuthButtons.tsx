'use client'

import { useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'
import { CART_HANDOFF_KEY } from './CartHandoff'
import { Button } from '@/components/ui/button'

type OAuthProvider = 'google' | 'apple'

interface IssueCartTransferData {
  issueCartTransferToken: string | null
}

interface OAuthButtonsProps {
  next?: string
}

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

const ENABLED_PROVIDERS = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? '')
  .split(',')
  .map((p) => p.trim().toLowerCase())
  .filter(Boolean)

export const hasOAuth = ENABLED_PROVIDERS.length > 0

const isEnabled = (provider: OAuthProvider) => ENABLED_PROVIDERS.includes(provider)

const PROVIDER_NAME: Record<OAuthProvider, string> = { google: 'Google', apple: 'Apple' }

const messageOf = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'message' in e ? String(e.message ?? '') : ''

export default function OAuthButtons({ next = '/account' }: OAuthButtonsProps) {
  const apollo = useApolloClient()
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parkCartForRedirect = async () => {
    try {
      const { data } = await apollo.mutate<IssueCartTransferData>({ mutation: ISSUE_CART_TRANSFER })
      const token = data?.issueCartTransferToken
      if (token) sessionStorage.setItem(CART_HANDOFF_KEY, token)
    } catch {}
  }

  const start = async (provider: OAuthProvider) => {
    if (!isEnabled(provider)) return
    setError(null)
    setBusy(provider)
    try {
      await ensureSession()
      await parkCartForRedirect()

      const supabase = await supabaseBrowser()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (oauthError) throw oauthError
    } catch (e) {
      setBusy(null)
      const message = messageOf(e)
      setError(
        message.toLowerCase().includes('not enabled')
          ? `${PROVIDER_NAME[provider]}-ээр нэвтрэх түр боломжгүй байна.`
          : message || 'Нэвтэрч чадсангүй.',
      )
    }
  }

  if (!hasOAuth) return null

  return (
    <div>
      <div className="space-y-2.5">
        {isEnabled('google') && (
          <Button
            variant="outline"
            onClick={() => start('google')}
            disabled={busy !== null}
            className="h-12.5 w-full gap-2.5 rounded-full border-line text-[14px] hover:border-ink hover:bg-background disabled:opacity-45"
          >
            <GoogleMark />
            {busy === 'google' ? 'Түр хүлээнэ үү…' : 'Google-ээр үргэлжлүүлэх'}
          </Button>
        )}

        {isEnabled('apple') && (
          <Button
            onClick={() => start('apple')}
            disabled={busy !== null}
            className="h-12.5 w-full gap-2.5 rounded-full bg-ink-strong text-[14px] text-on-ink hover:bg-ink-strong hover:opacity-90 disabled:opacity-45"
          >
            <AppleMark />
            {busy === 'apple' ? 'Түр хүлээнэ үү…' : 'Apple-ээр үргэлжлүүлэх'}
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
    </div>
  )
}
