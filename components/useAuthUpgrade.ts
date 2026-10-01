'use client'

import { useCallback, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'
import type { Cart } from '@/lib/types'
import { errorMessage, messageOf } from '@/lib/errors'

interface IssueCartTransferData {
  issueCartTransferToken: string | null
}

interface RedeemCartTransferData {
  redeemCartTransfer: Cart | null
}

interface RedeemCartTransferVars {
  token: string
}

export interface UpgradeCredentials {
  email: string
  password: string
}

export type UpgradeResult =
  | { ok: true; converted: boolean }
  | { ok: false; message: string }

export function useAuthUpgrade() {
  const apollo = useApolloClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upgrade = useCallback(async ({ email, password }: UpgradeCredentials): Promise<UpgradeResult> => {
    setBusy(true)
    setError(null)
    const supabase = await supabaseBrowser()
    try {
      await ensureSession()
      const { data: { session } } = await supabase.auth.getSession()
      const wasAnonymous = Boolean(session?.user?.is_anonymous)

      let transferToken: string | null = null
      if (wasAnonymous) {
        transferToken = await apollo
          .mutate<IssueCartTransferData>({ mutation: ISSUE_CART_TRANSFER })
          .then((res) => res.data?.issueCartTransferToken ?? null)
          .catch(() => null)

        const { error: linkError } = await supabase.auth.updateUser({ email, password })
        if (!linkError) {
          await supabase.auth.refreshSession()
          await apollo.resetStore()
          return { ok: true, converted: true }
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
      }

      if (transferToken) {
        try {
          await apollo.mutate<RedeemCartTransferData, RedeemCartTransferVars>({
            mutation: REDEEM_CART_TRANSFER,
            variables: { token: transferToken },
          })
        } catch (e) {
          console.error('[cart] transfer failed:', messageOf(e))
        }
      }
      await apollo.resetStore()
      return { ok: true, converted: false }
    } catch (e) {
      const message = errorMessage(e, 'Нэвтрэхэд алдаа гарлаа.')
      setError(message)
      return { ok: false, message }
    } finally {
      setBusy(false)
    }
  }, [apollo])

  const signOut = useCallback(async () => {
    await (await supabaseBrowser()).auth.signOut()
    await apollo.resetStore()
  }, [apollo])

  return { upgrade, signOut, busy, error, setError }
}

export type AuthUpgrade = ReturnType<typeof useAuthUpgrade>
