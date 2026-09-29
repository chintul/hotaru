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

  // The auth client is a lazy chunk now (see lib/supabase/browser.js), so this
  // resolves a tick later than it used to. `ready` already covered that gap —
  // it exists precisely so nothing queries a cart before we know whether there
  // is a session — so the only new work is unsubscribing from a listener that
  // may arrive after unmount.
  useEffect(() => {
    let alive = true
    let unsubscribe = null

    supabaseBrowser().then((supabase) => {
      if (!alive) return
      supabase.auth.getSession().then(({ data }) => {
        if (!alive) return
        setSession(data.session ?? null)
        setReady(true)
      })

      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        if (!alive) return
        setSession(next ?? null)
        setReady(true)
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    })

    return () => { alive = false; unsubscribe?.() }
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
