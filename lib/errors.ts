export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

export function messageOf(e: unknown): string | undefined {
  return e instanceof Error ? e.message : undefined
}
