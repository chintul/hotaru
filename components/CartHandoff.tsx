'use client'

import { useEffect } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { REDEEM_CART_TRANSFER } from '@/lib/queries'
import { useSession } from './useSession'

export const CART_HANDOFF_KEY = 'hotaru.cart-handoff'

function takeParkedToken(): string | null {
  try {
    const token = sessionStorage.getItem(CART_HANDOFF_KEY)
    if (token) sessionStorage.removeItem(CART_HANDOFF_KEY)
    return token
  } catch {
    return null
  }
}

export function useRedeemParkedCart() {
  const apollo = useApolloClient()
  const { isAuthenticated } = useSession()

  useEffect(() => {
    if (!isAuthenticated) return
    const token = takeParkedToken()
    if (!token) return

    apollo
      .mutate({ mutation: REDEEM_CART_TRANSFER, variables: { token } })
      .then(() => apollo.resetStore())
      .catch(() => {})
  }, [isAuthenticated, apollo])
}

export default function CartHandoff() {
  useRedeemParkedCart()
  return null
}
