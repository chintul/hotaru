import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. Bypasses RLS, so it is only ever constructed inside a
 * route that has already established who is asking and what they may touch.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  })
}
