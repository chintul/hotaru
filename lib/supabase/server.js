import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/** Server-side client bound to the request's cookies. Next 16: cookies() is async. */
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session instead, so this is safe to ignore.
          }
        },
      },
    },
  )
}
