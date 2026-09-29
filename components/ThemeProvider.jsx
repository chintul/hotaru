'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
// In lib/ because app/layout.js needs them on the server. See lib/theme.js.
import { PREFERENCES, THEME_COLOR, THEME_KEY } from '@/lib/theme'

/**
 * Light/dark theme: the preference the visitor chose, plus what it resolves to.
 *
 * Storing PREFERENCE rather than RESOLVED is what keeps 'system' following the
 * OS — storing the resolved value would freeze the shop at whatever their phone
 * was set to the first time they opened it.
 *
 * localStorage and matchMedia are external mutable state, so this is a
 * useSyncExternalStore rather than useState seeded in an effect: the seeding
 * effect is a cascading render, which this repo's react-hooks config rejects.
 */
const ThemeContext = createContext(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

/* localStorage throws in a private window, it does not just return null. */
function readPreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return PREFERENCES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

const systemTheme = () => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

/* One snapshot string, so React can compare it by value. */
const compute = () => {
  const preference = readPreference()
  return `${preference}:${preference === 'system' ? systemTheme() : preference}`
}

const listeners = new Set()
let snapshot = null

function invalidate() {
  snapshot = compute()
  listeners.forEach((l) => l())
}

function subscribe(onChange) {
  listeners.add(onChange)
  const mql = window.matchMedia(DARK_QUERY)
  // `storage` keeps other tabs in step; it does not fire in the tab that wrote.
  mql.addEventListener('change', invalidate)
  window.addEventListener('storage', invalidate)
  return () => {
    listeners.delete(onChange)
    mql.removeEventListener('change', invalidate)
    window.removeEventListener('storage', invalidate)
  }
}

const getSnapshot = () => (snapshot ??= compute())

/* The server cannot know either value. React re-renders after hydration if the
   client disagrees, and only the toggle's label depends on it — the palette and
   the icons are already correct from the boot script's attribute. */
const getServerSnapshot = () => 'system:light'

export function ThemeProvider({ children }) {
  const [preference, resolved] = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  ).split(':')

  /**
   * One effect, so the attribute and the browser chrome cannot disagree.
   * Layout, not passive: React's dev remount clears the attribute the boot
   * script stamped, and a passive effect restores it a paint too late.
   * It re-reads the store because `resolved` is still the server's 'light'
   * on the hydration pass; `resolved` is only the trigger.
   */
  useLayoutEffect(() => {
    const current = compute().split(':')[1]
    document.documentElement.dataset.theme = current
    const meta =
      document.querySelector('meta[name="theme-color"]:not([media])')
      ?? document.head.appendChild(
        Object.assign(document.createElement('meta'), { name: 'theme-color' }),
      )
    meta.setAttribute('content', THEME_COLOR[current])
  }, [resolved])

  const setPreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Private window: applies for this page view, will not survive a reload.
    }
    invalidate()
  }, [])

  /* Flips RESOLVED rather than cycling PREFERENCES: one icon button cannot show
     which of three states you are in. setPreference is exported for a settings
     screen that can. */
  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
