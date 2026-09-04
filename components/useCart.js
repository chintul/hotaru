'use client'

import { useCallback } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADD_TO_CART, CLEAR_CART, MY_CART, SET_CART_QTY } from '@/lib/queries'
import { cartTotals, nodes } from '@/lib/format'
import { ensureSession } from '@/lib/supabase/browser'
import { useSession } from './useSession'

export function useCart() {
  const { ready, session, user } = useSession()

  // Skip until we know whether a session exists — see useSession.
  const { data, loading, refetch } = useQuery(MY_CART, {
    variables: { profileId: user?.id },
    skip: !ready || !session || !user?.id,
    // Revalidate on mount: placing an order converts the cart server-side, and
    // a cache-first read would keep showing the old item count in the header.
    fetchPolicy: 'cache-and-network',
  })

  const [addMutation, { loading: adding }] = useMutation(ADD_TO_CART)
  const [setQtyMutation] = useMutation(SET_CART_QTY)
  const [clearMutation] = useMutation(CLEAR_CART)

  const cart = nodes(data?.cartCollection)[0] ?? null
  const items = nodes(cart?.cartItemCollection)
  const { subtotal, count } = cartTotals(items)

  /**
   * Add to cart. If the visitor has no identity yet, create an anonymous one
   * first — that is the entire reason anonymous auth exists here. The refetch
   * covers the first-ever add, where the MY_CART query was skipped and so has
   * nothing to update.
   */
  const add = useCallback(async (variantId, quantity = 1) => {
    await ensureSession()
    const res = await addMutation({ variables: { variantId, quantity } })
    await refetch()
    return res
  }, [addMutation, refetch])

  const setQuantity = useCallback(async (variantId, quantity) => {
    await setQtyMutation({ variables: { variantId, quantity } })
    await refetch()
  }, [setQtyMutation, refetch])

  const clear = useCallback(async () => {
    await clearMutation()
    await refetch()
  }, [clearMutation, refetch])

  return { cart, items, subtotal, count, loading, adding, add, setQuantity, clear, refetch }
}
