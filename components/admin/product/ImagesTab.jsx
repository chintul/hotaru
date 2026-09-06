'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import { ADMIN_ADD_IMAGE, ADMIN_DELETE_IMAGE, ADMIN_REORDER_IMAGES } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductImage from '@/components/ProductImage'
import { Button, Card } from '@/components/admin/ui'

/**
 * Upload and order one product's images.
 *
 * Two-step by necessity: the browser uploads straight to ImageKit using a
 * signature minted server-side (the private key never reaches the client),
 * then records fileId + filePath in Postgres. If the second step fails the
 * asset is orphaned at ImageKit rather than the row pointing at nothing — the
 * recoverable direction.
 */
export default function ImagesTab({ product, refetch }) {
  const images = nodes(product.productImageCollection)
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const [addImage] = useMutation(ADMIN_ADD_IMAGE)
  const [deleteImage] = useMutation(ADMIN_DELETE_IMAGE)
  const [reorder] = useMutation(ADMIN_REORDER_IMAGES)

  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  const onFiles = async (files) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
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

        await addImage({ variables: {
          productId: product.id,
          imagekitFileId: result.fileId,
          filePath: result.filePath,
          alt: null,
          width: result.width ?? null,
          height: result.height ?? null,
        } })
      }
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Байршуулахад алдаа гарлаа.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const applyOrder = async (next) => {
    await reorder({ variables: { productId: product.id, imageIds: next.map((i) => i.id) } })
    await refetch()
  }

  const move = async (index, delta) => {
    const next = [...images]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await applyOrder(next)
  }

  const makePrimary = async (index) => {
    if (index === 0) return
    const next = [...images]
    const [picked] = next.splice(index, 1)
    await applyOrder([picked, ...next])
  }

  return (
    <Card
      title="Зураг"
      subtitle="Эхний зураг карт дээр, хоёр дахь нь hover дээр гарна."
      actions={
        <Button variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Байршуулж байна…' : 'Зураг нэмэх'}
        </Button>
      }
    >
      {!configured && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          ImageKit тохируулагдаагүй байна — .env.local доторх түлхүүрүүдийг шалгана уу.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && onFiles(Array.from(e.target.files))}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files ?? []).filter((file) => file.type.startsWith('image/'))
          if (files.length) onFiles(files)
        }}
        className={`rounded-lg border-2 border-dashed px-4 py-8 text-center text-[13px] transition-colors ${
          dragging ? 'border-a-focus bg-blue-50 text-a-ink' : 'border-a-line text-a-muted'
        }`}
      >
        Зургаа энд чирж оруулна уу
      </div>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      {images.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li key={img.id} className="w-28">
              <div className="relative aspect-square overflow-hidden rounded-md bg-a-hover">
                <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="112px" />
                <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 text-[11px] font-medium">
                  {i === 0 ? 'карт' : i === 1 ? 'hover' : i}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-[13px] text-a-muted disabled:opacity-25"
                  aria-label="Урагш"
                >
                  ←
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  className="text-[13px] text-a-muted disabled:opacity-25"
                  aria-label="Хойш"
                >
                  →
                </button>
                <button
                  onClick={async () => {
                    await deleteImage({ variables: { imageId: img.id } })
                    await refetch()
                  }}
                  className="ml-auto text-[12px] text-a-muted hover:text-red-600"
                >
                  Устгах
                </button>
              </div>
              {i !== 0 && (
                <button
                  onClick={() => makePrimary(i)}
                  className="mt-1 w-full text-[12px] text-a-muted hover:text-a-ink"
                >
                  Үндсэн болгох
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
