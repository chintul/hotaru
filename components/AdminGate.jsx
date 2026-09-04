'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { ME } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { useSession } from './useSession'

/**
 * Client-side gate. It hides the UI, it does not secure anything — every admin
 * action is enforced in Postgres by is_admin() inside the function, and by RLS
 * on every read. Someone bypassing this component sees empty lists and gets
 * "admin only" from the database.
 */
export default function AdminGate({ children }) {
  const { isAuthenticated, ready, user } = useSession()
  const { data, loading } = useQuery(ME, {
    // Must be filtered by our own id: an admin's RLS policy returns EVERY
    // profile, so an unfiltered `first: 1` reads a stranger's role.
    variables: { id: user?.id },
    skip: !isAuthenticated || !user?.id,
    // Role can change outside this tab; never gate on a cached copy.
    fetchPolicy: 'cache-and-network',
  })
  const profile = nodes(data?.profileCollection)[0]

  if (!ready || loading) return <p className="label text-ink-faint">Ачааллаж байна…</p>

  if (!isAuthenticated) {
    return (
      <div className="border border-line bg-paper-warm px-5 py-16 text-center">
        <p className="text-ink-soft">Админаар нэвтэрнэ үү.</p>
        <Link href="/login?next=/admin" className="label link-underline mt-4 inline-block">Нэвтрэх</Link>
      </div>
    )
  }
  if (profile?.role !== 'admin') {
    return (
      <div className="border border-line bg-paper-warm px-5 py-16 text-center">
        <p className="text-ink-soft">Танд админ эрх алга.</p>
        <p className="label mt-3 text-ink-faint">
          Supabase SQL editor дээр:
          <br />
          <code>update public.profiles set role = &apos;admin&apos; where email = &apos;…&apos;;</code>
        </p>
      </div>
    )
  }
  return children
}
