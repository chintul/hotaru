import { test } from 'node:test'
import assert from 'node:assert/strict'
import { senderFrom } from '../../lib/email/drain.js'

// The bug this pins: drain.js read RESEND_FROM while .env.local defined
// RESEND_FROM_DOMAIN, so every email silently went out from Resend's sandbox
// sender — which only delivers to the Resend account owner. One name, one
// source, asserted.
test('the sending address is built from the verified domain', () => {
  assert.equal(senderFrom({ RESEND_FROM_DOMAIN: 'hotaru.mn' }), 'hotaru <noreply@hotaru.mn>')
})

test('whitespace around the domain does not produce a broken address', () => {
  assert.equal(senderFrom({ RESEND_FROM_DOMAIN: '  hotaru.mn ' }), 'hotaru <noreply@hotaru.mn>')
})

test('no domain falls back to the sandbox sender rather than an invalid one', () => {
  for (const env of [{}, { RESEND_FROM_DOMAIN: '' }, { RESEND_FROM_DOMAIN: '   ' }]) {
    assert.equal(senderFrom(env), 'hotaru <onboarding@resend.dev>')
  }
})
