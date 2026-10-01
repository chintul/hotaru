export function hasWorkerSecret(request: Request): boolean {
  const secret = process.env.NOTIFICATION_WORKER_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const url = new URL(request.url)
  return header === `Bearer ${secret}` || url.searchParams.get('secret') === secret
}
