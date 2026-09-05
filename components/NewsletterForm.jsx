'use client'

import { useState } from 'react'

/**
 * Footer newsletter signup.
 *
 * A plain form POST would navigate the visitor away from whatever they were
 * reading to render a bare JSON response. Submitting stays on the page and
 * answers in place.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [message, setMessage] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setMessage('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setMessage(body?.error ?? 'Илгээж чадсангүй.')
        return
      }
      setState('done')
      setMessage('Баярлалаа! Бүртгэгдлээ.')
      setEmail('')
    } catch {
      setState('error')
      setMessage('Сүлжээний алдаа. Дахин оролдоно уу.')
    }
  }

  if (state === 'done') {
    return (
      <p className="mt-4 border border-white/25 px-3 py-3 text-[13px] text-white/80" role="status">
        {message}
      </p>
    )
  }

  return (
    <form className="mt-4" onSubmit={onSubmit} noValidate>
      <div className="flex">
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Имэйл хаяг"
          aria-label="Имэйл хаяг"
          aria-invalid={state === 'error' || undefined}
          className="min-w-0 flex-1 border border-white/25 bg-transparent px-3 py-3 text-[13px] placeholder:text-white/40 focus:border-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="bg-white px-5 py-3 text-[13px] font-bold uppercase tracking-[0.7px] text-ink-strong transition-opacity disabled:opacity-60"
        >
          {state === 'sending' ? '…' : 'Илгээх'}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-[12px] text-white/70" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
