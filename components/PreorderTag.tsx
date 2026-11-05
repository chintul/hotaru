import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreorderTagProps {
  eta?: string | null
  sticker?: boolean
  className?: string
}

export default function PreorderTag({ eta, sticker = false, className }: PreorderTagProps) {
  return (
    <span className={cn('preorder-tag', sticker && 'preorder-tag-card', className)}>
      <Clock3 size={13} strokeWidth={1.7} aria-hidden="true" className="shrink-0" />
      <span>Урьдчилсан захиалга{eta ? <span className="preorder-eta"> · {eta}</span> : null}</span>
    </span>
  )
}
