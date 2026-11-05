'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import { useTheme, type ThemePreference } from './ThemeProvider'
import { useAccount, type AccountLink } from './useAccount'
import {
  IconHeart,
  IconLogOut,
  IconMonitor,
  IconMoon,
  IconPackage,
  IconShield,
  IconSun,
  IconUser,
  type IconProps,
} from './Icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export const LINK_ICON: Record<AccountLink['icon'], ComponentType<IconProps>> = {
  user: IconUser,
  orders: IconPackage,
  heart: IconHeart,
  admin: IconShield,
}

export const THEME_CHOICES: readonly { value: ThemePreference; label: string; labelEn: string; icon: ComponentType<IconProps> }[] = [
  { value: 'system', label: 'Систем', labelEn: 'System', icon: IconMonitor },
  { value: 'light', label: 'Цайвар', labelEn: 'Light', icon: IconSun },
  { value: 'dark', label: 'Бараан', labelEn: 'Dark', icon: IconMoon },
]

const isThemeChoice = (value: string): value is ThemePreference =>
  THEME_CHOICES.some((c) => c.value === value)

const ITEM = 'min-h-10 gap-3 rounded-lg px-3 text-[14px]'

export default function UserMenu() {
  const { isAuthenticated, displayName, links, signOut } = useAccount()
  const { preference, setPreference } = useTheme()
  const t = useT()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-touch" aria-label={t('Хэрэглэгчийн цэс', 'Account menu')}>
          <IconUser />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl p-1.5">
        {isAuthenticated && displayName && (
          <>
            <DropdownMenuLabel className="px-3 py-2">
              <span className="block text-[11px] font-normal text-muted-foreground">{t('Нэвтэрсэн', 'Signed in as')}</span>
              <span className="block truncate text-[14px] font-semibold">{displayName}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {links.map((link) => {
          const Icon = LINK_ICON[link.icon]
          return (
            <DropdownMenuItem key={link.href} asChild className={ITEM}>
              <Link href={link.href}>
                <Icon width="18" height="18" aria-hidden="true" />
                {link.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[11px] font-normal text-muted-foreground">{t('Өнгөний горим', 'Appearance')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => { if (isThemeChoice(value)) setPreference(value) }}
        >
          {THEME_CHOICES.map(({ value, label, labelEn, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className={cn(ITEM, 'pl-8')}>
              <Icon width="18" height="18" aria-hidden="true" />
              {t(label, labelEn)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={ITEM} onSelect={() => { void signOut() }}>
              <IconLogOut width="18" height="18" aria-hidden="true" />
              {t('Гарах', 'Sign out')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
