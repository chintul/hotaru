'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusQuietly = (el: HTMLElement) => el.focus({ preventScroll: true })

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(active = true): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return undefined
    const panel = ref.current
    if (!panel) return undefined

    const restoreTo = document.activeElement
    const firstControl = panel.querySelector<HTMLElement>(FOCUSABLE)
    focusQuietly(firstControl ?? panel)

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) {
        e.preventDefault()
        focusQuietly(panel)
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const wrapTarget = e.shiftKey ? last : first
      const focusOutsideItems = !panel.contains(document.activeElement) || document.activeElement === panel
      if (focusOutsideItems) {
        e.preventDefault()
        focusQuietly(wrapTarget)
        return
      }
      const edge = e.shiftKey ? first : last
      if (document.activeElement === edge) {
        e.preventDefault()
        focusQuietly(wrapTarget)
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      const openerStillMounted = restoreTo instanceof HTMLElement && document.contains(restoreTo)
      if (openerStillMounted) focusQuietly(restoreTo)
    }
  }, [active])

  return ref
}
