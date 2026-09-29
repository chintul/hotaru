'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Keep keyboard focus inside an open overlay, and give it back on close.
 *
 * Every dismissable surface in the shop declared `role="dialog"` and
 * `aria-modal="true"`, and not one of them behaved like a modal: Tab walked
 * straight out of the drawer into the catalog behind it, and closing the
 * overlay dropped focus at the top of the document instead of returning it to
 * the control that opened it. The focus RING was already right — globals.css
 * has one :focus-visible rule for the whole storefront — so what was missing
 * was only the trapping and the restore.
 *
 * Returns a ref to spread onto the panel element. The panel should carry
 * tabIndex={-1} so there is always something to focus when it holds no
 * controls yet (an empty cart, a search with no results).
 *
 * `active` exists for surfaces that stay mounted while closed; surfaces that
 * unmount can simply pass true.
 */
export function useFocusTrap(active = true) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const panel = ref.current
    if (!panel) return undefined

    const restoreTo = document.activeElement
    // Prefer the first real control, so a keyboard user lands somewhere useful
    // rather than on the panel itself and having to Tab once to start.
    const first = panel.querySelector(FOCUSABLE)
    ;(first ?? panel).focus({ preventScroll: true })

    // Bound to the document, not the panel: once focus has escaped, a listener
    // on the panel never fires again and the trap can no longer pull it back.
    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const items = Array.from(panel.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) {
        e.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }
      // Focus on the panel itself counts as outside `items`, so Shift+Tab from
      // there wraps to the end rather than escaping backwards into the page.
      if (!panel.contains(document.activeElement) || document.activeElement === panel) {
        e.preventDefault()
        ;(e.shiftKey ? items[items.length - 1] : items[0]).focus({ preventScroll: true })
        return
      }
      const edge = e.shiftKey ? items[0] : items[items.length - 1]
      if (document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? items[items.length - 1] : items[0]).focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      // The opener can be gone by now (a link inside the overlay replaced the
      // page), so only restore to something still in the document.
      if (restoreTo instanceof HTMLElement && document.contains(restoreTo)) {
        restoreTo.focus({ preventScroll: true })
      }
    }
  }, [active])

  return ref
}
