/**
 * Inline SVG icon set matching the reference storefront's header and controls.
 * Inline rather than an icon package: eight icons do not justify a dependency,
 * and these inherit currentColor so they work on both the light header and the
 * dark footer without a second variant.
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </svg>
)

export const IconUser = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
)

export const IconHeart = ({ filled = false, ...p }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
  </svg>
)

export const IconBag = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)

export const IconChevronLeft = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="m14 6-6 6 6 6" /></svg>
)
export const IconChevronRight = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="m10 6 6 6-6 6" /></svg>
)
export const IconChevronDown = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconClose = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconMinus = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}><path d="M5 12h14" /></svg>
)
export const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconArrowUp = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
)
export const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
export const IconShare = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18" r="2.5" />
    <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
  </svg>
)
export const IconGrid = ({ cols = 3, ...p }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    {Array.from({ length: cols }).map((_, i) => (
      <rect key={i} x={2 + i * (20 / cols)} y="4" width={20 / cols - 2} height="16" rx="1" />
    ))}
  </svg>
)

/* Order pages. Same 1.6px stroke as the rest so they sit next to IconBag
   without looking borrowed. */
export const IconQr = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14v1M14 20h3M20 19v2" />
  </svg>
)
export const IconBank = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <path d="M3 9.5 12 4l9 5.5M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18" />
  </svg>
)
export const IconCopy = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
)
export const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
)
export const IconClock = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" />
  </svg>
)
export const IconTruck = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M3 16V6.5h11V16M14 9.5h3.6L21 13v3h-3" />
    <circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />
  </svg>
)

/* Social marks. Filled rather than stroked, because a brand glyph at 18px
   reads as a smudge in 1.6px outline. */
export const IconFacebook = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6A21 21 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.1v2.3H7.6V13h2.7v8z" />
  </svg>
)
export const IconInstagram = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.9" cy="7.1" r="1.05" fill="currentColor" stroke="none" />
  </svg>
)
export const IconMail = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.8 7 8.2 6 8.2-6" />
  </svg>
)
export const IconPhone = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M6.2 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2Z" />
  </svg>
)
export const IconPin = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M12 21s7-5.2 7-10.4A7 7 0 0 0 5 10.6C5 15.8 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.6" />
  </svg>
)
