import { randomInt } from 'node:crypto'
import { field, readJson, type FetchLike } from '../http.ts'

const API = 'https://api.verify.mn'
const SHORTCODE = '144773'
const POLL_INTERVAL_MS = 3000
const HARD_TIMEOUT_MS = 6 * 60 * 1000

export type SessionStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED'

export interface VerifySession {
  sessionId: string
  phone: string
  expiresAt: string
  shortcode?: string
  smsUri?: string
  displayInstruction?: string
  sessionStatus?: SessionStatus | string
}

export interface CreatedSession extends VerifySession {
  code: string
  shortcode: string
}

export class VerifyMnError extends Error {
  status: number | undefined
  code: string | undefined

  constructor(message: string, { status, code }: { status?: number; code?: string } = {}) {
    super(message)
    this.name = 'VerifyMnError'
    this.status = status
    this.code = code
  }
}

function apiKey(): string {
  const key = process.env.VERIFY_MN_API_KEY
  if (!key) {
    throw new VerifyMnError('VERIFY_MN_API_KEY is not set', { code: 'NO_API_KEY' })
  }
  return key
}

export function isConfigured(): boolean {
  return Boolean(process.env.VERIFY_MN_API_KEY)
}

export function generateCode(rng: (min: number, max: number) => number = randomInt): string {
  return String(rng(100000, 1000000))
}

export function normalisePhone(phone: string | number | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 16) {
    throw new VerifyMnError('phone must be 8-16 digits', { code: 'BAD_PHONE' })
  }
  return digits
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  auth?: boolean
  fetchImpl?: FetchLike
}

async function request<T>(path: string, { method = 'GET', body, auth = false, fetchImpl = fetch }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body) headers['content-type'] = 'application/json'
  if (auth) headers.authorization = `Bearer ${apiKey()}`

  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await readJson(res)

  if (!res.ok) {
    const message =
      res.status === 401 ? 'verify.mn rejected the API key'
      : res.status === 404 ? 'verification session not found'
      : (field(payload, 'message') as string | undefined) ?? `verify.mn returned ${res.status}`
    throw new VerifyMnError(message, { status: res.status })
  }
  return payload as T
}

export interface CreateSessionOptions {
  code?: string
  callback?: string
  responseSms?: string
  fetchImpl?: FetchLike
}

export async function createSession(
  phone: string,
  { code, callback, responseSms, fetchImpl }: CreateSessionOptions = {},
): Promise<CreatedSession> {
  const text = code ?? generateCode()
  const body: Record<string, unknown> = { phone: normalisePhone(phone), text }
  if (callback) body.callback = callback
  if (responseSms) body.responseSms = responseSms

  const session = await request<VerifySession | null>('/sessions', { method: 'POST', body, auth: true, fetchImpl })
  return { ...(session as VerifySession), code: text, shortcode: session?.shortcode ?? SHORTCODE }
}

export async function getSession(
  sessionId: string,
  { fetchImpl }: { fetchImpl?: FetchLike } = {},
): Promise<VerifySession | null> {
  return request<VerifySession | null>(`/sessions/${encodeURIComponent(sessionId)}`, { fetchImpl })
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface WaitOptions {
  expiresAt?: string
  intervalMs?: number
  hardTimeoutMs?: number
  fetchImpl?: FetchLike
  sleepImpl?: (ms: number) => Promise<void>
  now?: () => number
}

export type VerificationResult =
  | { verified: true; session: VerifySession | null }
  | { verified: false; reason: 'EXPIRED' | 'TIMEOUT'; session: VerifySession | null }

export async function waitForVerification(
  sessionId: string,
  {
    expiresAt,
    intervalMs = POLL_INTERVAL_MS,
    hardTimeoutMs = HARD_TIMEOUT_MS,
    fetchImpl,
    sleepImpl = sleep,
    now = () => Date.now(),
  }: WaitOptions = {},
): Promise<VerificationResult> {
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

export async function verifyPhone(
  phone: string,
  options: CreateSessionOptions & WaitOptions = {},
): Promise<boolean> {
  const session = await createSession(phone, options)
  const result = await waitForVerification(session.sessionId, {
    expiresAt: session.expiresAt,
    ...options,
  })
  return result.verified
}

export { SHORTCODE, POLL_INTERVAL_MS }
