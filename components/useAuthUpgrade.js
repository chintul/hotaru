'use client'

import { useCallback, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'

/**
 * Turn the visitor into a real account without losing their cart.
 *
 * Happy path: the visitor is an anonymous user, so updateUser() links an email
 * to that SAME uid. The cart never moves and there is nothing to merge.
 *
 * The awkward path is a returning customer whose email already has an account.
 * Supabase refuses to link it, so they must sign in to the existing account —
 * a different uid, which would strand the cart. Hence: mint a single-use
 * transfer token BEFORE signing out of the anonymous session, then redeem it
 * afterwards. The token is why this never takes a profile id as an argument
 * (that would let anyone drain anyone's cart).
 */
export function useAuthUpgrade() {
  const apollo = useApolloClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const upgrade = useCallback(async ({ email, password }) => {
    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()
    try {
      await ensureSession()
      const { data: { session } } = await supabase.auth.getSession()
      const wasAnonymous = Boolean(session?.user?.is_anonymous)

      // Mint the escape hatch while we still own the anonymous cart.
      let transferToken = null
      if (wasAnonymous) {
        try {
          const res = await apollo.mutate({ mutation: ISSUE_CART_TRANSFER })
          transferToken = res.data?.issueCartTransferToken ?? null
        } catch {
          // An empty cart has no token to mint. Not fatal.
        }
      }

      if (wasAnonymous) {
        const { error: linkError } = await supabase.auth.updateUser({ email, password })
        if (!linkError) {
          // CRITICAL: updateUser converts the user but does NOT reissue the JWT.
          // The old token still claims is_anonymous: true, so every RLS policy
          // that checks it — creating an address, placing an order — keeps
          // treating this now-real customer as anonymous and refuses them.
          // Refreshing mints a token that reflects who they actually are.
          await supabase.auth.refreshSession()
          await apollo.resetStore()
          return { ok: true, converted: true }
        }
        // Email already belongs to someone: fall through to sign-in + transfer.
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        // Not an existing account either — create a fresh one.
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
      }

      if (transferToken) {
        try {
          await apollo.mutate({ mutation: REDEEM_CART_TRANSFER, variables: { token: transferToken } })
        } catch (e) {
          console.error('[cart] transfer failed:', e?.message)
        }
      }
      await apollo.resetStore()
      return { ok: true, converted: false }
    } catch (e) {
      const message = e?.message ?? 'Нэвтрэхэд алдаа гарлаа.'
      setError(message)
      return { ok: false, message }
    } finally {
      setBusy(false)
    }
  }, [apollo])

  const signOut = useCallback(async () => {
    await supabaseBrowser().auth.signOut()
    await apollo.resetStore()
  }, [apollo])

  return { upgrade, signOut, busy, error, setError }
}
