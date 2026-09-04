'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'

/**
 * The current Supabase session, plus whether it is still an anonymous one.
 *
 * `ready` matters: until the first getSession() resolves we do not know if the
 * visitor has a cart, and querying too early produces a flash of "empty cart"
 * for someone who has items.
 */
export function useSession() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = supabaseBrowser()
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session ?? null)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null)
      setReady(true)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const isAnonymous = Boolean(session?.user?.is_anonymous)
  return {
    session,
    ready,
    isAnonymous,
    // "Signed in" means a real account, not the anonymous cart identity.
    isAuthenticated: Boolean(session) && !isAnonymous,
    user: session?.user ?? null,
  }
}
