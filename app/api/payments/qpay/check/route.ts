import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { confirmOrderFromCallback } from '@/lib/qpay/orders'
import { isConfigured } from '@/lib/qpay/config'
import { failureOf, readOrderId } from '@/lib/qpay/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: 'qpay_unavailable' }, { status: 503 })

  let orderId: string | null
  try {
    orderId = await readOrderId(request)
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!orderId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: callerIsAdmin } = await supabase.rpc('is_admin')
  if (!callerIsAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { outcome } = await confirmOrderFromCallback(orderId, { admin: adminClient() })
    return NextResponse.json({ outcome })
  } catch (e) {
    const failure = failureOf(e)
    console.error('[qpay] manual check failed:', failure.message)
    return NextResponse.json({ error: failure.code ?? 'qpay_error' }, { status: failure.status })
  }
}
