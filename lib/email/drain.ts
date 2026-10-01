import { renderNotification, type NotificationPayload } from './templates.ts'
import { field } from '../http.ts'
import type { AdminClient } from '../supabase/admin.ts'

const SANDBOX_FROM = 'hotaru <onboarding@resend.dev>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const ERROR_TEXT_LIMIT = 500

interface OutboxRow {
  id: string
  kind: string
  recipient_email: string
  payload: NotificationPayload | null
}

export type DrainResult =
  | { error: string }
  | { claimed: number; sent: number; failed: number; skipped: number; note?: string }

export function senderFrom(env: Partial<Record<string, string>> = process.env): string {
  const domain = env.RESEND_FROM_DOMAIN?.trim()
  return domain ? `hotaru <noreply@${domain}>` : SANDBOX_FROM
}

const markFailed = (supabase: AdminClient, id: string, errorText: string) =>
  supabase.rpc('mark_notification_failed', {
    notification_id: id,
    error_text: errorText,
  })

export async function drainNotifications(
  supabase: AdminClient,
  { batchSize = 20 }: { batchSize?: number } = {},
): Promise<DrainResult> {
  const { data, error: claimError } = await supabase.rpc('claim_notifications', {
    batch_size: batchSize,
  })
  if (claimError) return { error: claimError.message }
  const claimed: OutboxRow[] | null = data
  if (!claimed?.length) return { claimed: 0, sent: 0, failed: 0, skipped: 0 }

  const apiKey = process.env.RESEND_API_KEY
  const from = senderFrom()

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of claimed) {
    const { subject, html } = renderNotification(row.kind, row.payload)

    if (!apiKey) {
      await markFailed(supabase, row.id, 'RESEND_API_KEY not configured')
      skipped++
      continue
    }

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [row.recipient_email], subject, html }),
      })
      const body: unknown = await res.json().catch(() => ({}))

      if (!res.ok) {
        await markFailed(
          supabase,
          row.id,
          `${res.status} ${field(body, 'message') ?? 'send failed'}`.slice(0, ERROR_TEXT_LIMIT),
        )
        failed++
      } else {
        await supabase.rpc('mark_notification_sent', {
          notification_id: row.id,
          provider_message_id: field(body, 'id') ?? null,
        })
        sent++
      }
    } catch (e) {
      await markFailed(supabase, row.id, String(field(e, 'message') ?? e).slice(0, ERROR_TEXT_LIMIT))
      failed++
    }
  }

  const notes: string[] = []
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
