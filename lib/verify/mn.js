/**
 * verify.mn — Mongolia-only Mobile-Originated (MO) SMS phone verification.
 *
 * SERVER ONLY. Imports node:crypto and reads VERIFY_MN_API_KEY, so it must
 * never be pulled into a client bundle; the browser talks to /api/verify/*.
 *
 * The flow is inverted from a normal OTP: we do NOT send the user a code. We
 * mint a code, the user texts it to shortcode 144773 from the phone they are
 * claiming, and verify.mn tells us it arrived. That is what makes it proof of
 * possession — the SMS must originate from that number.
 *
 * Two consequences shape this module:
 *
 *  - Every SMS costs the user 150₮ whether it matches or not. So we stop
 *    polling the instant a session is VERIFIED, and never ask them to send
 *    twice for the same session.
 *  - The reply SMS is carrier-dependent (Unitel substitutes its own text, Lime
 *    sends nothing). It is never treated as confirmation; only sessionStatus is.
 */

import { randomInt } from 'node:crypto'

const API = 'https://api.verify.mn'
const SHORTCODE = '144773'
const POLL_INTERVAL_MS = 3000

export class VerifyMnError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'VerifyMnError'
    this.status = status
    this.code = code
  }
}

/** Fail loudly rather than silently degrading to "unverified means verified". */
function apiKey() {
  const key = process.env.VERIFY_MN_API_KEY
  if (!key) {
    throw new VerifyMnError('VERIFY_MN_API_KEY is not set', { code: 'NO_API_KEY' })
  }
  return key
}

export function isConfigured() {
  return Boolean(process.env.VERIFY_MN_API_KEY)
}

/**
 * Six digits, uniformly random, fresh per session.
 *
 * crypto.randomInt avoids the modulo bias of Math.random()*900000 and is
 * available in the Node runtime without a dependency.
 */
export function generateCode(rng = randomInt) {
  return String(rng(100000, 1000000))
}

/** Digits only, 8–16, as the API requires. */
export function normalisePhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 16) {
    throw new VerifyMnError('phone must be 8-16 digits', { code: 'BAD_PHONE' })
  }
  return digits
}

async function request(path, { method = 'GET', body, auth = false, fetchImpl = fetch } = {}) {
  const headers = { accept: 'application/json' }
  if (body) headers['content-type'] = 'application/json'
  // The key goes on the wire and nowhere else — never into a log line.
  if (auth) headers.authorization = `Bearer ${apiKey()}`

  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload = null
  try { payload = await res.json() } catch { /* non-JSON error body */ }

  if (!res.ok) {
    const message =
      res.status === 401 ? 'verify.mn rejected the API key'
      : res.status === 404 ? 'verification session not found'
      : payload?.message ?? `verify.mn returned ${res.status}`
    throw new VerifyMnError(message, { status: res.status })
  }
  return payload
}

/**
 * Opens a session. Returns everything the UI needs, including the
 * `displayInstruction` which MUST be shown verbatim — it names the number the
 * user has to send from, and sending from a different SIM is the single most
 * common failure.
 *
 * `callback` is deliberately optional and omitted when we intend to poll:
 * verify.mn retries failed callbacks, so registering a URL we do not serve
 * would generate repeated dead deliveries.
 */
export async function createSession(phone, { code, callback, responseSms, fetchImpl } = {}) {
  const text = code ?? generateCode()
  const body = { phone: normalisePhone(phone), text }
  if (callback) body.callback = callback
  if (responseSms) body.responseSms = responseSms

  const session = await request('/sessions', { method: 'POST', body, auth: true, fetchImpl })
  return { ...session, code: text, shortcode: session?.shortcode ?? SHORTCODE }
}

export async function getSession(sessionId, { fetchImpl } = {}) {
  return request(`/sessions/${encodeURIComponent(sessionId)}`, { fetchImpl })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Polls until VERIFIED, EXPIRED, or the deadline passes.
 *
 * The hard deadline is belt-and-braces on top of expiresAt: a stalled or
 * mis-clocked session must not leave a request hanging forever.
 */
export async function waitForVerification(sessionId, {
  expiresAt,
  intervalMs = POLL_INTERVAL_MS,
  hardTimeoutMs = 6 * 60 * 1000,
  fetchImpl,
  sleepImpl = sleep,
  now = () => Date.now(),
} = {}) {
  const started = now()
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : Infinity

  for (;;) {
    const session = await getSession(sessionId, { fetchImpl })

    if (session?.sessionStatus === 'VERIFIED') return { verified: true, session }
    if (session?.sessionStatus === 'EXPIRED') return { verified: false, reason: 'EXPIRED', session }

    if (now() >= expiryMs) return { verified: false, reason: 'EXPIRED', session }
    if (now() - started >= hardTimeoutMs) return { verified: false, reason: 'TIMEOUT', session }

    await sleepImpl(intervalMs)
  }
}

/**
 * One-shot helper matching the brief: true only once the phone is confirmed.
 *
 * Server-side use only. Interactive flows should call createSession, show the
 * instruction, then poll — this blocks for up to five minutes.
 */
export async function verifyPhone(phone, options = {}) {
  const session = await createSession(phone, options)
  const result = await waitForVerification(session.sessionId, {
    expiresAt: session.expiresAt,
    ...options,
  })
  return result.verified
}

export { SHORTCODE, POLL_INTERVAL_MS }
