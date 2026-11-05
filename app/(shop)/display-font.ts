import { Onest } from 'next/font/google'

export const displayFont = Onest({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  variable: '--font-display',
  display: 'swap',
})
