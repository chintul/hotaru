'use client'

/**
 * Small admin UI kit.
 *
 * The dashboard deliberately does NOT inherit the storefront's look: the shop
 * is editorial and image-led, an operations console is dense and neutral. This
 * follows the Saleor/Medusa convention — light grey canvas, white cards with
 * hairline borders, 13px text, subdued status pills.
 */

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-a-line bg-white ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-a-line px-5 py-3.5">
          {title && <h2 className="text-[14px] font-semibold text-a-ink">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-a-line text-left">
            {head.map((h) => (
              <th
                // Object-shaped headers ({label, align}) all stringify to
                // "[object Object]", so fall back to the label, not the object.
                key={h.key ?? h.label ?? h}
                className={`px-3 py-2.5 text-[12px] font-medium text-a-muted ${h.align === 'right' ? 'text-right' : ''}`}
              >
                {h.label ?? h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export const Tr = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    className={`border-b border-a-line last:border-0 ${onClick ? 'cursor-pointer hover:bg-a-hover' : ''}`}
  >
    {children}
  </tr>
)

export const Td = ({ children, align, className = '' }) => (
  <td className={`px-3 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>
)

const TONES = {
  neutral: 'bg-a-hover text-a-muted border-a-line',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
}

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-a-ink text-white hover:opacity-90',
    secondary: 'border border-a-line bg-white text-a-ink hover:bg-a-hover',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
    ghost: 'text-a-muted hover:text-a-ink',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    />
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-a-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-a-muted">{hint}</span>}
    </label>
  )
}

export const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-md border border-a-line bg-white px-3 py-2 text-[13px] text-a-ink outline-none transition-colors focus:border-a-focus focus:ring-2 focus:ring-a-focus/20 ${props.className ?? ''}`}
  />
)

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-a-ink">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-a-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-lg border border-dashed border-a-line bg-white px-6 py-14 text-center">
      <p className="text-[14px] font-medium text-a-ink">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-a-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
