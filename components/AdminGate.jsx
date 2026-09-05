'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import { ME } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { useSession } from './useSession'

/**
 * Admin gate.
 *
 * A non-admin gets sent away rather than shown a locked door: rendering the
 * console shell and then explaining they may not use it advertises that the
 * area exists and looks broken to a normal customer. This hides the UI only —
 * every admin action is enforced in Postgres by is_admin() inside the function,
 * and by RLS on every read, so bypassing this component yields empty lists and
 * "admin only" from the database.
 */
export default function AdminGate({ children }) {
  const router = useRouter()
  const { isAuthenticated, ready, user } = useSession()

  const { data, loading } = useQuery(ME, {
    variables: { id: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })

  const profile = nodes(data?.profileCollection)[0]
  const isAdmin = profile?.role === 'admin'
  const decided = ready && (!isAuthenticated || (!loading && data))

  useEffect(() => {
    if (!decided) return
    if (!isAuthenticated) {
      router.replace('/login?next=/admin')
    } else if (!isAdmin) {
      router.replace('/')
    }
  }, [decided, isAuthenticated, isAdmin, router])

  // Render nothing at all until we know: a flash of the console for someone who
  // is about to be redirected is the thing this is avoiding.
  if (!decided || !isAdmin) return null

  return children
}
