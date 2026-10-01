'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  RefObject,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { Copy as CopyIcon, Dots, ImageIcon, Search as SearchIcon } from './icons'
import ProductImage from '@/components/ProductImage'
import { SelectAllCell, SelectCell } from './selection'
import type { SelectableRow, Selection } from './selection'

export interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  padded?: boolean
  className?: string
  stickyHeader?: boolean
}

export function Card({ title, subtitle, actions, children, padded = true, className = '', stickyHeader = false }: CardProps) {
  const hasHeader = Boolean(title || actions)
  return (
    <section className={`rounded-xl border border-a-line bg-a-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] ${className}`}>
      {hasHeader && (
        <header
          className={`flex items-start justify-between gap-3 px-6 py-4 ${
            stickyHeader ? 'sticky top-[52px] z-10 rounded-t-xl border-b border-a-line bg-a-surface/95 backdrop-blur' : ''
          }`}
        >
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-a-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-a-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children != null && (
        <div className={hasHeader && !stickyHeader ? 'border-t border-a-line' : ''}>
          <div className={padded ? 'px-6 py-4' : ''}>{children}</div>
        </div>
      )}
    </section>
  )
}

export interface RowProps {
  label: ReactNode
  children?: ReactNode
  copy?: string | null
}

export function Row({ label, children, copy }: RowProps) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-start justify-between gap-4 border-b border-a-line px-6 py-3 last:border-0">
      <span className="shrink-0 text-[13px] text-a-muted">{label}</span>
      <span className="flex min-w-0 items-start gap-2 text-right text-[13px] text-a-ink">
        <span className="min-w-0 break-words">{children}</span>
        {copy && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(copy)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="mt-0.5 shrink-0 text-a-muted transition-colors hover:text-a-ink"
            aria-label="Хуулах"
          >
            {copied ? <span className="text-[11px] text-success-ink">хуулсан</span> : <CopyIcon />}
          </button>
        )}
      </span>
    </div>
  )
}

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey' | 'purple'

const DOT: Record<Tone, string> = {
  green: 'bg-success', amber: 'bg-warn', red: 'bg-danger',
  blue: 'bg-info', grey: 'bg-a-muted', purple: 'bg-note',
}

export interface StatusProps {
  tone?: Tone
  children?: ReactNode
}

export function Status({ tone = 'grey', children }: StatusProps) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-a-line bg-a-surface px-2 py-[3px] text-[12px] font-medium text-a-ink">
      <span className={`h-[7px] w-[7px] rounded-[2px] ${DOT[tone]}`} />
      {children}
    </span>
  )
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-a-ink text-a-on-ink hover:opacity-90 border border-transparent',
  secondary: 'border border-a-line bg-a-surface text-a-ink hover:bg-a-hover shadow-[0_1px_2px_rgba(0,0,0,.04)]',
  danger: 'border border-danger-line bg-a-surface text-danger-ink hover:bg-danger-soft',
  ghost: 'border border-transparent text-a-muted hover:bg-a-hover hover:text-a-ink',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-[12px]',
  md: 'px-3 py-[7px] text-[13px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    />
  )
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export const IconButton = ({ className = '', ...props }: IconButtonProps) => (
  <button
    {...props}
    className={`grid h-7 w-7 place-items-center rounded-md text-a-muted transition-colors hover:bg-a-hover hover:text-a-ink ${className}`}
  />
)

export const Dropdown = (props: IconButtonProps) => <IconButton {...props}><Dots /></IconButton>

export interface BulkAction {
  key: string
  label: ReactNode
  tone?: 'danger'
  separatorBefore?: boolean
  run?: () => unknown
  render?: (close: () => void) => ReactNode
}

export interface BulkBarProps {
  count: number
  actions: readonly BulkAction[]
  onClear: () => void
}

export function BulkBar({ count, actions, onClear }: BulkBarProps) {
  const [open, setOpen] = useState(false)
  const [popover, setPopover] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const close = () => { setOpen(false); setPopover(null) }
  const active = actions.find((a) => a.key === popover)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-a-line bg-a-hover px-4 py-2.5">
      <span className="text-[13px] font-medium text-a-ink">{count} сонгосон</span>

      <div className="relative ml-auto" ref={ref}>
        <Button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Үйлдэл <span className="text-a-muted">▾</span>
        </Button>

        <Popover
          open={open}
          onClose={close}
          anchorRef={ref}
          className={active?.render ? 'right-0 top-full w-[260px] p-3' : 'right-0 top-full w-[220px] overflow-hidden py-1'}
        >
          {active?.render ? active.render(close) : actions.map((a) => (
            <div key={a.key}>
              {a.separatorBefore && <div className="my-1 border-t border-a-line" />}
              <button
                onClick={() => {
                  if (a.render) { setPopover(a.key); return }
                  close()
                  a.run?.()
                }}
                className={`block w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-a-hover ${
                  a.tone === 'danger' ? 'text-danger-ink' : 'text-a-ink'
                }`}
              >
                {a.label}
              </button>
            </div>
          ))}
        </Popover>
      </div>

      <Button variant="ghost" onClick={onClear}>Цуцлах</Button>
    </div>
  )
}

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

export interface DataTableProps<T extends SelectableRow> {
  columns: readonly Column<T>[]
  rows: readonly T[]
  empty?: ReactNode
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  selection?: Selection<T>
  bulkActions?: readonly BulkAction[]
}

export function DataTable<T extends SelectableRow>({
  columns, rows, empty, onRowClick, toolbar, selection, bulkActions,
}: DataTableProps<T>) {
  const span = columns.length + (selection ? 1 : 0)

  return (
    <div className="rounded-xl border border-a-line bg-a-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      {selection && selection.count > 0
        ? <BulkBar count={selection.count} actions={bulkActions ?? []} onClear={selection.clear} />
        : toolbar}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-y border-a-line">
              {selection && (
                <th className="w-10 px-4 py-2.5">
                  <SelectAllCell
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected && !selection.allSelected}
                    onChange={selection.toggleAllRows}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-2.5 text-[13px] font-normal text-a-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={span} className="px-4 py-16 text-center text-[13px] text-a-muted">
                  {empty ?? 'Мэдээлэл алга'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-a-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-a-hover' : ''} ${
                    selection?.isSelected(row) ? 'bg-a-hover' : ''
                  }`}
                >
                  {selection && (
                    <td className="w-10 px-4 py-3">
                      <SelectCell
                        checked={selection.isSelected(row)}
                        onChange={() => selection.toggleRow(row)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-4 py-3 text-[13px] text-a-ink ${c.align === 'right' ? 'text-right' : ''}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export interface TableToolbarProps {
  search: string
  onSearch: (value: string) => void
  placeholder?: string
  children?: ReactNode
}

export function TableToolbar({ search, onSearch, placeholder = 'Хайх', children }: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {children}
      <label className="relative ml-auto">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-a-muted">
          <SearchIcon />
        </span>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-[220px] rounded-md border border-a-line bg-a-surface py-[6px] pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-a-focus focus:ring-2 focus:ring-a-focus/15"
        />
      </label>
    </div>
  )
}

export interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  required?: boolean
  children?: ReactNode
}

export function Field({ label, hint, required, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-a-ink">
        {label}{required && <span className="text-a-muted"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-a-muted">{hint}</span>}
    </label>
  )
}

export type InputTone = 'mint' | 'blush'

const INPUT_TONE: Record<InputTone, string> = {
  mint: 'bg-mint text-mint-ink',
  blush: 'bg-blush text-blush-ink',
}

const INPUT_DEFAULT_TONE = 'bg-a-surface text-a-ink'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  tone?: InputTone
}

export const Input = ({ className = '', tone, ...props }: InputProps) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-a-line ${tone ? INPUT_TONE[tone] : INPUT_DEFAULT_TONE} px-3 py-2 text-[14px] outline-none transition-colors placeholder:text-a-muted focus:border-a-focus focus:ring-2 focus:ring-a-focus/15 ${className}`}
  />
)

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = ({ className = '', ...props }: SelectProps) => (
  <select
    {...props}
    className={`w-full rounded-md border border-a-line bg-a-surface px-3 py-[7px] text-[13px] text-a-ink outline-none focus:border-a-focus focus:ring-2 focus:ring-a-focus/15 ${className}`}
  />
)

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = ({ className = '', ...props }: TextareaProps) => (
  <textarea
    {...props}
    className={`w-full rounded-md border border-a-line bg-a-surface px-3 py-2 text-[13px] text-a-ink outline-none transition-colors focus:border-a-focus focus:ring-2 focus:ring-a-focus/15 ${className}`}
  />
)

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-.01em] text-a-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-a-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export interface EmptyStateProps {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-a-line bg-a-surface px-6 py-16 text-center">
      <p className="text-[14px] font-medium text-a-ink">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-a-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export interface ActivityItem {
  label: ReactNode
  at?: ReactNode
  detail?: ReactNode
}

export interface ActivityProps {
  items: readonly ActivityItem[]
}

export function Activity({ items }: ActivityProps) {
  return (
    <ol className="space-y-4 px-6 py-4">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-a-muted" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-a-ink">{it.label}</p>
              <p className="shrink-0 text-[12px] text-a-muted">{it.at}</p>
            </div>
            {it.detail && <p className="text-[12px] text-a-muted">{it.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children?: ReactNode
  className?: string
}

export function Popover({ open, onClose, anchorRef, children, className = '' }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const latestOnClose = useRef(onClose)
  useEffect(() => { latestOnClose.current = onClose })

  useEffect(() => {
    if (!open) return undefined
    const inside = (target: Node) =>
      Boolean(ref.current?.contains(target) || anchorRef.current?.contains(target))
    const onDoc = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !inside(e.target)) latestOnClose.current()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') latestOnClose.current() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, anchorRef])

  if (!open) return null
  return (
    <div
      ref={ref}
      className={`absolute z-10 mt-1 rounded-xl border border-a-line bg-a-surface shadow-[0_8px_24px_rgba(0,0,0,.10)] ${className}`}
    >
      {children}
    </div>
  )
}

export interface ThumbProps {
  filePath?: string | null
  alt?: string
  count?: number
  onClick?: () => void
  title?: string
}

export function Thumb({ filePath, alt = '', count = 1, onClick, title }: ThumbProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-a-line bg-a-hover transition-all hover:border-a-focus hover:ring-4 hover:ring-a-focus/10"
    >
      {filePath ? (
        <ProductImage filePath={filePath} alt={alt} seed={filePath} width={64} height={64} />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-2xl border-2 border-dashed border-a-line text-a-muted">
          <ImageIcon />
        </span>
      )}
      {count > 1 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-a-ink text-[11px] font-semibold text-a-on-ink shadow-sm">
          {count}
        </span>
      )}
    </button>
  )
}
