import { isRecord } from '../http.ts'

export interface Failure {
  code: unknown
  status: number
  message: string | undefined
}

export function failureOf(e: unknown): Failure {
  if (!isRecord(e)) return { code: undefined, status: 502, message: undefined }
  return {
    code: e.code ?? undefined,
    status: typeof e.status === 'number' ? e.status : 502,
    message: typeof e.message === 'string' ? e.message : undefined,
  }
}

export async function readOrderId(request: Request): Promise<string | null> {
  const body: unknown = await request.json()
  if (!isRecord(body)) throw new TypeError('body is not an object')
  return typeof body.orderId === 'string' && body.orderId ? body.orderId : null
}
