import { NextResponse, type NextRequest } from 'next/server'
import { createSession, isConfigured, VerifyMnError } from '@/lib/verify/mn'
import { adminClient, recordSession } from '@/lib/verify/store'
import { supabaseServer } from '@/lib/supabase/server'
import { messageOf } from '@/lib/errors'

export const dynamic = 'force-dynamic'

async function readPhone(request: NextRequest): Promise<string> {
  const body: unknown = await request.json().catch(() => ({}))
  const phone = typeof body === 'object' && body !== null && 'phone' in body ? body.phone : undefined
  return String(phone ?? '')
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'phone verification is not configured', code: 'NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const phone = await readPhone(request)

  try {
    const session = await createSession(phone)
    await recordSession(adminClient(), {
      sessionId: session.sessionId,
      phone: session.phone,
      profileId: user.id,
      code: session.code,
      expiresAt: session.expiresAt,
    })

    return NextResponse.json({
      sessionId: session.sessionId,
      phone: session.phone,
      shortcode: session.shortcode,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    })
  } catch (e) {
    if (e instanceof VerifyMnError) {
      const badPhone = e.code === 'BAD_PHONE'
      console.error('[verify.mn] createSession failed:', e.message)
      return NextResponse.json(
        { error: badPhone ? 'Утасны дугаар буруу байна.' : 'Баталгаажуулалт эхлүүлж чадсангүй.' },
        { status: badPhone ? 400 : 502 },
      )
    }
    console.error('[verify.mn] unexpected:', messageOf(e))
    return NextResponse.json({ error: 'Алдаа гарлаа.' }, { status: 500 })
  }
}
