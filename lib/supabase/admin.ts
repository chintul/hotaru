import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '../env.ts'

export type AdminClient = SupabaseClient

export function adminClient(): AdminClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
  })
}
