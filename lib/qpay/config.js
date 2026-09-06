/**
 * QPay QuickQR configuration.
 *
 * SERVER ONLY. Reads secrets; never import from a client component.
 *
 * All-or-nothing on purpose. On a previous QPay integration a single missing
 * variable turned the whole payment path into a silent 503 for weeks, because
 * "not configured" and "misconfigured" looked identical. Here they do not:
 * nothing set means off, some set means throw and say which.
 */

export class QPayError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'QPayError'
    this.status = status
    this.code = code
  }
}

const KEYS = [
  'QPAY_USERNAME', 'QPAY_PASSWORD', 'QPAY_TERMINAL_ID',
  'QPAY_MERCHANT_ID', 'QPAY_BASE_URL', 'QPAY_CALLBACK_SECRET',
]

/** True only when the whole set is present. A half-set is not "configured". */
export function isConfigured() {
  return KEYS.every((k) => Boolean(process.env[k]))
}

export function qpayConfig() {
  const missing = KEYS.filter((k) => !process.env[k])
  if (missing.length === KEYS.length) {
    throw new QPayError('QPay is not configured', { code: 'NOT_CONFIGURED' })
  }
  if (missing.length) {
    throw new QPayError(`QPay config incomplete, missing: ${missing.join(', ')}`,
      { code: 'PARTIAL_CONFIG' })
  }
  return {
    baseUrl: process.env.QPAY_BASE_URL.replace(/\/+$/, ''),
    username: process.env.QPAY_USERNAME,
    password: process.env.QPAY_PASSWORD,
    terminalId: process.env.QPAY_TERMINAL_ID,
    merchantId: process.env.QPAY_MERCHANT_ID,
    callbackSecret: process.env.QPAY_CALLBACK_SECRET,
  }
}
