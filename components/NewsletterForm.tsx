'use client'

import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'

type SubmitState = 'idle' | 'sending' | 'done' | 'error'

interface NewsletterResponse {
  error?: string
}

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')
  const t = useT()

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
        setMessage(body.error ?? t('Илгээж чадсангүй.', 'Couldn’t send.'))
        return
      }
      setState('done')
      setMessage(t('Баярлалаа! Бүртгэгдлээ.', 'Thanks! You’re subscribed.'))
      setEmail('')
    } catch {
      setState('error')
      setMessage(t('Сүлжээний алдаа. Дахин оролдоно уу.', 'Network error. Please try again.'))
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
          placeholder={t('Имэйл хаяг', 'Email address')}
          aria-label={t('Имэйл хаяг', 'Email address')}
          aria-invalid={state === 'error' || undefined}
          className="h-12 min-w-0 flex-1 rounded-full border-white/25 bg-transparent px-4 text-[13px] text-white placeholder:text-white/40 md:text-[13px]"
        />
        <Button
          type="submit"
          variant="solid"
          disabled={state === 'sending'}
          className="h-12 rounded-full bg-white px-5 text-[13px] font-semibold text-footer hover:opacity-90 disabled:opacity-60"
        >
          {state === 'sending' ? '…' : t('Илгээх', 'Subscribe')}
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
