'use client'

import { useId, useState } from 'react'
import { formatMnt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT, type Translate } from '@/lib/i18n'

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

function choicesFor(min: number, total: number, t: Translate): Choice[] {
  const half = Math.ceil((total * HALF_PCT) / 100)
  const list: Choice[] = [{ label: t('Хамгийн бага', 'Minimum'), amount: min }]
  if (half > min && half < total) list.push({ label: `${HALF_PCT}%`, amount: half })
  if (total > min) list.push({ label: t('Бүтэн дүн', 'Full amount'), amount: total })
  return list
}

function problemOf(amount: number | null, min: number, total: number, t: Translate): string | null {
  if (amount === null) return t('Төлөх дүнгээ оруулна уу', 'Enter an amount to pay')
  if (amount < min) return t(`Хамгийн багадаа ${formatMnt(min)}`, `At least ${formatMnt(min)}`)
  if (amount > total) return t('Нийт дүнгээс их байж болохгүй', 'Can’t be more than the total')
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
  const t = useT()
  const inputId = useId()
  const [amount, setAmount] = useState<number | null>(initial)
  const choices = choicesFor(min, total, t)
  const problem = problemOf(amount, min, total, t)
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
        {t(
          `Хамгийн багадаа ${formatMnt(min)} урьдчилж төлнө, бүтэн дүнгээр ч төлж болно.`,
          `Pay at least ${formatMnt(min)} up front, or the full amount if you prefer.`,
        )}
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
        className="mt-4 block text-[11px] font-semibold leading-normal text-ink-faint"
      >
        {t('Эсвэл дүнгээ бичих', 'Or type an amount')}
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
            {t('Үлдэгдэл:', 'Balance:')} <span className="font-semibold text-ink tabular-nums">{formatMnt(balance)}</span>{' '}
            {t('бараа ирэхэд', 'when your items arrive')}
          </span>
        ) : (
          <span className="text-ink-soft">{t('Бүтэн дүнгээр төлөхөд үлдэгдэл үлдэхгүй', 'Paying in full leaves no balance')}</span>
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
          {busy ? t('Хадгалж байна…', 'Saving…') : t('Энэ дүнгээр төлөх', 'Pay this amount')}
        </Button>
        {onCancel && (
          <Button type="button" variant="line" size="cta" onClick={onCancel} className="rounded-full px-5">
            {t('Болих', 'Cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
