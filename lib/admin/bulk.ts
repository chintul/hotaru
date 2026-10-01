export interface BulkFailure<Id> {
  id: Id
  message: string
}

export interface BulkResult<Id> {
  ok: Id[]
  failed: BulkFailure<Id>[]
}

export async function runBulk<Id>(
  ids: readonly Id[],
  fn: (id: Id) => Promise<unknown>,
): Promise<BulkResult<Id>> {
  const ok: Id[] = []
  const failed: BulkFailure<Id>[] = []

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

function messageOf(e: unknown): string {
  if (typeof e === 'string' && e) return e
  if (typeof e === 'object' && e !== null && 'message' in e && e.message) return String(e.message)
  return 'Тодорхойгүй алдаа'
}
