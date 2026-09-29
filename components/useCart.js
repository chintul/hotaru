'use client'

import { useCallback } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADD_TO_CART, CLEAR_CART, MY_CART, SET_CART_QTY } from '@/lib/queries'
import { cartTotals, nodes } from '@/lib/format'
import { ensureSession } from '@/lib/supabase/browser'
import { useSession } from './useSession'
import { useUI } from './UIProvider'

export function useCart() {
  const { ready, session, user } = useSession()
  const { setCartStale } = useUI()

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
   * Read the cart back after a write, and do not take the first empty answer
   * for an answer.
   *
   * The read that follows a mutation can still miss it — measured at a few
   * hundred ms on this project, during which addToCart's own payload also
   * comes back with an empty cartItemCollection. One empty result is not proof
   * of an empty cart, and believing it is what left the drawer showing "Сагс
   * хоосон байна" over an item the server had already taken.
   */
  const settle = useCallback(async () => {
    for (const wait of [0, 250, 600, 1200]) {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      try {
        const { data: fresh } = await refetch()
        const settled = nodes(fresh?.cartCollection)[0]
        if (nodes(settled?.cartItemCollection).length > 0) {
          setCartStale(false)
          return
        }
      } catch { /* keep trying */ }
    }
    // Out of attempts: the drawer owns up rather than quietly showing nothing.
    setCartStale(true)
  }, [refetch, setCartStale])

  /**
   * Add to cart. If the visitor has no identity yet, create an anonymous one
   * first — that is the entire reason anonymous auth exists here.
   */
  const add = useCallback(async (variantId, quantity = 1) => {
    await ensureSession()
    const res = await addMutation({ variables: { variantId, quantity } })
    setCartStale(false)
    // Deliberately not awaited. The caller opens the drawer the moment the
    // server has taken the item, and the drawer's own entrance covers the
    // round trip, so the list fills while the panel is still sliding in.
    settle()
    return res
  }, [addMutation, settle, setCartStale])

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
