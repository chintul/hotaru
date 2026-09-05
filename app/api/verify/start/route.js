import { NextResponse } from 'next/server'
import { createSession, isConfigured, VerifyMnError } from '@/lib/verify/mn'
import { adminClient, recordSession } from '@/lib/verify/store'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Opens a verify.mn session for the signed-in (possibly anonymous) visitor.
 *
 * No `callback` is registered: we poll. verify.mn retries failed callbacks up
 * to five times, so pointing it at a URL we are not committed to serving would
 * generate repeated dead deliveries.
 */
export async function POST(request) {
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

  const { phone } = await request.json().catch(() => ({}))

  try {
    const session = await createSession(phone)
    const admin = adminClient()
    await recordSession(admin, {
      sessionId: session.sessionId,
      phone: session.phone,
      profileId: user.id,
      code: session.code,
      expiresAt: session.expiresAt,
    })

    // displayInstruction is returned untouched — it names the number the user
    // must send from, and that is the most common reason verification fails.
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
      const status = e.code === 'BAD_PHONE' ? 400 : e.status === 401 ? 502 : 502
      // A bad key is our problem, not the visitor's: never surface 401 to them.
      console.error('[verify.mn] createSession failed:', e.message)
      return NextResponse.json({ error: e.code === 'BAD_PHONE' ? 'Утасны дугаар буруу байна.' : 'Баталгаажуулалт эхлүүлж чадсангүй.' }, { status })
    }
    console.error('[verify.mn] unexpected:', e?.message)
    return NextResponse.json({ error: 'Алдаа гарлаа.' }, { status: 500 })
  }
}
