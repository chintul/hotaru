import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyOrder } from '@/lib/qpay/callback-token'
import { confirmOrderFromCallback } from '@/lib/qpay/orders'
import { messageOf } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const acknowledge = () => new NextResponse('ok', { status: 200 })

async function handle(request: NextRequest) {
  const url = new URL(request.url)
  const orderId = url.searchParams.get('order')
  const token = url.searchParams.get('t')

  if (!orderId || !verifyOrder(orderId, token)) {
    console.warn('[qpay] callback with a bad or missing signature')
    return acknowledge()
  }

  try {
    const { outcome } = await confirmOrderFromCallback(orderId, { admin: adminClient() })
    console.info(`[qpay] callback for ${orderId}: ${outcome}`)
  } catch (e) {
    console.error('[qpay] callback handling failed:', messageOf(e))
  }

  return acknowledge()
}

export const GET = handle
export const POST = handle
