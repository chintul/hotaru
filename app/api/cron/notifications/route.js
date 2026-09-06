import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { drainNotifications } from '@/lib/email/drain'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Drains the notification outbox.
 *
 * No longer a cron target despite the path: since the notify-without-cron
 * migration this is called by Postgres itself, via pg_net, the moment a trigger
 * queues a row. The path is kept because the URL lives in a Vault secret that
 * every environment would have to be re-provisioned to change.
 *
 * Runs as service_role, which bypasses RLS — hence the shared-secret gate: this
 * route must not be triggerable by anyone who discovers the URL. pg_net sends
 * the secret as a bearer token; `?secret=` is accepted for manual runs.
 */
function authorized(request) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const url = new URL(request.url)
  return header === `Bearer ${secret}` || url.searchParams.get('secret') === secret
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'service role key not configured' }, { status: 503 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  })

  const result = await drainNotifications(supabase)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json(result)
}

export const POST = GET
