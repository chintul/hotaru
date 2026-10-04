import { IconSparkle } from './Icons'
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

function Apple({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Урьдчилсан захиалга"
      className={cn('relative grid h-[72px] w-[68px] -rotate-[6deg] place-items-center text-blush-ink', className)}
    >
      <svg
        viewBox="0 0 68 72"
        aria-hidden
        className="absolute inset-0 h-full w-full drop-shadow-[0_6px_10px_rgb(23_35_46/0.18)]"
      >
        <path d={APPLE_STEM} fill="none" className="stroke-paper" strokeWidth="5" strokeLinecap="round" />
        <path d={APPLE_LEAF} className="fill-paper stroke-paper" strokeWidth="5" strokeLinejoin="round" />
        <path d={APPLE_BODY} className="fill-blush stroke-paper" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={APPLE_STEM} fill="none" className="stroke-cream-ink" strokeWidth="2" strokeLinecap="round" />
        <path d={APPLE_LEAF} className="fill-mint stroke-mint-ink" strokeWidth="1" strokeLinejoin="round" />
        <path d="M17 33 C17.5 28 20.5 25 24 24" fill="none" className="stroke-paper/70" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span aria-hidden className="relative mt-3.5 flex flex-col items-center text-center leading-[1.05]">
        <IconSparkle width="10" height="10" />
        <span className="mt-0.5 text-[8px] font-bold">Урьдчилсан</span>
        <span className="text-[8px] font-bold">захиалга</span>
      </span>
    </span>
  )
}

export default function PreorderTag({ eta, sticker = false, className }: PreorderTagProps) {
  if (sticker) return <Apple className={className} />
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full bg-sky py-[3px] pl-1.5 pr-2.5 text-[11px] font-semibold leading-snug text-sky-ink ring-1 ring-inset ring-sky-ink/15',
        className,
      )}
    >
      <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-paper/80">
        <IconSparkle width="10" height="10" />
      </span>
      <span className="truncate">Урьдчилсан захиалга{eta ? ` · ${eta}` : ''}</span>
    </span>
  )
}
