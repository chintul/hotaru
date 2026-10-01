import { NextResponse } from 'next/server'
import { getUploadAuthParams } from '@imagekit/next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await supabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string | null }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
  if (!privateKey || !publicKey) {
    return NextResponse.json({ error: 'ImageKit is not configured' }, { status: 503 })
  }

  const { token, signature, expire } = getUploadAuthParams({ privateKey, publicKey })

  return NextResponse.json({ token, signature, expire, publicKey })
}
