'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Pure UI state — which overlay is open. Deliberately a small context rather
 * than Apollo local state: nothing here is server data, and a context keeps the
 * cache free of things that are not.
 *
 * There is exactly ONE open overlay at a time, held as a name rather than as a
 * boolean per surface. Four separate booleans meant four surfaces could each
 * believe they owned the page: the cart drawer and the shop's filter sheet both
 * wrote `document.body.style.overflow` directly, so closing the filter sheet
 * released the scroll lock the drawer still needed. A single value makes the
 * lock, the Escape key, the Android back button and the close-on-navigation
 * rule impossible to implement inconsistently, because each is written once.
 */
const UIContext = createContext(null)

/** Every dismissable surface in the storefront. */
export const OVERLAYS = ['cart', 'search', 'nav', 'filters']

export function UIProvider({ children }) {
  const [overlay, setOverlay] = useState(null)

  /**
   * An add is in flight somewhere on the page.
   *
   * It lives here rather than on useCart because useCart is a hook: every
   * caller builds its own useMutation, so the drawer's `adding` is a different
   * boolean from the product page's and stays false while the product page is
   * actually mid-request. The drawer needs to know about a request it did not
   * make, which makes this shared UI state, not cart state.
   */
  const [addPending, setAddPending] = useState(false)

  /**
   * The cart mutation succeeded but the refetch that follows it did not, so
   * what the drawer is showing is older than what the server holds. Also
   * shared state: the refetch belongs to whichever useCart ran the add, and
   * the drawer that has to own up to it is a different instance.
   */
  const [cartStale, setCartStale] = useState(false)

  const close = useCallback(() => setOverlay(null), [])

  /**
   * Close because a link inside the overlay is navigating.
   *
   * Same as close(), minus the history unwind: the router has not updated the
   * URL yet when the cleanup runs, so an unwind there cannot tell a dismissal
   * from a navigation and would pop the navigation instead. Only needed for a
   * link whose path matches the current one — any other link changes the path,
   * and the reset below closes the overlay for free.
   */
  const skipUnwindRef = useRef(false)
  const closeForNavigation = useCallback(() => {
    skipUnwindRef.current = true
    setOverlay(null)
  }, [])
  const open = useCallback((name) => setOverlay(name), [])
  const toggle = useCallback((name) => setOverlay((v) => (v === name ? null : name)), [])

  /**
   * Navigating closes whatever is open.
   *
   * This used to be an effect in Header with `[setNavOpen]` as its dependency —
   * a setState function, which never changes — so it ran once on mount and
   * never again. Header lives in the (shop) layout and does not remount, so the
   * mobile menu survived every navigation. Tapping a link inside it was fine
   * (each link closed it by hand), but the Android back button was not: the
   * route changed underneath an open menu that still held the scroll lock, and
   * the shopper landed on a page they could not scroll.
   *
   * Setting state during render is React's documented way to reset state when a
   * prop changes; an effect here would be setState-in-effect, which this repo's
   * react-hooks config rejects, and would also paint the stale frame first.
   */
  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (overlay) setOverlay(null)
  }

  // Escape closes whatever is open. Expected on any overlay — and now it really
  // is any overlay, including the shop filter sheet, which was outside the old
  // boolean set and so was the one surface Escape could not dismiss.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOverlay(null)
      // Cmd/Ctrl-K opens search, the convention people already have muscle memory for.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOverlay((v) => (v === 'search' ? null : 'search'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lock the page behind any open overlay. One writer, so nothing can release
  // a lock another surface is still relying on.
  useEffect(() => {
    if (!overlay) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [overlay])

  /**
   * Android's back button dismisses the overlay rather than leaving the page.
   *
   * The entry is pushed in the ONE shape Next integrates with: a URL, and no
   * custom state (see "Native History API" in the Next docs). A bare
   * `pushState({ hotaruOverlay: true }, '')` detaches the App Router — while
   * any overlay was open, every link inside it silently did nothing, including
   * Захиалах in the cart drawer. Ours is the same URL, so Back lands on the
   * page the shopper is already looking at and only the overlay goes away.
   *
   * A ref marks the entry instead of the state object, which is now null.
   */
  const pushedRef = useRef(false)
  useEffect(() => {
    if (!overlay) return undefined
    const startHref = window.location.href
    window.history.pushState(null, '', window.location.href)
    pushedRef.current = true
    const onPop = () => { pushedRef.current = false; setOverlay(null) }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!pushedRef.current) return
      pushedRef.current = false
      if (skipUnwindRef.current) { skipUnwindRef.current = false; return }
      // The router may already have moved us on; unwinding then would pop the
      // new page rather than our own entry.
      if (window.location.href !== startHref) return
      window.history.back()
    }
  }, [overlay])

  const value = useMemo(
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

export const useUI = () => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
