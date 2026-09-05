import { NextResponse } from 'next/server'
import { getSession, VerifyMnError } from '@/lib/verify/mn'
import { adminClient, attachPhoneToUser, findSession, markSession } from '@/lib/verify/store'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Authoritative status check. The client polls this every ~3s.
 *
 * It re-reads verify.mn rather than trusting anything cached: the callback is a
 * wake-up signal with no body and no signature, so this endpoint is the only
 * thing that decides whether a phone is verified.
 */
export async function GET(request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

  const admin = adminClient()
  const record = await findSession(admin, sessionId)
  if (!record) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  // A session belongs to the visitor who started it.
  if (record.profile_id && record.profile_id !== user.id) {
    return NextResponse.json({ error: 'not your session' }, { status: 403 })
  }

  try {
    const remote = await getSession(sessionId)

    if (remote?.sessionStatus === 'VERIFIED') {
      if (record.status !== 'verified') {
        await markSession(admin, sessionId, 'verified')
      }
      const attach = await attachPhoneToUser(admin, { userId: user.id, phone: record.phone })
      return NextResponse.json({
        status: 'VERIFIED',
        phone: record.phone,
        // 'attached'          -> same uid kept, cart untouched
        // 'signed_in_existing'-> different account owns this number; the client
        //                        adopts the returned session and moves the cart
        outcome: attach.outcome,
        session: attach.session ?? null,
      })
    }

    if (remote?.sessionStatus === 'EXPIRED') {
      await markSession(admin, sessionId, 'expired')
      return NextResponse.json({ status: 'EXPIRED' })
    }

    return NextResponse.json({ status: 'PENDING', expiresAt: remote?.expiresAt ?? record.expires_at })
  } catch (e) {
    if (e instanceof VerifyMnError && e.status === 404) {
      return NextResponse.json({ status: 'EXPIRED' })
    }
    console.error('[verify.mn] status check failed:', e?.message)
    return NextResponse.json({ error: 'Төлөв шалгаж чадсангүй.' }, { status: 502 })
  }
}
