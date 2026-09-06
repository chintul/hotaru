import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBulk } from '../../lib/admin/bulk.js'

test('every id is attempted and the successes are reported', async () => {
  const seen = []
  const res = await runBulk(['a', 'b', 'c'], async (id) => { seen.push(id) })
  assert.deepEqual(seen, ['a', 'b', 'c'])
  assert.deepEqual(res.ok, ['a', 'b', 'c'])
  assert.deepEqual(res.failed, [])
})

test('a rejection is recorded and does NOT abort the batch', async () => {
  // The orders case: one unpaid order must not stop the other nineteen.
  const res = await runBulk(['a', 'b', 'c'], async (id) => {
    if (id === 'b') throw new Error('cannot mark shipped before payment is confirmed')
  })
  assert.deepEqual(res.ok, ['a', 'c'])
  assert.deepEqual(res.failed, [
    { id: 'b', message: 'cannot mark shipped before payment is confirmed' },
  ])
})

test('runs strictly in sequence, never in parallel', async () => {
  // Parallel would stack `for update` locks and scramble attribution.
  let inFlight = 0
  let maxInFlight = 0
  await runBulk(['a', 'b', 'c'], async () => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 1))
    inFlight -= 1
  })
  assert.equal(maxInFlight, 1)
})

test('a thrown non-Error still yields a readable message', async () => {
  const res = await runBulk(['a'], async () => { throw 'plain string' })
  assert.equal(res.failed[0].message, 'plain string')

  const res2 = await runBulk(['a'], async () => { throw { nope: true } })
  assert.equal(typeof res2.failed[0].message, 'string')
  assert.ok(res2.failed[0].message.length > 0, 'never an empty message')
})

test('an empty selection is a no-op, not a crash', async () => {
  const res = await runBulk([], async () => { throw new Error('should not run') })
  assert.deepEqual(res, { ok: [], failed: [] })
})
