import { NextResponse } from 'next/server'
import { getSession } from '@/lib/verify/mn'
import { adminClient, findSession, markSession } from '@/lib/verify/store'

export const dynamic = 'force-dynamic'

/**
 * verify.mn callback. GET, no body, no signature.
 *
 * It is only a wake-up signal, so it is never trusted on its own — it triggers
 * an authoritative GET /sessions/{id}. It also must answer fast (their
 * per-attempt timeout is 3s and transient failures are retried five times), so
 * the reply goes out immediately and the status check is not allowed to hold it
 * open beyond a short budget.
 */
export async function GET(request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return new NextResponse('ok', { status: 200 })

  try {
    const admin = adminClient()
    const record = await findSession(admin, sessionId)
    if (record && record.status === 'pending') {
      const remote = await Promise.race([
        getSession(sessionId),
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ])
      if (remote?.sessionStatus === 'VERIFIED') await markSession(admin, sessionId, 'verified')
      else if (remote?.sessionStatus === 'EXPIRED') await markSession(admin, sessionId, 'expired')
    }
  } catch (e) {
    // Never fail the callback: a non-2xx makes verify.mn retry, and the client
    // is polling anyway.
    console.error('[verify.mn] callback handling failed:', e?.message)
  }

  return new NextResponse('ok', { status: 200 })
}
