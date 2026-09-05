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

  if (!ready || loading) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-a-line bg-white px-6 py-16 text-center">
        <p className="text-[14px] text-a-ink">Админаар нэвтэрнэ үү.</p>
        <Link href="/login?next=/admin" className="mt-4 inline-block rounded-md bg-a-ink px-4 py-2 text-[13px] font-medium text-white">
          Нэвтрэх
        </Link>
      </div>
    )
  }
  if (profile?.role !== 'admin') {
    return (
      <div className="rounded-lg border border-a-line bg-white px-6 py-16 text-center">
        <p className="text-[14px] text-a-ink">Танд админ эрх алга.</p>
        <p className="mt-3 text-[12px] text-a-muted">
          Supabase SQL editor дээр:
          <br />
          <code>update public.profiles set role = &apos;admin&apos; where email = &apos;…&apos;;</code>
        </p>
      </div>
    )
  }
  return children
}
