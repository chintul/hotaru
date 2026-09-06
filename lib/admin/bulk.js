/**
 * Runs one mutation per id, sequentially, collecting failures instead of
 * throwing on the first one.
 *
 * This exists for orders. `admin_set_order_status` refuses fulfilment states
 * before payment is confirmed and refuses cancellation outright, so a
 * selection of twenty will routinely contain rows that must fail while the
 * rest succeed — partial success is the correct answer, not an error.
 *
 * Sequential rather than parallel on purpose: a guard failure stays
 * attributable to its own row, and the database is not hit with twenty
 * concurrent `select ... for update` locks.
 */
export async function runBulk(ids, fn) {
  const ok = []
  const failed = []

  for (const id of ids) {
    try {
      await fn(id)
      ok.push(id)
    } catch (e) {
      failed.push({ id, message: messageOf(e) })
    }
  }

  return { ok, failed }
}

function messageOf(e) {
  if (typeof e === 'string' && e) return e
  if (e?.message) return String(e.message)
  return 'Тодорхойгүй алдаа'
}
