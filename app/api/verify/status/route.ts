import { NextResponse, type NextRequest } from 'next/server'
import { getSession, VerifyMnError } from '@/lib/verify/mn'
import { adminClient, attachPhoneToUser, findSession, markSession } from '@/lib/verify/store'
import { supabaseServer } from '@/lib/supabase/server'
import { messageOf } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

  const admin = adminClient()
  const record = await findSession(admin, sessionId)
  if (!record) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  const startedByAnotherVisitor = Boolean(record.profile_id) && record.profile_id !== user.id
  if (startedByAnotherVisitor) {
    return NextResponse.json({ error: 'not your session' }, { status: 403 })
  }

  try {
    const remote = await getSession(sessionId)

    if (remote?.sessionStatus === 'VERIFIED') {
      if (record.status !== 'verified') {
        await markSession(admin, sessionId, 'verified')
      }
      const attach = await attachPhoneToUser(admin, { userId: user.id, phone: record.phone })

      if (attach.outcome === 'error') {
        console.error('[verify.mn] could not complete sign-in:', attach.message)
        return NextResponse.json({
          status: 'ERROR',
          message: 'Дугаар баталгаажсан ч нэвтэрч чадсангүй. Дахин оролдоно уу.',
        })
      }

      const { error: syncError } = await admin.rpc('sync_admin_roles')
      if (syncError) console.error('[admin] role sync failed:', syncError.message)

      return NextResponse.json({
        status: 'VERIFIED',
        phone: record.phone,
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
    console.error('[verify.mn] status check failed:', messageOf(e))
    return NextResponse.json({ error: 'Төлөв шалгаж чадсангүй.' }, { status: 502 })
  }
}
