'use client'

import { useQuery } from '@apollo/client/react'
import { ME } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import type { Connection, Profile } from '@/lib/types'
import { useSession } from './useSession'
import { useAuthUpgrade } from './useAuthUpgrade'

interface MeData {
  profileCollection: Connection<Profile> | null
}

export interface AccountLink {
  href: string
  label: string
  icon: 'user' | 'orders' | 'heart' | 'admin'
}

export function useAccount() {
  const { ready, isAuthenticated, user } = useSession()
  const { signOut } = useAuthUpgrade()
  const { data } = useQuery<MeData>(ME, {
    variables: { id: user?.id ?? '' },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-first',
  })

  const profile = isAuthenticated ? firstNode(data?.profileCollection) : null
  const isAdmin = profile?.role === 'admin'
  const displayName =
    profile?.fullName?.trim() || profile?.email || profile?.phone || user?.email || user?.phone || null

  const links: AccountLink[] = isAuthenticated
    ? [
        { href: '/account', label: 'Профайл', icon: 'user' },
        { href: '/orders', label: 'Миний захиалга', icon: 'orders' },
        { href: '/wishlist', label: 'Хадгалсан', icon: 'heart' },
        ...(isAdmin ? [{ href: '/admin', label: 'Админ самбар', icon: 'admin' } satisfies AccountLink] : []),
      ]
    : [
        { href: '/login', label: 'Нэвтрэх', icon: 'user' },
        { href: '/orders', label: 'Захиалга хянах', icon: 'orders' },
        { href: '/wishlist', label: 'Хадгалсан', icon: 'heart' },
      ]

  return { ready, isAuthenticated, isAdmin, displayName, links, signOut }
}
