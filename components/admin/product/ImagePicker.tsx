'use client'

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@apollo/client/react'
import ProductImage from '@/components/ProductImage'
import { Button } from '@/components/admin/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, Plus } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import { ADD_IMAGE, SET_VARIANT_IMAGE } from './documents'
import { uploadProductImage } from './uploadImage'
import type { EditorImage, EditorProduct, EditorVariant, Refetch } from './types'

export interface ImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  product: EditorProduct
  variant: EditorVariant
  images: readonly EditorImage[]
  refetch: Refetch
}

export default function ImagePicker({ open, onOpenChange, children, product, variant, images, refetch }: ImagePickerProps) {
  const onClose = () => onOpenChange(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addImage] = useMutation(ADD_IMAGE)
  const [setVariantImage] = useMutation(SET_VARIANT_IMAGE)

  const assign = async (imageId: string | null) => {
    setError(null)
    setBusy(true)
    try {
      await setVariantImage({ variables: { variantId: variant.id, imageId } })
      await refetch()
      onClose()
    } catch (e) {
      setError(errorMessage(e, 'Алдаа гарлаа.'))
    } finally {
      setBusy(false)
    }
  }

  const uploadAndAssign = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const result = await uploadProductImage(file, product.slug)

      const added = await addImage({ variables: {
        productId: product.id,
        imagekitFileId: result.fileId,
        filePath: result.filePath,
        alt: variant.optionValue ?? null,
        width: result.width ?? null,
        height: result.height ?? null,
      } })

      const newId = added.data?.adminAddProductImage?.id
      if (!newId) throw new Error('Зураг бүртгэгдсэнгүй.')
      await setVariantImage({ variables: { variantId: variant.id, imageId: newId } })

      await refetch()
      onClose()
    } catch (e) {
      setError(errorMessage(e, 'Байршуулахад алдаа гарлаа.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] rounded-xl p-3">
        <p className="px-0.5 pb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-a-muted">
          Бүтээгдэхүүний зураг
        </p>

        {images.length === 0 && (
          <p className="px-0.5 pb-2 text-[13px] text-a-muted">Энэ бараанд зураг алга.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {images.map((img) => {
            const chosen = variant.image?.id === img.id
            return (
              <button
                key={img.id}
                type="button"
                disabled={busy}
                onClick={() => assign(img.id)}
                title={img.alt ?? ''}
                className={`relative h-14 w-14 overflow-hidden rounded-xl border-2 transition-all disabled:opacity-40 ${
                  chosen ? 'border-a-ink ring-4 ring-a-ink/10' : 'border-transparent hover:border-a-focus'
                }`}
              >
                <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} width={56} height={56} />
                {chosen && (
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-white"><Check /></span>
                )}
              </button>
            )
          })}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadAndAssign(file)
          }}
        />

        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-3 h-auto w-full rounded-xl border-2 border-dashed px-3 py-3 text-[14px] text-muted-foreground shadow-none hover:border-ring hover:bg-card hover:text-foreground has-[>svg]:px-3"
        >
          <Plus /> {busy ? 'Байршуулж байна…' : 'шинэ зураг'}
        </Button>

        {variant.image && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => assign(null)}
            className="mt-1.5 h-9 w-full rounded-xl font-normal"
          >
            зураг салгах
          </Button>
        )}

        {error && <p className="mt-2 px-0.5 text-[13px] text-danger-ink">{error}</p>}
      </PopoverContent>
    </Popover>
  )
}
