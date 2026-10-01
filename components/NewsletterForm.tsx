'use client'

import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SubmitState = 'idle' | 'sending' | 'done' | 'error'

interface NewsletterResponse {
  error?: string
}

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
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
      const body: NewsletterResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setMessage(body.error ?? 'Илгээж чадсангүй.')
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
        <Input
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Имэйл хаяг"
          aria-label="Имэйл хаяг"
          aria-invalid={state === 'error' || undefined}
          className="h-12 min-w-0 flex-1 rounded-none border-white/25 bg-transparent px-3 text-[13px] text-white placeholder:text-white/40 md:text-[13px]"
        />
        <Button
          type="submit"
          variant="solid"
          disabled={state === 'sending'}
          className="h-12 bg-white px-5 text-[13px] text-footer hover:opacity-90 disabled:opacity-60"
        >
          {state === 'sending' ? '…' : 'Илгээх'}
        </Button>
      </div>
      {message && (
        <p className="mt-2 text-[12px] text-white/70" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
