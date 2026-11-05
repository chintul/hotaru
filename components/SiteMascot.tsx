'use client'

import { Mascot } from 'page-mascot'

export default function SiteMascot({
  character = 'khishig',
  label = 'hotaru',
  size = 120,
  className,
}: {
  character?: string
  label?: string
  size?: number
  className?: string
}) {
  return (
    <Mascot
      directions={`/mascots/${character}-directions.webp`}
      reactions={`/mascots/${character}-reactions.webp`}
      label={label}
      size={size}
      className={className}
    />
  )
}
