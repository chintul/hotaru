import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { createInvoiceForOrder } from '@/lib/qpay/orders'
import { isConfigured } from '@/lib/qpay/config'

export const dynamic = 'force-dynamic'

/**
 * Mint a QuickQR invoice for an order the caller owns.
 *
 * Ownership is established with the caller's own session, under RLS. Only then
 * does the service-role client come out, and only to write the invoice id onto
 * a payment row that already exists — storefront roles are SELECT-only.
 */
export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'qpay_unavailable' }, { status: 503 })
  }

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

  // Read as the caller: RLS decides whether this order is theirs to pay for.
  const { data: owned } = await supabase
    .from('orders').select('id').eq('id', orderId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const invoice = await createInvoiceForOrder(orderId, { admin: adminClient() })
    return NextResponse.json(invoice)
  } catch (e) {
    // A QPay outage must not look like a broken store: the order stands and the
    // page falls back to the bank-transfer instructions.
    console.error('[qpay] invoice creation failed:', e?.code ?? '', e?.message)
    return NextResponse.json({ error: e?.code ?? 'qpay_error' }, { status: e?.status ?? 502 })
  }
}
