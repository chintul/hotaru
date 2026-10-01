'use client'

import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const PREORDER_LABEL = 'Урьдчилсан захиалга авах'
export const PREORDER_HINT = 'Үлдэгдэл дууссан ч худалдана. Энэ сонголтын үлдэгдэл захиалгаар хасагдахгүй.'

export interface PreorderToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}

export default function PreorderToggle({ checked, onCheckedChange, disabled, compact = false, className }: PreorderToggleProps) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="mt-0.5 bg-card dark:bg-card"
      />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="text-[13px] font-medium">
          {compact ? 'Урьдчилсан захиалга' : PREORDER_LABEL}
        </Label>
        {!compact && <p className="text-[12px] leading-snug text-a-muted">{PREORDER_HINT}</p>}
      </div>
    </div>
  )
}

export function PreorderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-info-line bg-info-soft px-2 py-0.5 text-[12px] font-medium text-info-ink',
        className,
      )}
    >
      урьдчилсан захиалга
    </span>
  )
}
