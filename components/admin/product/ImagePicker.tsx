'use client'

import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useMutation } from '@apollo/client/react'
import ProductImage from '@/components/ProductImage'
import { Popover } from '@/components/admin/ui'
import { Check, Plus } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import { ADD_IMAGE, SET_VARIANT_IMAGE } from './documents'
import { uploadProductImage } from './uploadImage'
import type { EditorImage, EditorProduct, EditorVariant, Refetch } from './types'

export interface ImagePickerProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  product: EditorProduct
  variant: EditorVariant
  images: readonly EditorImage[]
  refetch: Refetch
}

export default function ImagePicker({ open, onClose, anchorRef, product, variant, images, refetch }: ImagePickerProps) {
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
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} className="left-0 top-full w-[340px] p-3">
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

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-a-line px-3 py-3 text-[14px] font-medium text-a-muted transition-colors hover:border-a-focus hover:text-a-ink disabled:opacity-40"
      >
        <Plus /> {busy ? 'Байршуулж байна…' : 'шинэ зураг'}
      </button>

      {variant.image && (
        <button
          type="button"
          disabled={busy}
          onClick={() => assign(null)}
          className="mt-1.5 w-full rounded-xl px-3 py-2 text-[13px] text-a-muted transition-colors hover:bg-a-hover hover:text-a-ink disabled:opacity-40"
        >
          зураг салгах
        </button>
      )}

      {error && <p className="mt-2 px-0.5 text-[13px] text-danger-ink">{error}</p>}
    </Popover>
  )
}
