/**
 * Signed callback URLs. SERVER ONLY.
 *
 * QuickQR echoes nothing of ours back — there is no sender_invoice_no — so the
 * order id has to ride in callback_url. Anyone who sees a QR sees that URL, so
 * the id is signed: a caller cannot swap in another order's id.
 *
 * The signature is not proof of payment. It only proves which order the
 * callback is about; whether money arrived is settled by /v2/payment/check.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { qpayConfig } from './config.js'

export function signOrder(orderId) {
  return createHmac('sha256', qpayConfig().callbackSecret).update(String(orderId)).digest('hex')
}

/** Timing-safe, and false rather than a throw for anything malformed. */
export function verifyOrder(orderId, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  const expected = Buffer.from(signOrder(orderId), 'hex')
  const given = Buffer.from(token, 'hex')
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

export function callbackUrlFor(orderId, siteUrl) {
  const base = String(siteUrl).replace(/\/+$/, '')
  return `${base}/api/payments/qpay/callback?order=${orderId}&t=${signOrder(orderId)}`
}
