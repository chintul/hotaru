export interface QPayErrorDetails {
  status?: number
  code?: string
  payload?: unknown
}

export class QPayError extends Error {
  status: number | undefined
  code: string | undefined
  payload: unknown

  constructor(message: string, { status, code, payload }: QPayErrorDetails = {}) {
    super(message)
    this.name = 'QPayError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export function describe(detail: unknown): string {
  if (detail === null || detail === undefined) return ''
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

const KEYS = [
  'QPAY_USERNAME', 'QPAY_PASSWORD', 'QPAY_TERMINAL_ID',
  'QPAY_MERCHANT_ID', 'QPAY_BASE_URL', 'QPAY_CALLBACK_SECRET',
] as const

export interface QPayConfig {
  baseUrl: string
  username: string
  password: string
  terminalId: string
  merchantId: string
  callbackSecret: string
}

const read = (key: (typeof KEYS)[number]): string => process.env[key] ?? ''

export function isConfigured(): boolean {
  return KEYS.every((k) => Boolean(read(k)))
}

export function qpayConfig(): QPayConfig {
  const missing = KEYS.filter((k) => !read(k))
  if (missing.length === KEYS.length) {
    throw new QPayError('QPay is not configured', { code: 'NOT_CONFIGURED' })
  }
  if (missing.length) {
    throw new QPayError(`QPay config incomplete, missing: ${missing.join(', ')}`,
      { code: 'PARTIAL_CONFIG' })
  }
  return {
    baseUrl: read('QPAY_BASE_URL').replace(/\/+$/, ''),
    username: read('QPAY_USERNAME'),
    password: read('QPAY_PASSWORD'),
    terminalId: read('QPAY_TERMINAL_ID'),
    merchantId: read('QPAY_MERCHANT_ID'),
    callbackSecret: read('QPAY_CALLBACK_SECRET'),
  }
}
