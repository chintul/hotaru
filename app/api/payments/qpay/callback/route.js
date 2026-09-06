import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyOrder } from '@/lib/qpay/callback-token'
import { confirmOrderFromCallback } from '@/lib/qpay/orders'

export const dynamic = 'force-dynamic'

/**
 * QPay QuickQR callback.
 *
 * A wake-up signal, never evidence. The body is not read at all: the order id
 * comes from the signed query string, and whether money arrived is settled by
 * POST /v2/payment/check inside confirmOrderFromCallback.
 *
 * Always answers 200. A non-2xx only makes QPay retry a request that will fail
 * the same way, and there is nothing a retry could fix here.
 *
 * Both verbs are handled because QPay's callback method is not pinned by the
 * docs, and a callback that arrives on the wrong verb is a payment that never
 * confirms.
 */
async function handle(request) {
  const url = new URL(request.url)
  const orderId = url.searchParams.get('order')
  const token = url.searchParams.get('t')

  if (!orderId || !verifyOrder(orderId, token)) {
    console.warn('[qpay] callback with a bad or missing signature')
    return new NextResponse('ok', { status: 200 })
  }

  try {
    const { outcome } = await confirmOrderFromCallback(orderId, { admin: adminClient() })
    console.info(`[qpay] callback for ${orderId}: ${outcome}`)
  } catch (e) {
    console.error('[qpay] callback handling failed:', e?.message)
  }

  return new NextResponse('ok', { status: 200 })
}

export const GET = handle
export const POST = handle
