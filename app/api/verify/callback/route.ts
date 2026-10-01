import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/verify/mn'
import { adminClient, findSession, markSession } from '@/lib/verify/store'
import { messageOf } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const STATUS_CHECK_BUDGET_MS = 1500

const acknowledge = () => new NextResponse('ok', { status: 200 })

function withinBudget<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

export async function GET(request: NextRequest) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return acknowledge()

  try {
    const admin = adminClient()
    const record = await findSession(admin, sessionId)
    if (record && record.status === 'pending') {
      const remote = await withinBudget(getSession(sessionId), STATUS_CHECK_BUDGET_MS)
      if (remote?.sessionStatus === 'VERIFIED') await markSession(admin, sessionId, 'verified')
      else if (remote?.sessionStatus === 'EXPIRED') await markSession(admin, sessionId, 'expired')
    }
  } catch (e) {
    console.error('[verify.mn] callback handling failed:', messageOf(e))
  }

  return acknowledge()
}
