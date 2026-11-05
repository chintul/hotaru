'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_SET_CATEGORY_HERO_IMAGE, ADMIN_SET_CATEGORY_MOBILE_HERO_IMAGE } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import type { Category } from '@/lib/types'
import { Button } from '@/components/admin/ui'
import ProductImage from '@/components/ProductImage'
import { uploadProductImage } from '@/components/admin/product/uploadImage'

interface SetHeroVars {
  categoryId: string
  heroImagePath: string | null
}

interface SetMobileHeroVars {
  categoryId: string
  heroMobileImagePath: string | null
}

export const COVER_KIND = {
  wide: {
    label: 'Компьютерийн cover',
    hint: '3:1 харьцаатай өргөн зураг. Заавал биш: байхгүй бол компьютер дээр утасны cover-ыг бүтнээр нь, хажуу талыг нь бүдгэрүүлж харуулна.',
    aspect: 'aspect-[3/1] w-full max-w-90',
  },
  mobile: {
    label: 'Утасны cover',
    hint: '4:5 харьцаатай босоо зураг. Утас, босоо таблет дээр харагдана.',
    aspect: 'aspect-[4/5] w-28',
  },
} as const

export default function CoverField({ category, kind, onSaved }: {
  category: Pick<Category, 'slug' | 'heroImagePath' | 'heroMobileImagePath'> & { id: string }
  kind: keyof typeof COVER_KIND
  onSaved: () => Promise<unknown>
}) {
  const [setWide] = useMutation<unknown, SetHeroVars>(ADMIN_SET_CATEGORY_HERO_IMAGE)
  const [setMobile] = useMutation<unknown, SetMobileHeroVars>(ADMIN_SET_CATEGORY_MOBILE_HERO_IMAGE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const copy = COVER_KIND[kind]
  const current = kind === 'wide' ? category.heroImagePath : category.heroMobileImagePath

  const save = async (path: string | null) => {
    if (kind === 'wide') await setWide({ variables: { categoryId: category.id, heroImagePath: path } })
    else await setMobile({ variables: { categoryId: category.id, heroMobileImagePath: path } })
    await onSaved()
  }

  const upload = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const result = await uploadProductImage(file, `category-${category.slug}`)
      if (!result.filePath) throw new Error('Зураг бүртгэгдсэнгүй.')
      await save(result.filePath)
    } catch (e) {
      setError(errorMessage(e, 'Байршуулахад алдаа гарлаа.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = async () => {
    setError(null)
    setBusy(true)
    try { await save(null) } catch (e) { setError(errorMessage(e, 'Алдаа гарлаа.')) } finally { setBusy(false) }
  }

  return (
    <div className="col-span-full">
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">{copy.label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`relative block overflow-hidden rounded-md border border-a-line bg-a-hover ${copy.aspect}`}>
          {current ? (
            <ProductImage filePath={current} alt="" sizes="360px" />
          ) : (
            <span className="grid h-full place-items-center text-[12px] text-a-muted">Cover байхгүй</span>
          )}
        </span>
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file) }} />
          <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Байршуулж байна…' : current ? 'Солих' : 'Зураг оруулах'}
          </Button>
          {current && (
            <Button type="button" disabled={busy} onClick={() => void clear()}>Арилгах</Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-[12px] text-a-muted">{copy.hint}</p>
      {error && <p className="mt-1 text-[13px] text-danger-ink">{error}</p>}
    </div>
  )
}
