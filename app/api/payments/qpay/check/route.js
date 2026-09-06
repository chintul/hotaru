import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { confirmOrderFromCallback } from '@/lib/qpay/orders'
import { isConfigured } from '@/lib/qpay/config'

export const dynamic = 'force-dynamic'

/**
 * On-demand invoice check, for when a callback never arrived.
 *
 * Admin only, and deliberately manual: QPay's docs forbid polling this endpoint
 * on a schedule, so the retry is a button rather than a cron.
 */
export async function POST(request) {
  if (!isConfigured()) return NextResponse.json({ error: 'qpay_unavailable' }, { status: 503 })

  let orderId
  try {
    ({ orderId } = await request.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!orderId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // is_admin() reads the caller's own JWT, so this asks the database rather
  // than trusting anything the client sent.
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { outcome } = await confirmOrderFromCallback(orderId, { admin: adminClient() })
    return NextResponse.json({ outcome })
  } catch (e) {
    console.error('[qpay] manual check failed:', e?.message)
    return NextResponse.json({ error: e?.code ?? 'qpay_error' }, { status: e?.status ?? 502 })
  }
}
