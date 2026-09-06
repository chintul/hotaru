'use client'

import { useEffect } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { REDEEM_CART_TRANSFER } from '@/lib/queries'
import { useSession } from './useSession'

/**
 * Where the basket goes when signing in creates a different user.
 *
 * Signing in with Google or Apple mints a NEW uid — the anonymous user that
 * owns the cart is not linked to it — so the cart is handed over with a
 * single-use token minted before the redirect and parked in sessionStorage.
 * OAuth leaves the site entirely, which is why it cannot be component state.
 *
 * Mounted in the storefront layout rather than on the sign-in page: OAuth
 * returns the shopper to wherever they were headed — /checkout, /account, a
 * product — and never to /login. Redeeming only there meant the token sat
 * unread and the basket a shopper signed in to buy was silently dropped.
 */
export const CART_HANDOFF_KEY = 'hotaru.cart-handoff'

export function useRedeemParkedCart() {
  const apollo = useApolloClient()
  const { isAuthenticated } = useSession()

  useEffect(() => {
    if (!isAuthenticated) return
    let token = null
    try {
      token = sessionStorage.getItem(CART_HANDOFF_KEY)
      // Cleared before the mutation, not after: a redeem that fails must not
      // leave a token that retries on every navigation.
      if (token) sessionStorage.removeItem(CART_HANDOFF_KEY)
    } catch {
      // Safari in private mode throws on sessionStorage. Nothing to redeem.
    }
    if (!token) return

    apollo
      .mutate({ mutation: REDEEM_CART_TRANSFER, variables: { token } })
      .then(() => apollo.resetStore())
      .catch(() => { /* expired, already redeemed, or the cart was empty */ })
  }, [isAuthenticated, apollo])
}

export default function CartHandoff() {
  useRedeemParkedCart()
  return null
}
