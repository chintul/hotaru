'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import { useSession } from '@/components/useSession'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/account'
  const { upgrade, busy, error } = useAuthUpgrade()
  const { isAuthenticated } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    const res = await upgrade({ email, password })
    if (res.ok) router.push(next)
    // Supabase may require email confirmation depending on project settings;
    // in that case there is no session yet and the push above is a no-op.
    else if (res.message?.toLowerCase().includes('confirm')) {
      setNotice('Имэйлээ шалгаж баталгаажуулна уу.')
    }
  }

  if (isAuthenticated) {
    return (
      <div className="py-10 text-center">
        <p className="text-ink-soft">Та нэвтэрсэн байна.</p>
        <button onClick={() => router.push(next)} className="label link-underline mt-3">
          Үргэлжлүүлэх
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label text-ink-faint" htmlFor="email">Имэйл</label>
        <input
          id="email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="label text-ink-faint" htmlFor="password">Нууц үг</label>
        <input
          id="password" type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink"
          autoComplete="current-password"
        />
        <p className="label mt-2 text-ink-faint">Хамгийн багадаа 6 тэмдэгт</p>
      </div>

      {error && <p className="text-sale">{error}</p>}
      {notice && <p className="text-ink-soft">{notice}</p>}

      <button
        type="submit" disabled={busy}
        className="label w-full bg-ink py-3.5 text-paper transition-opacity hover:opacity-85 disabled:opacity-40"
      >
        {busy ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}
      </button>
      <p className="label text-ink-faint">
        Бүртгэлгүй бол шинээр үүсгэнэ. Сагсанд байгаа бараа хадгалагдана.
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <h1 className="display text-3xl">Нэвтрэх</h1>
      <p className="mt-2 text-ink-soft">Захиалга өгөхийн тулд бүртгэл шаардлагатай.</p>
      <div className="mt-10">
        <Suspense fallback={<p className="label text-ink-faint">…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
