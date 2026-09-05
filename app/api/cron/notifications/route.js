import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderNotification } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Drains the notification outbox.
 *
 * Runs as service_role, which bypasses RLS — hence the shared-secret gate: this
 * route must not be triggerable by anyone who discovers the URL. Vercel Cron
 * sends the secret as a bearer token; `?secret=` is accepted for manual runs.
 *
 * Claiming is atomic (FOR UPDATE SKIP LOCKED inside claim_notifications), so two
 * overlapping cron invocations never send the same email twice. A failure backs
 * off exponentially and gives up after five attempts rather than spinning on a
 * permanently bad address.
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

  const { data: claimed, error: claimError } = await supabase.rpc('claim_notifications', { batch_size: 20 })
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 })
  }
  if (!claimed?.length) {
    return NextResponse.json({ claimed: 0, sent: 0, failed: 0 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'hotaru <onboarding@resend.dev>'

  let sent = 0
  let failed = 0
  const skipped = []

  for (const row of claimed) {
    const { subject, html } = renderNotification(row.kind, row.payload)

    // Without a key there is nothing to send to. Return the row to `pending`
    // rather than burning attempts, so nothing is lost before Resend exists.
    if (!apiKey) {
      await supabase.rpc('mark_notification_failed', {
        notification_id: row.id,
        error_text: 'RESEND_API_KEY not configured',
      })
      skipped.push(row.kind)
      continue
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [row.recipient_email], subject, html }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        await supabase.rpc('mark_notification_failed', {
          notification_id: row.id,
          error_text: `${res.status} ${body?.message ?? 'send failed'}`.slice(0, 500),
        })
        failed++
      } else {
        await supabase.rpc('mark_notification_sent', {
          notification_id: row.id,
          provider_message_id: body?.id ?? null,
        })
        sent++
      }
    } catch (e) {
      await supabase.rpc('mark_notification_failed', {
        notification_id: row.id,
        error_text: String(e?.message ?? e).slice(0, 500),
      })
      failed++
    }
  }

  return NextResponse.json({
    claimed: claimed.length,
    sent,
    failed,
    skipped: skipped.length,
    note: apiKey ? undefined : 'RESEND_API_KEY missing — rows returned to pending, nothing lost',
  })
}

export const POST = GET
