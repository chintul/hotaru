import { createHmac, timingSafeEqual } from 'node:crypto'
import { qpayConfig } from './config.ts'

const SIGNATURE_FORMAT = /^[0-9a-f]{64}$/

export function signOrder(orderId: string): string {
  return createHmac('sha256', qpayConfig().callbackSecret).update(String(orderId)).digest('hex')
}

export function verifyOrder(orderId: string, token: unknown): boolean {
  if (typeof token !== 'string' || !SIGNATURE_FORMAT.test(token)) return false
  const expected = Buffer.from(signOrder(orderId), 'hex')
  const given = Buffer.from(token, 'hex')
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

export function callbackUrlFor(orderId: string, siteUrl: string): string {
  const base = String(siteUrl).replace(/\/+$/, '')
  return `${base}/api/payments/qpay/callback?order=${orderId}&t=${signOrder(orderId)}`
}
