'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

export const OVERLAYS = ['cart', 'search', 'nav', 'filters'] as const

export type Overlay = (typeof OVERLAYS)[number]

export interface UIContextValue {
  overlay: Overlay | null
  open: (name: Overlay) => void
  close: () => void
  closeForNavigation: () => void
  toggle: (name: Overlay) => void
  isOpen: (name: Overlay) => boolean
  addPending: boolean
  setAddPending: Dispatch<SetStateAction<boolean>>
  cartStale: boolean
  setCartStale: Dispatch<SetStateAction<boolean>>
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [addPending, setAddPending] = useState(false)
  const [cartStale, setCartStale] = useState(false)

  const close = useCallback(() => setOverlay(null), [])

  const skipHistoryUnwindRef = useRef(false)
  const closeForNavigation = useCallback(() => {
    skipHistoryUnwindRef.current = true
    setOverlay(null)
  }, [])
  const open = useCallback((name: Overlay) => setOverlay(name), [])
  const toggle = useCallback((name: Overlay) => setOverlay((v) => (v === name ? null : name)), [])

  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (overlay) setOverlay(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlay(null)
      const isSearchShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (isSearchShortcut) {
        e.preventDefault()
        setOverlay((v) => (v === 'search' ? null : 'search'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!overlay) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [overlay])

  const pushedHistoryEntryRef = useRef(false)
  useEffect(() => {
    if (!overlay) return undefined
    const startHref = window.location.href
    window.history.pushState(null, '', window.location.href)
    pushedHistoryEntryRef.current = true
    const onPop = () => {
      pushedHistoryEntryRef.current = false
      setOverlay(null)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!pushedHistoryEntryRef.current) return
      pushedHistoryEntryRef.current = false
      if (skipHistoryUnwindRef.current) {
        skipHistoryUnwindRef.current = false
        return
      }
      const routerAlreadyNavigated = window.location.href !== startHref
      if (routerAlreadyNavigated) return
      window.history.back()
    }
  }, [overlay])

  const value = useMemo<UIContextValue>(
    () => ({
      overlay,
      open,
      close,
      closeForNavigation,
      toggle,
      isOpen: (name) => overlay === name,
      addPending,
      setAddPending,
      cartStale,
      setCartStale,
    }),
    [overlay, open, close, closeForNavigation, toggle, addPending, cartStale],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
