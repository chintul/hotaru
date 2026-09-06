'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy as CopyIcon, Dots, Search as SearchIcon } from './icons'
import { SelectAllCell, SelectCell } from './selection'

/**
 * Admin UI kit, built to match Medusa's admin.
 *
 * The shape that matters: everything lives in a white rounded-xl card with a
 * hairline border; card headers carry the title and the actions; rows inside a
 * card are separated by hairlines rather than boxed individually; status is a
 * coloured dot plus plain text, never a loud pill.
 */

export function Card({ title, subtitle, actions, children, padded = true, className = '' }) {
  return (
    <section className={`rounded-xl border border-a-line bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-a-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-a-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children != null && (
        <div className={title || actions ? 'border-t border-a-line' : ''}>
          <div className={padded ? 'px-6 py-4' : ''}>{children}</div>
        </div>
      )}
    </section>
  )
}

/** Label/value row, the workhorse of Medusa's right-hand rail. */
export function Row({ label, children, copy }) {
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
            {copied ? <span className="text-[11px] text-emerald-600">хуулсан</span> : <CopyIcon />}
          </button>
        )}
      </span>
    </div>
  )
}

const DOT = {
  green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500',
  blue: 'bg-blue-500', grey: 'bg-a-muted', purple: 'bg-violet-500',
}

/** Coloured square dot + text. Medusa never uses a filled pill for status. */
export function Status({ tone = 'grey', children }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-a-line bg-white px-2 py-[3px] text-[12px] font-medium text-a-ink">
      <span className={`h-[7px] w-[7px] rounded-[2px] ${DOT[tone] ?? DOT.grey}`} />
      {children}
    </span>
  )
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }) {
  const styles = {
    primary: 'bg-a-ink text-white hover:opacity-90 border border-transparent',
    secondary: 'border border-a-line bg-white text-a-ink hover:bg-a-hover shadow-[0_1px_2px_rgba(0,0,0,.04)]',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
    ghost: 'border border-transparent text-a-muted hover:bg-a-hover hover:text-a-ink',
  }[variant]
  const sizes = { sm: 'px-2.5 py-1 text-[12px]', md: 'px-3 py-[7px] text-[13px]' }[size]
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${sizes} ${className}`}
    />
  )
}

export const IconButton = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`grid h-7 w-7 place-items-center rounded-md text-a-muted transition-colors hover:bg-a-hover hover:text-a-ink ${className}`}
  />
)

export const Dropdown = (props) => <IconButton {...props}><Dots /></IconButton>

/* --------------------------------- table --------------------------------- */

/**
 * The strip that replaces a toolbar while rows are selected.
 *
 * Lives here rather than in ./selection because it needs Button, and ./ui must
 * not depend on ./selection in both directions. An action either runs (`run`)
 * or opens a popover (`render`) — assigning a category needs a value, so it
 * cannot be a plain menu item.
 */
export function BulkBar({ count, actions, onClear }) {
  const [open, setOpen] = useState(false)
  const [popover, setPopover] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPopover(null) }
    }
    const onEsc = (e) => { if (e.key === 'Escape') { setOpen(false); setPopover(null) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const close = () => { setOpen(false); setPopover(null) }
  const active = actions.find((a) => a.key === popover)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-a-line bg-a-hover px-4 py-2.5">
      <span className="text-[13px] font-medium text-a-ink">{count} сонгосон</span>

      <div className="relative ml-auto" ref={ref}>
        <Button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Үйлдэл <span className="text-a-muted">▾</span>
        </Button>

        {open && !popover && (
          <div className="absolute right-0 top-full z-20 mt-1 w-[220px] overflow-hidden rounded-lg border border-a-line bg-white py-1 shadow-lg">
            {actions.map((a) => (
              <div key={a.key}>
                {a.separatorBefore && <div className="my-1 border-t border-a-line" />}
                <button
                  onClick={() => {
                    if (a.render) { setPopover(a.key); return }
                    close()
                    a.run()
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-a-hover ${
                    a.tone === 'danger' ? 'text-red-600' : 'text-a-ink'
                  }`}
                >
                  {a.label}
                </button>
              </div>
            ))}
          </div>
        )}

        {popover && active && (
          <div className="absolute right-0 top-full z-20 mt-1 w-[260px] rounded-lg border border-a-line bg-white p-3 shadow-lg">
            {active.render(close)}
          </div>
        )}
      </div>

      <Button variant="ghost" onClick={onClear}>Цуцлах</Button>
    </div>
  )
}

export function DataTable({ columns, rows, empty, onRowClick, toolbar, selection, bulkActions }) {
  const selectable = Boolean(selection)
  const span = columns.length + (selectable ? 1 : 0)

  return (
    <div className="rounded-xl border border-a-line bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      {selectable && selection.count > 0
        ? <BulkBar count={selection.count} actions={bulkActions ?? []} onClear={selection.clear} />
        : toolbar}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-y border-a-line">
              {selectable && (
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
                    selectable && selection.isSelected(row) ? 'bg-a-hover' : ''
                  }`}
                >
                  {selectable && (
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

export function TableToolbar({ search, onSearch, placeholder = 'Хайх', children }) {
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
          className="w-[220px] rounded-md border border-a-line bg-white py-[6px] pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-a-focus focus:ring-2 focus:ring-a-focus/15"
        />
      </label>
    </div>
  )
}

/* --------------------------------- forms --------------------------------- */

export function Field({ label, hint, required, children }) {
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

export const Input = ({ className = '', ...props }) => (
  <input
    {...props}
    className={`w-full rounded-md border border-a-line bg-white px-3 py-[7px] text-[13px] text-a-ink outline-none transition-colors placeholder:text-a-muted focus:border-a-focus focus:ring-2 focus:ring-a-focus/15 ${className}`}
  />
)

export const Select = ({ className = '', ...props }) => (
  <select
    {...props}
    className={`w-full rounded-md border border-a-line bg-white px-3 py-[7px] text-[13px] text-a-ink outline-none focus:border-a-focus focus:ring-2 focus:ring-a-focus/15 ${className}`}
  />
)

export const Textarea = ({ className = '', ...props }) => (
  <textarea
    {...props}
    className={`w-full rounded-md border border-a-line bg-white px-3 py-2 text-[13px] text-a-ink outline-none transition-colors focus:border-a-focus focus:ring-2 focus:ring-a-focus/15 ${className}`}
  />
)

export function PageHeader({ title, subtitle, actions }) {
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

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-xl border border-dashed border-a-line bg-white px-6 py-16 text-center">
      <p className="text-[14px] font-medium text-a-ink">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-a-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Timeline used in the order detail rail. */
export function Activity({ items }) {
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
