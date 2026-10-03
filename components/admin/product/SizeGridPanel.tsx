'use client'

import { useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { useMutation } from '@apollo/client/react'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { SIZE_PRESETS, parseSizes, uniqueColours } from '@/lib/sizes'
import { Button, Field, Input } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import PreorderToggle from './PreorderToggle'
import { CREATE_SIZE_GRID } from './documents'
import { planGrid, plannedLabel, variantErrorMessage } from './sizeGrid'
import { PANEL_ACTIONS, TOUCH_INPUT } from './touch'
import type { EditorVariant } from './types'

export interface SizeGridPanelProps {
  productId: string
  variants: readonly EditorVariant[]
  onClose: () => void
  onCreated: (notice: string) => void
}

const PREVIEW_COUNT = 6

const digitsOnly = (value: string) => value.replace(/\D/g, '')

const appendUnique = (list: readonly string[], more: readonly string[]) => {
  const next = [...list]
  for (const item of more) if (!next.includes(item)) next.push(item)
  return next
}

const defaultPrice = (variants: readonly EditorVariant[]) => {
  const source = variants.find((v) => v.isActive) ?? variants[0]
  const price = toNumber(source?.priceMnt)
  return price ? String(price) : ''
}

const isBlank = (v: EditorVariant) => v.isActive && !v.optionValue && !v.size

export default function SizeGridPanel({ productId, variants, onClose, onCreated }: SizeGridPanelProps) {
  const [sizes, setSizes] = useState<string[]>([])
  const [customSizes, setCustomSizes] = useState('')
  const [colours, setColours] = useState<string[]>(() => uniqueColours(variants))
  const [newColour, setNewColour] = useState('')
  const [priceMnt, setPriceMnt] = useState(() => defaultPrice(variants))
  const [quantity, setQuantity] = useState('0')
  const [allowBackorder, setAllowBackorder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createGrid, { loading }] = useMutation(CREATE_SIZE_GRID)

  const { planned, skipped } = planGrid(colours, sizes, variants)
  const preview = planned.slice(0, PREVIEW_COUNT).map(plannedLabel).join(', ')
  const rest = planned.length - PREVIEW_COUNT

  const togglePreset = (presetSizes: readonly string[]) => {
    setError(null)
    const allIn = presetSizes.every((s) => sizes.includes(s))
    setSizes(allIn ? sizes.filter((s) => !presetSizes.includes(s)) : appendUnique(sizes, presetSizes))
  }

  const addCustomSizes = () => {
    const parsed = parseSizes(customSizes)
    if (!parsed.length) return
    setError(null)
    setSizes(appendUnique(sizes, parsed))
    setCustomSizes('')
  }

  const addColour = () => {
    const colour = newColour.trim()
    if (!colour) return
    setError(null)
    setColours(appendUnique(colours, [colour]))
    setNewColour('')
  }

  const onEnter = (action: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); action() }
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!planned.length || !priceMnt || loading) return
    setError(null)
    const hadBlank = variants.some(isBlank)
    try {
      const { data } = await createGrid({ variables: {
        productId,
        sizes,
        priceMnt: String(toNumber(priceMnt)),
        colours: colours.length ? colours : null,
        quantity: Number(quantity || 0),
        allowBackorder,
      } })
      const created = nodes(data?.adminCreateSizeGrid).length
      const parts = [created ? `${created} сонголт нэмэгдлээ.` : 'Шинэ сонголт нэмэгдсэнгүй — бүгд аль хэдийн байна.']
      if (hadBlank) parts.push('Хуучин хэмжээгүй сонголтыг нуусан.')
      onCreated(parts.join(' '))
    } catch (err) {
      setError(variantErrorMessage(err, 'Хэмжээ нэмэхэд алдаа гарлаа.'))
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h3 className="text-[14px] font-semibold text-a-ink">Хэмжээ нэмэх</h3>
        <p className="text-[12px] text-a-muted">Өнгө бүр × хэмжээ бүр тусдаа сонголт болно</p>
      </div>

      <Section label="Хэмжээ">
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((preset) => (
            <Chip
              key={preset.key}
              active={preset.sizes.every((s) => sizes.includes(s))}
              onClick={() => togglePreset(preset.sizes)}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
        <div className="flex max-w-md gap-2">
          <Input
            value={customSizes}
            onChange={(e) => setCustomSizes(e.target.value)}
            onKeyDown={onEnter(addCustomSizes)}
            placeholder="Өөрөө бичих: 36.5, 37, 37.5"
            aria-label="Өөрөө бичих"
            className={TOUCH_INPUT}
          />
          <Button type="button" onClick={addCustomSizes} disabled={!parseSizes(customSizes).length}>Нэмэх</Button>
        </div>
        {sizes.length > 0 ? (
          <ChipList items={sizes} onRemove={(s) => setSizes(sizes.filter((x) => x !== s))} removeLabel="хэмжээг хасах" />
        ) : (
          <p className="text-[12px] text-a-muted">Хэмжээ сонгоогүй байна.</p>
        )}
      </Section>

      <Section label="Өнгө">
        {colours.length > 0 ? (
          <ChipList items={colours} onRemove={(c) => setColours(colours.filter((x) => x !== c))} removeLabel="өнгийг хасах" />
        ) : (
          <p className="text-[12px] text-a-muted">Өнгөгүй — зөвхөн хэмжээгээр үүснэ.</p>
        )}
        <div className="flex max-w-md flex-wrap gap-2">
          <Input
            value={newColour}
            onChange={(e) => setNewColour(e.target.value)}
            onKeyDown={onEnter(addColour)}
            placeholder="Хар"
            aria-label="Өнгө нэмэх"
            className={`${TOUCH_INPUT} basis-full sm:w-48 sm:basis-auto`}
          />
          <Button type="button" onClick={addColour} disabled={!newColour.trim()}>Өнгө нэмэх</Button>
          {colours.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setColours([])}>Өнгөгүй</Button>
          )}
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end md:gap-4">
        <Field label="Үнэ (₮)" hint={priceMnt ? formatMnt(toNumber(priceMnt)) : undefined}>
          <Input
            required
            inputMode="numeric"
            value={priceMnt}
            onChange={(e) => setPriceMnt(digitsOnly(e.target.value))}
            className={`${TOUCH_INPUT} text-right tabular-nums md:w-36`}
          />
        </Field>
        <Field label="Үлдэгдэл (сонголт бүрт)">
          <Input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(digitsOnly(e.target.value))}
            className={`${TOUCH_INPUT} text-center tabular-nums md:w-28`}
          />
        </Field>
        <PreorderToggle compact checked={allowBackorder} onCheckedChange={setAllowBackorder} className="col-span-2 md:pb-2" />
      </div>

      <p className="rounded-lg border border-a-line bg-a-bg px-4 py-2.5 text-[13px] text-a-ink">
        {planned.length > 0 ? (
          <>
            <span className="font-medium">{planned.length} сонголт үүснэ:</span> {preview}
            {rest > 0 && <span className="text-a-muted"> … +{rest}</span>}
          </>
        ) : (
          <span className="text-a-muted">{sizes.length ? 'Шинээр үүсэх сонголт алга.' : 'Хэмжээ сонгоно уу.'}</span>
        )}
        {skipped > 0 && <span className="text-a-muted"> · {skipped} нь аль хэдийн байгаа тул алгасна</span>}
      </p>

      {error && <p className="text-[13px] text-danger-ink">{error}</p>}

      <div className={PANEL_ACTIONS}>
        <Button type="submit" variant="primary" disabled={loading || !planned.length || !priceMnt}>
          {loading ? 'Үүсгэж байна…' : planned.length ? `${planned.length} сонголт үүсгэх` : 'Үүсгэх'}
        </Button>
        <Button type="button" onClick={onClose}>Болих</Button>
      </div>
    </form>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-[13px] font-medium text-a-ink">{label}</p>
      {children}
    </div>
  )
}

interface ChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[13px] transition-colors md:py-1',
        active ? 'border-info-line bg-info-soft text-info-ink' : 'border-a-line text-a-ink hover:bg-a-hover',
      )}
    >
      {children}
    </button>
  )
}

interface ChipListProps {
  items: readonly string[]
  onRemove: (item: string) => void
  removeLabel: string
}

function ChipList({ items, onRemove, removeLabel }: ChipListProps) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="inline-flex items-center gap-1 rounded-full border border-a-line bg-a-hover py-0.5 pl-2.5 pr-1 text-[13px] text-a-ink tabular-nums"
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`${item} ${removeLabel}`}
            className="grid size-7 place-items-center rounded-full md:size-5 text-a-muted hover:bg-a-line hover:text-a-ink"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
