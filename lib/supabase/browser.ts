'use client'

import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../env.ts'

let clientPromise: Promise<SupabaseClient> | undefined

export async function supabaseBrowser(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/ssr').then(({ createBrowserClient }) =>
    createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY),
  )
  return clientPromise
}

async function discardLocalSession(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
}

export async function ensureSession(): Promise<Session | null> {
  const supabase = await supabaseBrowser()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    await discardLocalSession(supabase)
  } else if (session) {
    const { error: userLookupError } = await supabase.auth.getUser()
    if (!userLookupError) return session

    console.warn('[auth] session belongs to a user that no longer exists; starting fresh')
    await discardLocalSession(supabase)
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('[auth] anonymous sign-in failed:', error.message)
    return null
  }
  return data.session
}
