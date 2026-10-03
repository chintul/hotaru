'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { useSession } from './useSession'

export default function AnalyticsIdentity() {
  const { ready, isAuthenticated, user } = useSession()
  const identified = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || !posthog.__loaded) return
    if (isAuthenticated && user?.id && identified.current !== user.id) {
      posthog.identify(user.id)
      identified.current = user.id
    } else if (!isAuthenticated && identified.current) {
      posthog.reset()
      identified.current = null
    }
  }, [ready, isAuthenticated, user?.id])

  return null
}
