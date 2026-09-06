'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import { ADMIN_ADD_IMAGE, ADMIN_SET_VARIANT_IMAGE } from '@/lib/queries'
import ProductImage from '@/components/ProductImage'
import { Popover } from '@/components/admin/ui'
import { Check, Plus } from '@/components/admin/icons'

/**
 * Give one variant its photograph — pick an existing one, upload a new one, or
 * clear it.
 *
 * Uploading from here is the primary path on purpose: for this shop a variant
 * essentially IS a photo, and the real task is "a new colourway arrived, here
 * is its picture" — not "upload to the gallery, scroll back, then link".
 *
 * The chain is /api/upload-auth -> ImageKit -> adminAddProductImage ->
 * adminSetVariantImage. If that last step fails, the photo is in the gallery
 * and the variant is still empty: both visible, and re-linkable in one click.
 * The same recoverable direction the two-step upload already chose — never a
 * row pointing at nothing.
 */
export default function ImagePicker({ open, onClose, anchorRef, product, variant, images, refetch }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [addImage] = useMutation(ADMIN_ADD_IMAGE)
  const [setVariantImage] = useMutation(ADMIN_SET_VARIANT_IMAGE)

  const assign = async (imageId) => {
    setError(null)
    setBusy(true)
    try {
      await setVariantImage({ variables: { variantId: variant.id, imageId } })
      await refetch()
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Алдаа гарлаа.')
    } finally {
      setBusy(false)
    }
  }

  const uploadAndAssign = async (file) => {
    setError(null)
    setBusy(true)
    try {
      const authRes = await fetch('/api/upload-auth')
      if (!authRes.ok) {
        throw new Error(authRes.status === 403
          ? 'Админ эрх шаардлагатай.'
          : 'Байршуулах эрх авахад алдаа гарлаа.')
      }
      const { token, signature, expire, publicKey } = await authRes.json()

      const result = await upload({
        file,
        fileName: `${product.slug}-${Date.now()}-${file.name}`,
        folder: `/hotaru/${product.slug}`,
        useUniqueFileName: true,
        publicKey,
        token,
        signature,
        expire,
      })

      const added = await addImage({ variables: {
        productId: product.id,
        imagekitFileId: result.fileId,
        filePath: result.filePath,
        // The colourway name is the only alt text anyone has; better than null.
        alt: variant.optionValue ?? null,
        width: result.width ?? null,
        height: result.height ?? null,
      } })

      const newId = added?.data?.adminAddProductImage?.id
      if (!newId) throw new Error('Зураг бүртгэгдсэнгүй.')
      await setVariantImage({ variables: { variantId: variant.id, imageId: newId } })

      await refetch()
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Байршуулахад алдаа гарлаа.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} className="left-0 top-full w-[268px] p-2">
      <p className="px-1 pb-1.5 text-[12px] font-medium text-a-muted">Бүтээгдэхүүний зураг</p>

      {images.length === 0 && (
        <p className="px-1 pb-2 text-[12px] text-a-muted">Энэ бараанд зураг алга.</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {images.map((img) => {
          const chosen = variant.image?.id === img.id
          return (
            <button
              key={img.id}
              type="button"
              disabled={busy}
              onClick={() => assign(img.id)}
              title={img.alt ?? ''}
              className={`relative h-11 w-11 overflow-hidden rounded-lg border transition-colors disabled:opacity-40 ${
                chosen ? 'border-a-ink' : 'border-a-line hover:border-a-focus'
              }`}
            >
              <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} width={44} height={44} />
              {chosen && (
                <span className="absolute inset-0 grid place-items-center bg-a-ink/45 text-white"><Check /></span>
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
        onChange={(e) => e.target.files?.[0] && uploadAndAssign(e.target.files[0])}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-a-line px-3 py-2 text-[13px] text-a-muted transition-colors hover:border-a-focus hover:text-a-ink disabled:opacity-40"
      >
        <Plus /> {busy ? 'Байршуулж байна…' : 'шинэ зураг'}
      </button>

      {variant.image && (
        <button
          type="button"
          disabled={busy}
          onClick={() => assign(null)}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-[12px] text-a-muted transition-colors hover:bg-a-hover hover:text-a-ink disabled:opacity-40"
        >
          зураг салгах
        </button>
      )}

      {error && <p className="mt-2 px-1 text-[12px] text-red-600">{error}</p>}
    </Popover>
  )
}
