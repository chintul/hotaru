import { cn } from '@/lib/utils'
import { T } from '@/lib/i18n'

interface PreorderTagProps {
  eta?: string | null
  sticker?: boolean
  className?: string
}

export default function PreorderTag({ eta, sticker = false, className }: PreorderTagProps) {
  return (
    <span className={cn('preorder-tag', sticker && 'preorder-tag-card', className)}>
      <span aria-hidden className="preorder-dot" />
      <span>
        <T mn="Урьдчилсан захиалга" en="Pre-order" />
        {eta ? <span className="preorder-eta">: {eta}</span> : null}
      </span>
    </span>
  )
}
