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
