export const THEME_KEY = 'hotaru-theme'

export const PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof PREFERENCES)[number]

export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#fbfcfe', dark: '#13191f' }

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value)
