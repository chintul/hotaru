'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { THEME_COLOR, THEME_KEY, isThemePreference, type ResolvedTheme, type ThemePreference } from '@/lib/theme'

export type { ResolvedTheme, ThemePreference }

export interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (next: ThemePreference) => void
  toggle: () => void
}

type Snapshot = `${ThemePreference}:${ResolvedTheme}`

const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredPreferenceSafely(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function writeStoredPreferenceSafely(next: ThemePreference): boolean {
  try {
    localStorage.setItem(THEME_KEY, next)
    return true
  } catch {
    return false
  }
}

const systemTheme = (): ResolvedTheme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

const compute = (): Snapshot => {
  const preference = readStoredPreferenceSafely()
  return `${preference}:${preference === 'system' ? systemTheme() : preference}`
}

const parseSnapshot = (value: Snapshot): [ThemePreference, ResolvedTheme] => {
  const [preference, resolved] = value.split(':')
  return [isThemePreference(preference) ? preference : 'system', resolved === 'dark' ? 'dark' : 'light']
}

const listeners = new Set<() => void>()
let snapshot: Snapshot | null = null

function invalidate() {
  snapshot = compute()
  listeners.forEach((l) => l())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const mql = window.matchMedia(DARK_QUERY)
  mql.addEventListener('change', invalidate)
  window.addEventListener('storage', invalidate)
  return () => {
    listeners.delete(onChange)
    mql.removeEventListener('change', invalidate)
    window.removeEventListener('storage', invalidate)
  }
}

const getSnapshot = (): Snapshot => (snapshot ??= compute())

const getServerSnapshot = (): Snapshot => 'system:light'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, resolved] = parseSnapshot(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  )

  useLayoutEffect(() => {
    const [, clientResolved] = parseSnapshot(compute())
    document.documentElement.dataset.theme = clientResolved
    const meta =
      document.querySelector('meta[name="theme-color"]:not([media])')
      ?? document.head.appendChild(
        Object.assign(document.createElement('meta'), { name: 'theme-color' }),
      )
    meta.setAttribute('content', THEME_COLOR[clientResolved])
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredPreferenceSafely(next)
    invalidate()
  }, [])

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setPreference])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
