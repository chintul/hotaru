import { cn } from '@/lib/utils'

interface PreorderTagProps {
  eta?: string | null
  sticker?: boolean
  className?: string
}

const APPLE_BODY =
  'M34 23 C28 16.5 12.5 17.5 9.5 32.5 C6.5 47.5 18 66.5 27 66.5 C30 66.5 31.5 65 34 65 C36.5 65 38 66.5 41 66.5 C50 66.5 61.5 47.5 58.5 32.5 C55.5 17.5 40 16.5 34 23 Z'
const APPLE_STEM = 'M34 23 C33.8 17.5 35 13 38.5 9.5'
const APPLE_LEAF = 'M37.5 15 C41 8 48.5 6.5 53.5 9 C50 15.5 42.5 17 37.5 15 Z'

function MiniApple() {
  return (
    <svg viewBox="6 5 56 64" aria-hidden className="h-4 w-4 shrink-0">
      <path d={APPLE_BODY} className="fill-blush-ink" />
      <path d={APPLE_STEM} fill="none" className="stroke-cream-ink" strokeWidth="4" strokeLinecap="round" />
      <path d={APPLE_LEAF} className="fill-mint-ink" />
      <path d="M17 33 C17.5 28 20.5 25 24 24" fill="none" className="stroke-paper/60" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

export default function PreorderTag({ eta, sticker = false, className }: PreorderTagProps) {
  if (sticker)
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-blush py-1 pl-1 pr-2 text-[11px] font-semibold leading-none text-blush-ink shadow-(--t-lift) ring-1 ring-inset ring-blush-ink/15',
          className,
        )}
      >
        <MiniApple />
        Урьдчилсан захиалга
      </span>
    )
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full bg-sky py-[3px] pl-1.5 pr-2.5 text-[11px] font-semibold leading-snug text-sky-ink ring-1 ring-inset ring-sky-ink/15',
        className,
      )}
    >
      <MiniApple />
      <span className="truncate">Урьдчилсан захиалга{eta ? ` · ${eta}` : ''}</span>
    </span>
  )
}
