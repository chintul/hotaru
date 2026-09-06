import { renderNotification } from '@/lib/email/templates'

/**
 * Drains the notification outbox.
 *
 * Extracted from the route so the daily maintenance job can run the same code
 * as its safety net. Nothing about claiming or retrying changed when the cron
 * went away: claiming is atomic (FOR UPDATE SKIP LOCKED inside
 * claim_notifications), so the trigger's kick racing the daily sweep still
 * never sends the same email twice. A failure backs off exponentially and
 * gives up after five attempts rather than spinning on a bad address.
 *
 * Takes a service_role client — the caller owns authorization.
 */
export async function drainNotifications(supabase, { batchSize = 20 } = {}) {
  const { data: claimed, error: claimError } = await supabase.rpc('claim_notifications', {
    batch_size: batchSize,
  })
  if (claimError) return { error: claimError.message }
  if (!claimed?.length) return { claimed: 0, sent: 0, failed: 0, skipped: 0 }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'hotaru <onboarding@resend.dev>'

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of claimed) {
    const { subject, html } = renderNotification(row.kind, row.payload)

    // Without a key there is nothing to send to. Return the row to `pending`
    // rather than burning attempts, so nothing is lost before Resend exists.
    if (!apiKey) {
      await supabase.rpc('mark_notification_failed', {
        notification_id: row.id,
        error_text: 'RESEND_API_KEY not configured',
      })
      skipped++
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

  return {
    claimed: claimed.length,
    sent,
    failed,
    skipped,
    note: apiKey ? undefined : 'RESEND_API_KEY missing — rows returned to pending, nothing lost',
  }
}
