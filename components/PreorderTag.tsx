interface PreorderTagProps {
  eta?: string | null
  className?: string
}

export default function PreorderTag({ eta, className = '' }: PreorderTagProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full bg-sky px-2.5 py-0.5 text-[11px] font-semibold leading-snug text-sky-ink ${className}`}
    >
      <span className="truncate">Урьдчилсан захиалга{eta ? ` · ${eta}` : ''}</span>
    </span>
  )
}
