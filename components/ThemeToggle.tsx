'use client'

import { useTheme } from './ThemeProvider'
import { IconMoon, IconSun } from './Icons'

export default function ThemeToggle() {
  const { resolved, toggle } = useTheme()

  const label = resolved === 'dark' ? 'Цайвар байдалд шилжих' : 'Бараан байдалд шилжих'

  return (
    <button onClick={toggle} className="icon-btn" aria-label={label} title={label}>
      <IconSun className="theme-icon theme-icon-sun" aria-hidden="true" />
      <IconMoon className="theme-icon theme-icon-moon" aria-hidden="true" />
    </button>
  )
}
