import { test } from 'node:test'
import assert from 'node:assert/strict'
import { senderFrom } from '../../lib/email/drain.ts'

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
