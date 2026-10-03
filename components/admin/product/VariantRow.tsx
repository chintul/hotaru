'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { useMutation } from '@apollo/client/react'
import { toNumber } from '@/lib/format'
import { variantLabel } from '@/lib/admin/images'
import { Button, IconButton, Input, MENU_CONTENT_CLASS, MENU_ITEM_CLASS, Thumb } from '@/components/admin/ui'
import { useConfirm } from '@/components/admin/confirm'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dots } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import { saleOf } from '@/lib/sale'
import { cn } from '@/lib/utils'
import ImagePicker from './ImagePicker'
import PreorderToggle from './PreorderToggle'
import {
  DELETE_VARIANT,
  SET_STOCK,
  SET_VARIANT_PREORDER_PRICE,
  SET_VARIANT_SIZE,
  UPSERT_VARIANT,
} from './documents'
import { COMPARE_AT_MESSAGE, variantErrorMessage } from './sizeGrid'
import SaleBadge from './SaleBadge'
import { TOUCH_INPUT } from './touch'
import type { UpsertVariantVars } from './documents'
import type { EditorImage, EditorProduct, EditorVariant, Refetch } from './types'

export interface VariantRowProps {
  product: EditorProduct
  variant: EditorVariant
  images: readonly EditorImage[]
  sharedCount: number
  refetch: Refetch
  canDelete: boolean
}

interface VariantFields {
  optionValue: string
  sku: string
  priceMnt: string
  compareAtPriceMnt: string
  quantity: string
}

const FIELD_NAMES: readonly (keyof VariantFields)[] = ['optionValue', 'sku', 'priceMnt', 'compareAtPriceMnt', 'quantity']

const DEFAULT_OPTION_LABEL = 'Өнгө'

export const VARIANT_GRID_CLASS = 'md:grid md:grid-cols-[64px_minmax(0,1fr)_88px_120px_124px_124px_96px_40px] md:items-center md:gap-4'

const CURRENCY_SUFFIX = 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-a-muted'

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[12px] text-a-muted md:hidden">{label}</span>
      {children}
    </label>
  )
}

export default function VariantRow({ product, variant, images, sharedCount, refetch, canDelete }: VariantRowProps) {
  const initial: VariantFields = {
    optionValue: variant.optionValue ?? '',
    sku: variant.sku ?? '',
    priceMnt: String(toNumber(variant.priceMnt)),
    compareAtPriceMnt: variant.compareAtPriceMnt == null || variant.compareAtPriceMnt === ''
      ? ''
      : String(toNumber(variant.compareAtPriceMnt)),
    quantity: String(variant.quantity),
  }

  const [f, setF] = useState<VariantFields>(initial)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backorder, setBackorder] = useState(variant.allowBackorder ?? false)
  const confirm = useConfirm()

  const [save, { loading: saving }] = useMutation(UPSERT_VARIANT)
  const [setStock, { loading: stocking }] = useMutation(SET_STOCK)
  const [removeVariant] = useMutation(DELETE_VARIANT)

  const dirty = FIELD_NAMES.some((k) => f[k] !== initial[k])
  const stockOnly =
    f.quantity !== initial.quantity &&
    f.optionValue === initial.optionValue &&
    f.sku === initial.sku &&
    f.priceMnt === initial.priceMnt &&
    f.compareAtPriceMnt === initial.compareAtPriceMnt

  const set = (k: keyof VariantFields, digits = false) => (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setF({ ...f, [k]: digits ? e.target.value.replace(/\D/g, '') : e.target.value })
  }

  const upsert = async (overrides: Partial<UpsertVariantVars> = {}) => {
    await save({ variables: {
      productId: product.id,
      variantId: variant.id,
      priceMnt: String(toNumber(f.priceMnt)),
      quantity: Number(f.quantity || 0),
      sku: f.sku || null,
      optionLabel: f.optionValue ? (variant.optionLabel || DEFAULT_OPTION_LABEL) : null,
      optionValue: f.optionValue || null,
      compareAtPriceMnt: f.compareAtPriceMnt ? String(toNumber(f.compareAtPriceMnt)) : null,
      allowBackorder: backorder,
      isActive: variant.isActive,
      sortOrder: variant.position ?? 0,
      imageId: null,
      ...overrides,
    } })
    await refetch()
  }

  const compareAtInvalid =
    f.compareAtPriceMnt !== '' && toNumber(f.compareAtPriceMnt) <= toNumber(f.priceMnt)

  const onSave = async () => {
    setError(null)
    if (compareAtInvalid) {
      setError(COMPARE_AT_MESSAGE)
      return
    }
    try {
      if (stockOnly) {
        await setStock({ variables: { variantId: variant.id, quantity: Number(f.quantity || 0) } })
        await refetch()
      } else {
        await upsert()
      }
    } catch (e) {
      setError(variantErrorMessage(e, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  const toggleActive = async () => {
    setError(null)
    try { await upsert({ isActive: !variant.isActive }) }
    catch (e) { setError(variantErrorMessage(e, 'Алдаа гарлаа.')) }
  }

  const toggleBackorder = async (next: boolean) => {
    setError(null)
    setBackorder(next)
    try { await upsert({ allowBackorder: next }) }
    catch (e) {
      setBackorder(!next)
      setError(errorMessage(e, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  const onDelete = async () => {
    const ok = await confirm({
      title: `"${variantLabel(variant)}" сонголтыг устгах уу?`,
      confirmLabel: 'Устгах',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    try {
      await removeVariant({ variables: { variantId: variant.id } })
      await refetch()
    } catch (e) {
      setError(errorMessage(e, 'Устгахад алдаа гарлаа.'))
    }
  }

  const outOfStock = Number(f.quantity || 0) === 0 && !backorder
  const sale = saleOf(f.priceMnt, f.compareAtPriceMnt)

  return (
    <li className="border-b border-a-line px-4 py-4 last:border-0 hover:bg-a-bg/60 md:px-6">
      <div className={`grid grid-cols-2 gap-3 ${VARIANT_GRID_CLASS}`}>
        <div className="col-span-2 flex min-w-0 items-center gap-3 md:contents">
          <div className="relative shrink-0">
            <ImagePicker
              open={picking}
              onOpenChange={setPicking}
              product={product}
              variant={variant}
              images={images}
              refetch={refetch}
            >
              <Thumb
                filePath={variant.image?.filePath}
                alt={variant.image?.alt ?? ''}
                count={sharedCount}
                title={variant.image ? 'Зураг солих' : 'Зураг сонгох'}
                className="size-12 md:size-16"
              />
            </ImagePicker>
          </div>

          <div className="min-w-0 flex-1 md:hidden">
            <p className="truncate text-[14px] font-medium text-a-ink">
              {variantLabel({ ...variant, optionValue: f.optionValue })}
            </p>
            {(sale || !variant.isActive) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {sale && <SaleBadge pct={sale.pct} />}
                {!variant.isActive && <InactiveBadge />}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end md:order-last">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <IconButton aria-label="Цэс"><Dots /></IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
                <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={toggleActive}>
                  {variant.isActive ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" className={MENU_ITEM_CLASS} onSelect={onDelete}>
                      Устгах
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Labelled label="Өнгө">
          <Input value={f.optionValue} onChange={set('optionValue')} placeholder="Өнгө" aria-label="Өнгө" className={TOUCH_INPUT} />
        </Labelled>
        <Labelled label="Хэмжээ">
          <SizeInput
            key={variant.size ?? ''}
            variantId={variant.id}
            size={variant.size}
            refetch={refetch}
            onError={setError}
          />
        </Labelled>
        <Labelled label="SKU">
          <Input value={f.sku} onChange={set('sku')} placeholder="—" className={`${TOUCH_INPUT} tabular-nums`} />
        </Labelled>

        <Labelled label="Үнэ">
          <span className="relative block">
            <Input
              inputMode="numeric"
              value={f.priceMnt}
              onChange={set('priceMnt', true)}
              aria-label="Үнэ"
              className={`${TOUCH_INPUT} pr-7 text-right tabular-nums`}
            />
            <span className={CURRENCY_SUFFIX}>₮</span>
          </span>
        </Labelled>

        <Labelled label="Хуучин үнэ">
          <span className="relative block">
            <Input
              inputMode="numeric"
              value={f.compareAtPriceMnt}
              onChange={set('compareAtPriceMnt', true)}
              placeholder="—"
              aria-label="Хуучин үнэ"
              title="Хоосон бол хямдралгүй"
              aria-invalid={compareAtInvalid || undefined}
              className={`${TOUCH_INPUT} pr-7 text-right tabular-nums text-a-muted`}
            />
            <span className={CURRENCY_SUFFIX}>₮</span>
          </span>
        </Labelled>

        <Labelled label="Үлдэгдэл">
          <Input
            inputMode="numeric"
            value={f.quantity}
            onChange={set('quantity', true)}
            aria-label="Үлдэгдэл"
            tone={outOfStock ? 'blush' : 'mint'}
            className={`${TOUCH_INPUT} text-center font-medium tabular-nums`}
          />
        </Labelled>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 md:mt-2.5 md:pl-20">
        <PreorderToggle compact checked={backorder} onCheckedChange={toggleBackorder} disabled={saving} />
        {backorder && (
          <span className="text-[13px] text-a-muted">үлдэгдэл дууссан ч худалдана</span>
        )}
        {backorder && (
          <PreorderPriceInput
            key={String(variant.preorderPriceMnt ?? '')}
            variantId={variant.id}
            preorderPriceMnt={variant.preorderPriceMnt}
            normalPrice={toNumber(f.priceMnt)}
            refetch={refetch}
            onError={setError}
          />
        )}
        {sale && <SaleBadge pct={sale.pct} className="hidden md:inline-flex" />}
        {dirty && (
          <Button
            variant="primary"
            size="sm"
            disabled={saving || stocking}
            onClick={onSave}
            className="max-md:order-last max-md:h-10 max-md:w-full max-md:text-[14px]"
          >
            Хадгалах
          </Button>
        )}
        {!variant.isActive && <InactiveBadge className="hidden md:inline-flex" />}
        {!variant.image && (
          <span className="text-[13px] text-a-muted">зураггүй · картад эхний зураг харагдана</span>
        )}
        {error && <span className="text-[13px] text-danger-ink">{error}</span>}
      </div>
    </li>
  )
}

function InactiveBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn('rounded-full px-2.5 py-1 text-[12px] font-normal text-muted-foreground', className)}
    >
      идэвхгүй
    </Badge>
  )
}

interface PreorderPriceInputProps {
  variantId: string
  preorderPriceMnt: EditorVariant['preorderPriceMnt']
  normalPrice: number
  refetch: Refetch
  onError: (message: string | null) => void
}

function PreorderPriceInput({ variantId, preorderPriceMnt, normalPrice, refetch, onError }: PreorderPriceInputProps) {
  const initial = preorderPriceMnt == null ? '' : String(toNumber(preorderPriceMnt))
  const [value, setValue] = useState(initial)
  const [savePrice, { loading }] = useMutation(SET_VARIANT_PREORDER_PRICE)

  const commit = async () => {
    if (value === initial || loading) return
    onError(null)
    try {
      await savePrice({ variables: { variantId, priceMnt: value ? String(toNumber(value)) : null } })
      await refetch()
    } catch (e) {
      setValue(initial)
      onError(errorMessage(e, 'Урьдчилсан үнийг хадгалахад алдаа гарлаа.'))
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commit() }
    if (e.key === 'Escape') setValue(initial)
  }

  return (
    <label className="flex flex-wrap items-center gap-2 text-[13px] text-a-muted max-md:w-full">
      <span className="text-a-ink">Урьдчилсан үнэ</span>
      <span className="relative">
        <Input
          inputMode="numeric"
          value={value}
          placeholder={normalPrice ? String(normalPrice) : ''}
          disabled={loading}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          onBlur={() => void commit()}
          onKeyDown={onKeyDown}
          className="h-10 w-32 pr-7 text-right text-[16px] tabular-nums md:h-8 md:text-[14px]"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-a-muted">₮</span>
      </span>
      {loading
        ? <span>Хадгалж байна…</span>
        : !value && <span>Хоосон бол үндсэн үнэ</span>}
    </label>
  )
}

interface SizeInputProps {
  variantId: string
  size: EditorVariant['size']
  refetch: Refetch
  onError: (message: string | null) => void
}

function SizeInput({ variantId, size, refetch, onError }: SizeInputProps) {
  const [saved, setSaved] = useState(size ?? '')
  const [value, setValue] = useState(saved)
  const [saveSize, { loading }] = useMutation(SET_VARIANT_SIZE)
  const inFlight = useRef(false)

  const commit = async () => {
    if (inFlight.current) return
    const next = value.trim()
    if (next === saved) {
      setValue(saved)
      return
    }
    inFlight.current = true
    onError(null)
    try {
      await saveSize({ variables: { variantId, size: next || null } })
    } catch (e) {
      setValue(saved)
      onError(variantErrorMessage(e, 'Хэмжээг хадгалахад алдаа гарлаа.'))
      return
    } finally {
      inFlight.current = false
    }
    setSaved(next)
    setValue(next)
    try {
      await refetch()
    } catch {
      onError('Хэмжээ хадгалагдсан ч жагсаалтыг шинэчилж чадсангүй.')
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commit() }
    if (e.key === 'Escape') setValue(saved)
  }

  return (
    <Input
      value={value}
      placeholder="—"
      aria-label="Хэмжээ"
      readOnly={loading}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={onKeyDown}
      className={`${TOUCH_INPUT} text-center tabular-nums`}
    />
  )
}
