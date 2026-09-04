'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Pure UI state — which overlay is open. Deliberately a small context rather
 * than Apollo local state: nothing here is server data, and a context keeps the
 * cache free of things that are not.
 */
const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const closeAll = useCallback(() => {
    setCartOpen(false); setSearchOpen(false); setNavOpen(false)
  }, [])

  // Escape closes whatever is open. Expected on any overlay.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeAll()
      // Cmd/Ctrl-K opens search, the convention people already have muscle memory for.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeAll])

  // Lock the page behind any open overlay so the background does not scroll.
  const anyOpen = cartOpen || searchOpen || navOpen
  useEffect(() => {
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [anyOpen])

  const value = useMemo(
    () => ({ cartOpen, setCartOpen, searchOpen, setSearchOpen, navOpen, setNavOpen, closeAll }),
    [cartOpen, searchOpen, navOpen, closeAll],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export const useUI = () => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
