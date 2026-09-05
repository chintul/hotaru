'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import {
  ADMIN_ADD_IMAGE,
  ADMIN_DELETE_IMAGE,
  ADMIN_PRODUCT_IMAGES,
  ADMIN_REORDER_IMAGES,
} from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductImage from './ProductImage'

/**
 * Upload and order the images for one product.
 *
 * Two-step by necessity: the browser uploads straight to ImageKit using a
 * signature minted server-side (the private key never reaches the client), then
 * records the resulting fileId + filePath in Postgres through an admin
 * function. If the second step fails the asset is orphaned at ImageKit rather
 * than the row pointing at nothing — the recoverable direction.
 */
export default function ProductImageManager({ product }) {
  const images = nodes(product.productImageCollection)
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refetch = [{ query: ADMIN_PRODUCT_IMAGES }]
  const [addImage] = useMutation(ADMIN_ADD_IMAGE, { refetchQueries: refetch })
  const [deleteImage] = useMutation(ADMIN_DELETE_IMAGE, { refetchQueries: refetch })
  const [reorder] = useMutation(ADMIN_REORDER_IMAGES, { refetchQueries: refetch })

  const onFiles = async (files) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const authRes = await fetch('/api/upload-auth')
        if (!authRes.ok) {
          throw new Error(
            authRes.status === 403 ? 'Админ эрх шаардлагатай.' : 'Байршуулах эрх авахад алдаа гарлаа.',
          )
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

        await addImage({
          variables: {
            productId: product.id,
            imagekitFileId: result.fileId,
            filePath: result.filePath,
            alt: null,
            width: result.width ?? null,
            height: result.height ?? null,
          },
        })
      }
    } catch (e) {
      setError(e?.message ?? 'Байршуулахад алдаа гарлаа.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const move = async (index, delta) => {
    const next = [...images]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await reorder({ variables: { productId: product.id, imageIds: next.map((i) => i.id) } })
  }

  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="label text-ink-faint">
          Зураг ({images.length}) — эхнийх нь карт, хоёр дахь нь hover
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length && onFiles(Array.from(e.target.files))}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="label ml-auto border border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          {busy ? 'Байршуулж байна…' : 'Зураг нэмэх'}
        </button>
      </div>

      {error && <p className="mt-3 text-sale">{error}</p>}

      {images.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li key={img.id} className="w-28">
              <div className="relative aspect-[3/4] overflow-hidden bg-paper-warm">
                <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="112px" />
                <span className="label absolute left-1 top-1 bg-paper/90 px-1.5">
                  {i === 0 ? 'карт' : i === 1 ? 'hover' : i}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="label text-ink-soft disabled:opacity-25" aria-label="Урагш">←</button>
                <button onClick={() => move(i, 1)} disabled={i === images.length - 1}
                  className="label text-ink-soft disabled:opacity-25" aria-label="Хойш">→</button>
                <button
                  onClick={() => deleteImage({ variables: { imageId: img.id } })}
                  className="label ml-auto text-ink-faint hover:text-sale"
                >
                  Устгах
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
