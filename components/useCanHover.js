'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(hover: hover)'

const subscribe = (onChange) => {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * Whether this device can hover at all.
 *
 * useSyncExternalStore rather than an effect: it takes a server snapshot, so
 * the markup React hydrates against already assumes "no hover" and there is no
 * mismatch to patch up — and no setState-in-an-effect for the lint to reject.
 *
 * A phone answers false, which is the point: hover-only decoration should not
 * be built, or downloaded, for a screen that can never trigger it.
 */
export function useCanHover() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
