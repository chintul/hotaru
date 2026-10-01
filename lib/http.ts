export interface FetchInit {
  method: string
  headers: Record<string, string>
  body?: string
}

export interface FetchResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>

export async function readJson(res: FetchResponse): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function field(payload: unknown, key: string): unknown {
  return isRecord(payload) ? payload[key] : undefined
}
