'use client'

import { useId, useState } from 'react'
import { formatMnt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AmountChooserProps {
  min: number
  total: number
  initial: number
  busy: boolean
  error: string | null
  onConfirm: (amount: number) => void
  onCancel?: () => void
}

interface Choice {
  label: string
  amount: number
}

const HALF_PCT = 50

const groupDigits = (n: number): string => new Intl.NumberFormat('mn-MN').format(n)

function choicesFor(min: number, total: number): Choice[] {
  const half = Math.ceil((total * HALF_PCT) / 100)
  const list: Choice[] = [{ label: 'Хамгийн бага', amount: min }]
  if (half > min && half < total) list.push({ label: `${HALF_PCT}%`, amount: half })
  if (total > min) list.push({ label: 'Бүтэн дүн', amount: total })
  return list
}

function problemOf(amount: number | null, min: number, total: number): string | null {
  if (amount === null) return 'Төлөх дүнгээ оруулна уу'
  if (amount < min) return `Хамгийн багадаа ${formatMnt(min)}`
  if (amount > total) return 'Нийт дүнгээс их байж болохгүй'
  return null
}

export default function AmountChooser({
  min,
  total,
  initial,
  busy,
  error,
  onConfirm,
  onCancel,
}: AmountChooserProps) {
  const inputId = useId()
  const [amount, setAmount] = useState<number | null>(initial)
  const choices = choicesFor(min, total)
  const problem = problemOf(amount, min, total)
  const balance = amount === null ? 0 : total - amount

  const onType = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 12)
    setAmount(digits ? Number(digits) : null)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (amount !== null && !problem) onConfirm(amount)
      }}
    >
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Хамгийн багадаа {formatMnt(min)} урьдчилж төлнө, бүтэн дүнгээр ч төлж болно.
      </p>

      <div
        className="mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
      >
        {choices.map((c) => {
          const active = amount === c.amount
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => setAmount(c.amount)}
              aria-pressed={active}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition-colors ${
                active ? 'border-ink bg-ink-strong text-paper' : 'border-line bg-paper hover:border-ink'
              }`}
            >
              <span className={`text-[11px] font-semibold ${active ? 'text-paper' : 'text-ink-faint'}`}>
                {c.label}
              </span>
              <span className="mt-0.5 text-[13px] font-semibold tabular-nums">{formatMnt(c.amount)}</span>
            </button>
          )
        })}
      </div>

      <Label
        htmlFor={inputId}
        className="mt-4 block text-[11px] font-semibold uppercase leading-normal tracking-[.6px] text-ink-faint"
      >
        Эсвэл дүнгээ бичих
      </Label>
      <div className="relative mt-2">
        <Input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          value={amount === null ? '' : groupDigits(amount)}
          onChange={(e) => onType(e.target.value)}
          aria-invalid={problem !== null}
          aria-describedby={`${inputId}-hint`}
          className="h-12 rounded-2xl bg-paper-warm pl-4 pr-9 text-[15px] tabular-nums md:text-[15px]"
        />
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-ink-faint">
          ₮
        </span>
      </div>

      <p id={`${inputId}-hint`} role="status" className="mt-2 min-h-5 text-[13px]">
        {problem ? (
          <span className="text-sale">{problem}</span>
        ) : balance > 0 ? (
          <span className="text-ink-soft">
            Үлдэгдэл: <span className="font-semibold text-ink tabular-nums">{formatMnt(balance)}</span> бараа ирэхэд
          </span>
        ) : (
          <span className="text-ink-soft">Бүтэн дүнгээр төлөхөд үлдэгдэл үлдэхгүй</span>
        )}
      </p>

      {error && <p className="mt-2 text-[13px] text-sale">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button
          type="submit"
          variant="solid"
          size="cta"
          disabled={busy || problem !== null}
          className="flex-1 rounded-full"
        >
          {busy ? 'Хадгалж байна…' : 'Энэ дүнгээр төлөх'}
        </Button>
        {onCancel && (
          <Button type="button" variant="line" size="cta" onClick={onCancel} className="rounded-full px-5">
            Болих
          </Button>
        )}
      </div>
    </form>
  )
}
