import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_NEXT = '/account'

function sameSitePath(requested: string | null): string {
  if (!requested) return DEFAULT_NEXT
  const isRelativePath = requested.startsWith('/') && !requested.startsWith('//')
  return isRelativePath ? requested : DEFAULT_NEXT
}

function publicOrigin(request: NextRequest, origin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (process.env.NODE_ENV === 'development' || !forwardedHost) return origin
  return `https://${forwardedHost}`
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sameSitePath(searchParams.get('next'))
  const base = publicOrigin(request, origin)

  if (code) {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
    console.error('[auth] oauth code exchange failed:', error.message)
  }

  return NextResponse.redirect(`${base}/login?oauth=failed&next=${encodeURIComponent(next)}`)
}
