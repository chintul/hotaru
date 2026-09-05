import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Newsletter signup.
 *
 * The footer form used to post straight to this path with no handler behind
 * it, so every submission produced a 404. It now stores the address with the
 * service role: newsletter_subscribers has RLS on and no policy, so the
 * browser can neither insert (spam) nor read it back (the customer list).
 */
export async function POST(request) {
  let email = null
  let locale = 'mn'

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}))
    email = body?.email
    if (body?.locale) locale = body.locale
  } else {
    const form = await request.formData().catch(() => null)
    email = form?.get('email')
  }

  email = String(email ?? '').trim().toLowerCase()

  // Deliberately loose: the point is to reject obvious junk, not to police
  // valid-but-unusual addresses. Delivery is the real validator.
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Имэйл хаяг буруу байна.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[newsletter] service role credentials missing')
    return NextResponse.json({ error: 'Түр боломжгүй байна.' }, { status: 503 })
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await admin
    .from('newsletter_subscribers')
    .upsert({ email, locale, source: 'footer' }, { onConflict: 'email' })

  if (error) {
    console.error('[newsletter] insert failed:', error.message)
    return NextResponse.json({ error: 'Хадгалж чадсангүй.' }, { status: 500 })
  }

  // Re-subscribing is not an error worth showing anyone.
  return NextResponse.json({ ok: true })
}
