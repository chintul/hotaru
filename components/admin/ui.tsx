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
            'flex items-start justify-between gap-3 px-4 py-4 max-sm:flex-wrap sm:px-6 [.border-b]:pb-4',
            stickyHeader && 'sticky top-12 z-10 rounded-t-xl border-b bg-card/95 backdrop-blur lg:top-[52px]',
          )}
        >
          <div className="min-w-0">
            {title && <CardTitle className="text-[15px] leading-normal"><h2>{title}</h2></CardTitle>}
            {subtitle && <CardDescription className="mt-0.5 text-[13px]">{subtitle}</CardDescription>}
          </div>
          {actions && <CardAction className="flex shrink-0 flex-wrap items-center gap-2">{actions}</CardAction>}
        </CardHeader>
      )}
      {children != null && (
        <CardContent className={cn('px-0', hasHeader && !stickyHeader && 'border-t')}>
          <div className={padded ? 'px-4 py-4 sm:px-6' : ''}>{children}</div>
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
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 last:border-0 sm:px-6">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-start gap-2 text-right text-[13px] text-foreground">
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{children}</span>
        {copy && (
          <UIButton
            type="button"
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(copy)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="relative mt-0.5 h-auto shrink-0 p-0 font-normal text-muted-foreground after:absolute after:-inset-3 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
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
  link: 'h-auto px-0 has-[>svg]:px-0 text-current underline underline-offset-2 max-md:min-h-0',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] has-[>svg]:px-2 max-md:min-h-10',
  md: 'h-8 px-3 text-[13px] has-[>svg]:px-2.5 max-md:min-h-10',
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
    className={cn('size-7 text-muted-foreground hover:text-foreground max-md:min-h-10 max-md:min-w-10', className)}
  />
)

export const Dropdown = (props: IconButtonProps) => <IconButton {...props}><Dots /></IconButton>

export const MENU_CONTENT_CLASS = 'min-w-[188px] max-w-[calc(100vw-1.5rem)] text-[13px]'
export const MENU_ITEM_CLASS = 'px-3 py-1.5 text-[13px] max-md:min-h-11 max-md:text-[14px]'

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
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2.5',
        'max-md:fixed max-md:inset-x-3 max-md:bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-md:z-30 max-md:flex-nowrap max-md:rounded-xl max-md:border max-md:px-3 max-md:shadow-lg',
      )}
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{count} сонгосон</span>

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
              collisionPadding={12}
              className="w-[220px] max-w-[calc(100vw-1.5rem)]"
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
          <PopoverContent align="end" collisionPadding={12} className="w-[260px] max-w-[calc(100vw-1.5rem)] p-3">
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

const hasHeader = (header: ReactNode) => header != null && header !== false && header !== ''

interface StackedRowProps<T extends SelectableRow> {
  row: T
  columns: readonly Column<T>[]
  selection?: Selection<T>
  onRowClick?: (row: T) => void
}

function StackedRow<T extends SelectableRow>({ row, columns, selection, onRowClick }: StackedRowProps<T>) {
  const leadsWithMedia = columns.length > 1 && !hasHeader(columns[0]?.header)
  const media = leadsWithMedia ? columns[0] : null
  const [first, ...rest] = leadsWithMedia ? columns.slice(1) : columns
  const fields = rest.filter((c) => hasHeader(c.header))
  const actions = rest.filter((c) => !hasHeader(c.header))
  const selected = selection?.isSelected(row) ?? false

  return (
    <li
      data-state={selected ? 'selected' : undefined}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={cn(
        'flex gap-1 border-b border-border px-3 py-3 last:border-0 data-[state=selected]:bg-muted',
        onRowClick && 'cursor-pointer active:bg-muted',
      )}
    >
      {selection && (
        <div
          className="-my-1 flex w-10 shrink-0 cursor-pointer justify-center pt-1"
          onClick={(e) => { e.stopPropagation(); selection.toggleRow(row) }}
        >
          <SelectCell checked={selected} onChange={() => selection.toggleRow(row)} />
        </div>
      )}
      {media && <div className={cn('shrink-0', !selection && 'pl-1', 'pr-2')}>{media.render(row)}</div>}
      <div className={cn('min-w-0 flex-1', !selection && !media && 'px-1')}>
        {first && (
          <div className="min-w-0 text-[14px] font-medium text-foreground [overflow-wrap:anywhere]">{first.render(row)}</div>
        )}
        {fields.length > 0 && (
          <dl className="mt-1.5 space-y-1">
            {fields.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3 text-[13px]">
                <dt className="shrink-0 text-muted-foreground">{c.header}</dt>
                <dd className="min-w-0 text-right text-foreground [overflow-wrap:anywhere]">{c.render(row)}</dd>
              </div>
            ))}
          </dl>
        )}
        {actions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
            {actions.map((c) => <div key={c.key}>{c.render(row)}</div>)}
          </div>
        )}
      </div>
    </li>
  )
}

export function DataTable<T extends SelectableRow>({
  columns, rows, empty, onRowClick, toolbar, selection, bulkActions,
}: DataTableProps<T>) {
  const span = columns.length + (selection ? 1 : 0)
  const bulk = selection && selection.count > 0
  const emptyText = empty ?? 'Мэдээлэл алга'

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      {bulk
        ? <BulkBar count={selection.count} actions={bulkActions ?? []} onClear={selection.clear} />
        : toolbar}

      <div className={cn('md:hidden', bulk && 'pb-20')}>
        {selection && rows.length > 0 && (
          <label
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-1 border-b border-border px-3 text-[13px] text-muted-foreground',
              !bulk && toolbar != null && 'border-t',
            )}
          >
            <span className="flex w-10 shrink-0 justify-center">
              <SelectAllCell
                checked={selection.allSelected}
                indeterminate={selection.someSelected && !selection.allSelected}
                onChange={selection.toggleAllRows}
              />
            </span>
            Бүгдийг сонгох
          </label>
        )}
        {rows.length === 0 ? (
          <p className={cn('px-4 py-12 text-center text-[13px] text-muted-foreground', toolbar != null && 'border-t border-border')}>{emptyText}</p>
        ) : (
          <ul className={cn(!selection && toolbar != null && 'border-t border-border')}>
            {rows.map((row) => (
              <StackedRow key={row.id} row={row} columns={columns} selection={selection} onRowClick={onRowClick} />
            ))}
          </ul>
        )}
      </div>

      <div className="hidden md:block">
        <Table className="border-collapse md:min-w-[700px]">
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
                  {emptyText}
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
    <div className="flex flex-col gap-2 px-3 py-3 md:flex-row md:flex-wrap md:items-center md:px-4">
      {children != null && (
        <div className="-mx-3 order-2 flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 [scrollbar-width:none] *:shrink-0 *:snap-start md:contents [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      )}
      <label className="relative order-1 block w-full md:order-none md:ml-auto md:w-auto">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <SearchIcon />
        </span>
        <UIInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full bg-card pl-8 pr-3 text-[16px] md:h-8 md:w-[220px] md:text-[13px] dark:bg-card"
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
      'h-10 rounded-lg px-3 text-[16px] md:h-9 md:text-[14px]',
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
      'h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[16px] text-foreground shadow-xs outline-none transition-[color,box-shadow] md:h-8 md:text-[13px]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
  />
)

export type TextareaProps = ComponentProps<'textarea'>

export const Textarea = ({ className, ...props }: TextareaProps) => (
  <UITextarea
    {...props}
    className={cn('min-h-0 bg-card text-[16px] field-sizing-fixed md:text-[13px] dark:bg-card', className)}
  />
)

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
      <div className="min-w-0 max-sm:w-full">
        <h1 className="text-[20px] font-semibold tracking-[-.01em] text-foreground [overflow-wrap:anywhere]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 max-sm:w-full max-sm:flex-wrap max-sm:*:flex-1">{actions}</div>}
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
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center sm:px-6 sm:py-16">
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
    <ol className="space-y-4 px-4 py-4 sm:px-6">
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
