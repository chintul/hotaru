'use client'

import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase/browser'

export interface SessionState {
  session: Session | null
  ready: boolean
  isAnonymous: boolean
  isAuthenticated: boolean
  user: User | null
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    let unsubscribe: (() => void) | null = null

    void supabaseBrowser().then((supabase) => {
      if (!alive) return
      void supabase.auth.getSession().then(({ data }) => {
        if (!alive) return
        setSession(data.session)
        setReady(true)
      })

      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        if (!alive) return
        setSession(next)
        setReady(true)
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    })

    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [])

  const isAnonymous = Boolean(session?.user?.is_anonymous)
  const hasRealAccount = Boolean(session) && !isAnonymous
  return {
    session,
    ready,
    isAnonymous,
    isAuthenticated: hasRealAccount,
    user: session?.user ?? null,
  }
}
