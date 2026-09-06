import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { drainNotifications } from '@/lib/email/drain'

export const dynamic = 'force-dynamic'

/**
 * Daily housekeeping: sweep stale anonymous users and expire abandoned carts,
 * then drain any notification the trigger's kick failed to deliver.
 * Anonymous sign-in is the cart identity, so auth.users grows with every
 * visitor; without this it never stops growing.
 */
export async function GET(request) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET
  const header = request.headers.get('authorization')
  const url = new URL(request.url)
  if (!secret || (header !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const [users, carts] = await Promise.all([
    supabase.rpc('cleanup_anonymous_users', { older_than: '7 days' }),
    supabase.rpc('expire_stale_carts', { older_than: '30 days' }),
  ])

  // Safety net. Postgres kicks the drain the instant a row is queued, so this
  // normally finds nothing. It exists for the cases the kick cannot cover: the
  // route was down, Resend was failing, or the Vault secrets were not yet set.
  // Without it those rows would wait for the next order instead of a day.
  const notifications = await drainNotifications(supabase)

  return NextResponse.json({
    anonymousUsersRemoved: users.data ?? 0,
    cartsExpired: carts.data ?? 0,
    notifications,
    errors: [users.error?.message, carts.error?.message, notifications.error].filter(Boolean),
  })
}
