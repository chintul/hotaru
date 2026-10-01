'use client'

import { useCallback } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADD_TO_CART, CLEAR_CART, MY_CART, SET_CART_QTY } from '@/lib/queries'
import { cartTotals, firstNode, nodes } from '@/lib/format'
import { ensureSession } from '@/lib/supabase/browser'
import type { Cart, Connection } from '@/lib/types'
import { useSession } from './useSession'
import { useUI } from './UIProvider'

interface MyCartData {
  cartCollection: Connection<Cart> | null
}

interface MyCartVars {
  profileId?: string
}

interface AddToCartData {
  addToCart: Cart | null
}

interface AddToCartVars {
  variantId: string
  quantity?: number
}

interface SetCartQtyData {
  setCartItemQuantity: Cart | null
}

interface SetCartQtyVars {
  variantId: string
  quantity: number
}

interface ClearCartData {
  clearCart: Cart | null
}

const SETTLE_RETRY_DELAYS_MS = [0, 250, 600, 1200]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useCart() {
  const { ready, session, user } = useSession()
  const { setCartStale } = useUI()

  const { data, loading, refetch } = useQuery<MyCartData, MyCartVars>(MY_CART, {
    variables: { profileId: user?.id },
    skip: !ready || !session || !user?.id,
    fetchPolicy: 'cache-and-network',
  })

  const [addMutation, { loading: adding }] = useMutation<AddToCartData, AddToCartVars>(ADD_TO_CART)
  const [setQtyMutation] = useMutation<SetCartQtyData, SetCartQtyVars>(SET_CART_QTY)
  const [clearMutation] = useMutation<ClearCartData>(CLEAR_CART)

  const cart = firstNode(data?.cartCollection)
  const items = nodes(cart?.cartItemCollection)
  const { subtotal, count } = cartTotals(items)

  const settleUntilItemsVisible = useCallback(async () => {
    for (const wait of SETTLE_RETRY_DELAYS_MS) {
      if (wait) await sleep(wait)
      const result = await refetch().catch(() => null)
      const settled = firstNode(result?.data?.cartCollection)
      if (nodes(settled?.cartItemCollection).length > 0) {
        setCartStale(false)
        return
      }
    }
    setCartStale(true)
  }, [refetch, setCartStale])

  const add = useCallback(async (variantId: string, quantity = 1) => {
    await ensureSession()
    const res = await addMutation({ variables: { variantId, quantity } })
    setCartStale(false)
    void settleUntilItemsVisible()
    return res
  }, [addMutation, settleUntilItemsVisible, setCartStale])

  const setQuantity = useCallback(async (variantId: string, quantity: number) => {
    await setQtyMutation({ variables: { variantId, quantity } })
    await refetch()
  }, [setQtyMutation, refetch])

  const clear = useCallback(async () => {
    await clearMutation()
    await refetch()
  }, [clearMutation, refetch])

  return { cart, items, subtotal, count, loading, adding, add, setQuantity, clear, refetch }
}

export type CartState = ReturnType<typeof useCart>
