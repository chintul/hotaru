'use client'

import { useCallback } from 'react'
import posthog from 'posthog-js'
import { EVENT_NAME, eventProperties } from '@/lib/analytics'
import type { TrackKind, TrackOptions } from '@/lib/analytics'

export function useTrack() {
  return useCallback((kind: TrackKind, options: TrackOptions = {}) => {
    if (!posthog.__loaded) return
    posthog.capture(EVENT_NAME[kind], eventProperties(options))
  }, [])
}
