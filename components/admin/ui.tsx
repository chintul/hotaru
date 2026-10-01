'use client'

import { useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Copy as CopyIcon, Dots, ImageIcon, Search as SearchIcon } from './icons'
import ProductImage from '@/components/ProductImage'
import { SelectAllCell, SelectCell } from './selection'
import type { SelectableRow, Selection } from './selection'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button as UIButton } from '@/components/ui/button'
import {
  Card as UICard, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input as UIInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea as UITextarea } from '@/components/ui/textarea'

export interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  padded?: boolean
  className?: string
  stickyHeader?: boolean
}

export function Card({ title, subtitle, actions, children, padded = true, className, stickyHeader = false }: CardProps) {
  const hasHeader = Boolean(title || actions)
  return (
    <UICard className={cn('gap-0 py-0 shadow-xs', className)}>
      {hasHeader && (
        <CardHeader
          className={cn(
            'flex items-start justify-between gap-3 px-6 py-4 [.border-b]:pb-4',
            stickyHeader && 'sticky top-[52px] z-10 rounded-t-xl border-b bg-card/95 backdrop-blur',
          )}
        >
          <div className="min-w-0">
            {title && <CardTitle className="text-[15px] leading-normal"><h2>{title}</h2></CardTitle>}
            {subtitle && <CardDescription className="mt-0.5 text-[13px]">{subtitle}</CardDescription>}
          </div>
          {actions && <CardAction className="flex shrink-0 items-center gap-2">{actions}</CardAction>}
        </CardHeader>
      )}
      {children != null && (
        <CardContent className={cn('px-0', hasHeader && !stickyHeader && 'border-t')}>
          <div className={padded ? 'px-6 py-4' : ''}>{children}</div>
        </CardContent>
      )}
    </UICard>
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
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-3 last:border-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-start gap-2 text-right text-[13px] text-foreground">
        <span className="min-w-0 break-words">{children}</span>
        {copy && (
          <UIButton
            type="button"
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(copy)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="mt-0.5 h-auto shrink-0 p-0 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
            aria-label="Хуулах"
          >
            {copied ? <span className="text-[11px] text-success-ink">хуулсан</span> : <CopyIcon />}
          </UIButton>
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
    <Badge variant="outline" className="gap-1.5 rounded-md bg-card px-2 py-[3px] text-[12px] font-medium text-foreground">
      <span className={cn('h-[7px] w-[7px] rounded-[2px]', DOT[tone])} />
      {children}
    </Badge>
  )
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'
export type ButtonSize = 'sm' | 'md'

type UIButtonVariant = NonNullable<ComponentProps<typeof UIButton>['variant']>

const BUTTON_VARIANT: Record<ButtonVariant, UIButtonVariant> = {
  primary: 'default',
  secondary: 'outline',
  danger: 'destructive',
  ghost: 'ghost',
  link: 'link',
}

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: '',
  secondary: 'bg-card dark:bg-card dark:hover:bg-accent',
  danger: 'text-destructive-foreground dark:bg-destructive',
  ghost: 'text-muted-foreground hover:text-foreground',
  link: 'h-auto px-0 has-[>svg]:px-0 text-current underline underline-offset-2',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] has-[>svg]:px-2',
  md: 'h-8 px-3 text-[13px] has-[>svg]:px-2.5',
}

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <UIButton
      {...props}
      variant={BUTTON_VARIANT[variant]}
      size="sm"
      className={cn('gap-1.5', BUTTON_SIZE[size], BUTTON_VARIANT_CLASS[variant], className)}
    />
  )
}

export interface IconButtonProps extends ComponentProps<'button'> {
  asChild?: boolean
}

export const IconButton = ({ className, ...props }: IconButtonProps) => (
  <UIButton
    {...props}
    variant="ghost"
    size="icon-sm"
    className={cn('size-7 text-muted-foreground hover:text-foreground', className)}
  />
)

export const Dropdown = (props: IconButtonProps) => <IconButton {...props}><Dots /></IconButton>

export const MENU_CONTENT_CLASS = 'min-w-[188px] text-[13px]'
export const MENU_ITEM_CLASS = 'px-3 py-1.5 text-[13px]'

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
  const keepFocus = useRef(false)

  const close = () => { setOpen(false); setPopover(null) }
  const active = actions.find((a) => a.key === popover)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
      <span className="text-[13px] font-medium text-foreground">{count} сонгосон</span>

      <div className="ml-auto">
        <Popover open={Boolean(active?.render)} onOpenChange={(next) => { if (!next) setPopover(null) }}>
          <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
            <PopoverAnchor asChild>
              <DropdownMenuTrigger asChild>
                <Button>
                  Үйлдэл <span className="text-muted-foreground">▾</span>
                </Button>
              </DropdownMenuTrigger>
            </PopoverAnchor>
            <DropdownMenuContent
              align="end"
              className="w-[220px]"
              onCloseAutoFocus={(e) => {
                if (keepFocus.current) { e.preventDefault(); keepFocus.current = false }
              }}
            >
              {actions.map((a) => (
                <div key={a.key}>
                  {a.separatorBefore && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    variant={a.tone === 'danger' ? 'destructive' : 'default'}
                    className={MENU_ITEM_CLASS}
                    onSelect={() => {
                      if (a.render) { keepFocus.current = true; setPopover(a.key); return }
                      a.run?.()
                    }}
                  >
                    {a.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <PopoverContent align="end" className="w-[260px] p-3">
            {active?.render?.(close)}
          </PopoverContent>
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
    <div className="rounded-xl border border-border bg-card shadow-xs">
      {selection && selection.count > 0
        ? <BulkBar count={selection.count} actions={bulkActions ?? []} onClear={selection.clear} />
        : toolbar}
      <Table className="min-w-[700px] border-collapse">
        <TableHeader>
          <TableRow className="border-y hover:bg-transparent">
            {selection && (
              <TableHead className="h-auto w-10 px-4 py-2.5">
                <SelectAllCell
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected && !selection.allSelected}
                  onChange={selection.toggleAllRows}
                />
              </TableHead>
            )}
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  'h-auto px-4 py-2.5 text-[13px] font-normal text-muted-foreground',
                  c.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={span} className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                {empty ?? 'Мэдээлэл алга'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const selected = selection?.isSelected(row) ?? false
              return (
                <TableRow
                  key={row.id}
                  data-state={selected ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted' : 'hover:bg-transparent'}
                >
                  {selection && (
                    <TableCell className="w-10 px-4 py-3">
                      <SelectCell checked={selected} onChange={() => selection.toggleRow(row)} />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn('px-4 py-3 text-[13px] text-foreground', c.align === 'right' && 'text-right')}
                    >
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
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
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <SearchIcon />
        </span>
        <UIInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="h-8 w-[220px] bg-card pl-8 pr-3 text-[13px] md:text-[13px] dark:bg-card"
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
    <Label className="block select-auto font-normal leading-normal">
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">
        {label}{required && <span className="text-muted-foreground"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted-foreground">{hint}</span>}
    </Label>
  )
}

export type InputTone = 'mint' | 'blush'

const INPUT_TONE: Record<InputTone, string> = {
  mint: 'bg-mint text-mint-ink dark:bg-mint',
  blush: 'bg-blush text-blush-ink dark:bg-blush',
}

const INPUT_DEFAULT_TONE = 'bg-card text-foreground dark:bg-card'

export interface InputProps extends ComponentProps<'input'> {
  tone?: InputTone
}

export const Input = ({ className, tone, ...props }: InputProps) => (
  <UIInput
    {...props}
    className={cn(
      'h-9 rounded-lg px-3 text-[14px] md:text-[14px]',
      tone ? INPUT_TONE[tone] : INPUT_DEFAULT_TONE,
      className,
    )}
  />
)

export type SelectProps = ComponentProps<'select'>

export const Select = ({ className, ...props }: SelectProps) => (
  <select
    data-slot="select"
    {...props}
    className={cn(
      'h-8 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[13px] text-foreground shadow-xs outline-none transition-[color,box-shadow]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
  />
)

export type TextareaProps = ComponentProps<'textarea'>

export const Textarea = ({ className, ...props }: TextareaProps) => (
  <UITextarea
    {...props}
    className={cn('min-h-0 bg-card text-[13px] field-sizing-fixed md:text-[13px] dark:bg-card', className)}
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
        <h1 className="text-[20px] font-semibold tracking-[-.01em] text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
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
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted-foreground">{body}</p>}
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
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-foreground">{it.label}</p>
              <p className="shrink-0 text-[12px] text-muted-foreground">{it.at}</p>
            </div>
            {it.detail && <p className="text-[12px] text-muted-foreground">{it.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export interface ThumbProps extends Omit<ComponentProps<'button'>, 'children'> {
  filePath?: string | null
  alt?: string
  count?: number
}

export function Thumb({ filePath, alt = '', count = 1, className, ...props }: ThumbProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'relative block h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted outline-none transition-all hover:border-ring hover:ring-4 hover:ring-ring/10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      {filePath ? (
        <ProductImage filePath={filePath} alt={alt} seed={filePath} width={64} height={64} />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
          <ImageIcon />
        </span>
      )}
      {count > 1 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shadow-sm">
          {count}
        </span>
      )}
    </button>
  )
}
