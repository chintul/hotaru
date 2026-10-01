import { NextResponse, type NextRequest } from 'next/server'
import { adminClient, type AdminClient } from '@/lib/supabase/admin'
import { isRecord } from '@/lib/http'

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/
const MAX_EMAIL_LENGTH = 254

interface Signup {
  email: unknown
  locale: string
}

async function readSignup(request: NextRequest): Promise<Signup> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body: unknown = await request.json().catch(() => ({}))
    if (!isRecord(body)) return { email: null, locale: 'mn' }
    const locale = typeof body.locale === 'string' && body.locale ? body.locale : 'mn'
    return { email: body.email, locale }
  }
  const form = await request.formData().catch(() => null)
  return { email: form?.get('email'), locale: 'mn' }
}

export async function POST(request: NextRequest) {
  const signup = await readSignup(request)
  const email = String(signup.email ?? '').trim().toLowerCase()

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Имэйл хаяг буруу байна.' }, { status: 400 })
  }

  let admin: AdminClient
  try {
    admin = adminClient()
  } catch {
    console.error('[newsletter] service role credentials missing')
    return NextResponse.json({ error: 'Түр боломжгүй байна.' }, { status: 503 })
  }

  const { error } = await admin
    .from('newsletter_subscribers')
    .upsert({ email, locale: signup.locale, source: 'footer' }, { onConflict: 'email' })

  if (error) {
    console.error('[newsletter] insert failed:', error.message)
    return NextResponse.json({ error: 'Хадгалж чадсангүй.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
