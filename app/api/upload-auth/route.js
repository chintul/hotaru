import { NextResponse } from 'next/server'
import { getUploadAuthParams } from '@imagekit/next/server'
import { supabaseServer } from '@/lib/supabase/server'

// Never cache a signature.
export const dynamic = 'force-dynamic'

/**
 * Mints short-lived upload credentials for the ImageKit client SDK.
 *
 * The private key stays on the server — that is the entire point of this route.
 * It is also admin-gated: without the check, anyone who found the URL could
 * mint signatures and upload into your media library at your expense.
 */
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
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY) {
    return NextResponse.json({ error: 'ImageKit is not configured' }, { status: 503 })
  }

  const { token, signature, expire } = getUploadAuthParams({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
  })

  return NextResponse.json({
    token,
    signature,
    expire,
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
  })
}
