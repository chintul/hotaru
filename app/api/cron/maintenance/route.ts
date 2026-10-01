import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { drainNotifications } from '@/lib/email/drain'
import { hasWorkerSecret } from '@/lib/email/worker-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!hasWorkerSecret(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()

  const [users, carts] = await Promise.all([
    supabase.rpc('cleanup_anonymous_users', { older_than: '7 days' }),
    supabase.rpc('expire_stale_carts', { older_than: '30 days' }),
  ])

  const notifications = await drainNotifications(supabase)

  return NextResponse.json({
    anonymousUsersRemoved: users.data ?? 0,
    cartsExpired: carts.data ?? 0,
    notifications,
    errors: [users.error?.message, carts.error?.message, 'error' in notifications ? notifications.error : undefined].filter(Boolean),
  })
}
