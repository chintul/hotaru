import { renderNotification } from './templates.js'

const SANDBOX_FROM = 'hotaru <onboarding@resend.dev>'

/**
 * The single place a sending identity is decided.
 *
 * Env, not store_settings: an address only delivers if its domain is verified
 * inside the same Resend account the API key belongs to, so the two change
 * together at deploy time and neither is something the owner edits from
 * /admin. store_settings.email_from existed for this and was never read by any
 * code — dropped in 20260907160000_claim_receipt_and_email_identity.sql.
 *
 * The sandbox fallback keeps an unconfigured dev environment working, but that
 * address only delivers to the Resend account's own owner. The drain says so
 * in its result rather than letting `sent: 3` read as three people receiving
 * something.
 */
export function senderFrom(env = process.env) {
  const domain = env.RESEND_FROM_DOMAIN?.trim()
  return domain ? `hotaru <noreply@${domain}>` : SANDBOX_FROM
}

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
  const from = senderFrom()

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

  const notes = []
  if (!apiKey) notes.push('RESEND_API_KEY missing — rows returned to pending, nothing lost')
  if (from === SANDBOX_FROM) {
    notes.push('RESEND_FROM_DOMAIN missing — sending from the Resend sandbox address, which only delivers to the Resend account owner')
  }

  return {
    claimed: claimed.length,
    sent,
    failed,
    skipped,
    note: notes.length ? notes.join('; ') : undefined,
  }
}
