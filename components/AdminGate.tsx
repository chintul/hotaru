'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@apollo/client/react'
import { ME } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import type { Connection, Profile } from '@/lib/types'
import { useSession } from './useSession'

interface MeData {
  profileCollection: Connection<Profile> | null
}

interface AdminGateProps {
  children: ReactNode
}

export default function AdminGate({ children }: AdminGateProps) {
  const router = useRouter()
  const { isAuthenticated, ready, user } = useSession()

  const { data, loading } = useQuery<MeData>(ME, {
    variables: { id: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })

  const profile = firstNode(data?.profileCollection)
  const isAdmin = profile?.role === 'admin'
  const accessKnown = ready && (!isAuthenticated || (!loading && Boolean(data)))

  useEffect(() => {
    if (!accessKnown) return
    if (!isAuthenticated) {
      router.replace('/login?next=/admin')
    } else if (!isAdmin) {
      router.replace('/')
    }
  }, [accessKnown, isAuthenticated, isAdmin, router])

  if (!accessKnown || !isAdmin) return null

  return children
}
