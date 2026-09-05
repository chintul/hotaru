'use client'

import { useEffect, useState } from 'react'
import { IconArrowUp } from './Icons'

/** Right-edge utility rail, same placement as the reference. */
export default function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 place-items-center border border-line bg-paper shadow-sm transition-colors hover:bg-shade md:grid"
      aria-label="Дээш"
    >
      <IconArrowUp />
    </button>
  )
}
