'use client'

import { useQuery } from '@apollo/client/react'
import { ME } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import type { Connection, Profile } from '@/lib/types'
import { useSession } from './useSession'
import { useAuthUpgrade } from './useAuthUpgrade'
import { useT } from '@/lib/i18n'

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
  const t = useT()
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
        { href: '/account', label: t('Профайл', 'Profile'), icon: 'user' },
        { href: '/orders', label: t('Миний захиалга', 'My orders'), icon: 'orders' },
        { href: '/wishlist', label: t('Хадгалсан', 'Saved'), icon: 'heart' },
        ...(isAdmin ? [{ href: '/admin', label: t('Админ самбар', 'Admin dashboard'), icon: 'admin' } satisfies AccountLink] : []),
      ]
    : [
        { href: '/login', label: t('Нэвтрэх', 'Sign in'), icon: 'user' },
        { href: '/orders', label: t('Захиалга хянах', 'Track an order'), icon: 'orders' },
        { href: '/wishlist', label: t('Хадгалсан', 'Saved'), icon: 'heart' },
      ]

  return { ready, isAuthenticated, isAdmin, displayName, links, signOut }
}
