import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VerifyMnError, createSession, generateCode, normalisePhone, verifyPhone, waitForVerification,
} from '../../lib/verify/mn.js'

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status, body = {}) => ({ ok: false, status, json: async () => body })

const SESSION = {
  sessionId: 'sess_1',
  phone: '99112233',
  shortcode: '144773',
  smsUri: 'sms:144773?body=482916',
  displayInstruction: '99112233 дугаараас 144773 руу 482916 гэж илгээнэ үү.',
  expiresAt: new Date(Date.now() + 300000).toISOString(),
}

test('code is six digits and fresh per call', () => {
  const codes = new Set(Array.from({ length: 50 }, () => generateCode()))
  for (const c of codes) assert.match(c, /^\d{6}$/)
  // Reusing a code across sessions would let an old SMS verify a new session.
  assert.ok(codes.size > 40, 'codes should not repeat')
})

test('phone is normalised to digits and range-checked', () => {
  assert.equal(normalisePhone('9911-2233'), '99112233')
  assert.equal(normalisePhone(' +976 9911 2233 '), '97699112233')
  assert.throws(() => normalisePhone('123'), (e) => e.code === 'BAD_PHONE')
})

test('createSession sends the key as a bearer and never in the body', async () => {
  process.env.VERIFY_MN_API_KEY = 'test-key'
  let seen
  const fetchImpl = async (url, init) => { seen = { url, init }; return ok(SESSION) }

  const s = await createSession('9911-2233', { code: '482916', fetchImpl })

  assert.equal(seen.url, 'https://api.verify.mn/sessions')
  assert.equal(seen.init.headers.authorization, 'Bearer test-key')
  const body = JSON.parse(seen.init.body)
  assert.equal(body.phone, '99112233')
  assert.equal(body.text, '482916')
  // Omitted on purpose when polling: verify.mn retries dead callbacks.
  assert.equal('callback' in body, false)
  assert.ok(!seen.init.body.includes('test-key'))
  assert.equal(s.code, '482916')
})

test('missing API key fails loudly rather than silently passing', async () => {
  delete process.env.VERIFY_MN_API_KEY
  await assert.rejects(
    () => createSession('99112233', { fetchImpl: async () => ok(SESSION) }),
    (e) => e instanceof VerifyMnError && e.code === 'NO_API_KEY',
  )
})

test('401 from a bad key surfaces as an error, not a false negative', async () => {
  process.env.VERIFY_MN_API_KEY = 'wrong-key'
  await assert.rejects(
    () => createSession('99112233', { fetchImpl: async () => fail(401) }),
    (e) => e instanceof VerifyMnError && e.status === 401,
  )
})

test('PENDING then VERIFIED resolves true and stops polling immediately', async () => {
  const statuses = ['PENDING', 'PENDING', 'VERIFIED', 'VERIFIED']
  let calls = 0
  const fetchImpl = async () => ok({ sessionId: 'sess_1', sessionStatus: statuses[calls++] })

  const res = await waitForVerification('sess_1', {
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    fetchImpl,
    sleepImpl: async () => {},
  })

  assert.equal(res.verified, true)
  // Every extra poll after VERIFIED is a wasted request; stop on the first one.
  assert.equal(calls, 3)
})

test('EXPIRED status resolves false', async () => {
  const fetchImpl = async () => ok({ sessionId: 'sess_1', sessionStatus: 'EXPIRED' })
  const res = await waitForVerification('sess_1', { fetchImpl, sleepImpl: async () => {} })
  assert.equal(res.verified, false)
  assert.equal(res.reason, 'EXPIRED')
})

test('deadline passing without VERIFIED resolves false', async () => {
  let t = 0
  const fetchImpl = async () => ok({ sessionId: 'sess_1', sessionStatus: 'PENDING' })
  const res = await waitForVerification('sess_1', {
    expiresAt: new Date(1000).toISOString(),
    fetchImpl,
    sleepImpl: async () => { t += 3000 },
    now: () => t,
  })
  assert.equal(res.verified, false)
  assert.equal(res.reason, 'EXPIRED')
})

test('hard timeout stops a session that never expires', async () => {
  let t = 0
  const fetchImpl = async () => ok({ sessionId: 'sess_1', sessionStatus: 'PENDING' })
  const res = await waitForVerification('sess_1', {
    // No expiresAt at all — only the hard timeout can end this.
    hardTimeoutMs: 9000,
    fetchImpl,
    sleepImpl: async () => { t += 3000 },
    now: () => t,
  })
  assert.equal(res.verified, false)
  assert.equal(res.reason, 'TIMEOUT')
})

test('verifyPhone returns true only after the phone is confirmed', async () => {
  process.env.VERIFY_MN_API_KEY = 'test-key'
  const statuses = ['PENDING', 'VERIFIED']
  let i = 0
  const fetchImpl = async (url, init) =>
    init?.method === 'POST' ? ok(SESSION) : ok({ sessionStatus: statuses[i++] })

  assert.equal(
    await verifyPhone('99112233', { fetchImpl, sleepImpl: async () => {} }),
    true,
  )
})

test('verifyPhone returns false when the session expires unconfirmed', async () => {
  process.env.VERIFY_MN_API_KEY = 'test-key'
  const fetchImpl = async (url, init) =>
    init?.method === 'POST'
      ? ok({ ...SESSION, expiresAt: new Date(Date.now() - 1).toISOString() })
      : ok({ sessionStatus: 'PENDING' })

  assert.equal(
    await verifyPhone('99112233', { fetchImpl, sleepImpl: async () => {} }),
    false,
  )
})
