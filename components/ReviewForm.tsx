'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { MY_PRODUCT_REVIEW, SUBMIT_REVIEW } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import type { Connection, Review } from '@/lib/types'
import { useSession } from './useSession'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface MyProductReviewData {
  reviewCollection: Connection<Review> | null
}

interface MyProductReviewVars {
  productId: string
  profileId?: string
}

interface SubmitReviewData {
  submitReview: Review | null
}

interface SubmitReviewVars {
  productId: string
  rating: number
  title: string | null
  body: string | null
}

interface ReviewDraft {
  rating: number
  title: string
  body: string
}

interface ReviewFormProps {
  productId: string
  slug: string
}

const STAR_VALUES = [1, 2, 3, 4, 5]
const MAX_STARS = 5

export default function ReviewForm({ productId, slug }: ReviewFormProps) {
  const { isAuthenticated, ready, user } = useSession()

  const { data, refetch } = useQuery<MyProductReviewData, MyProductReviewVars>(MY_PRODUCT_REVIEW, {
    variables: { productId, profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })
  const [submitReview, { loading }] = useMutation<SubmitReviewData, SubmitReviewVars>(SUBMIT_REVIEW)

  const mine = firstNode(data?.reviewCollection)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [editing, setEditing] = useState(false)
  const [justSent, setJustSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedReview: ReviewDraft = {
    rating: mine?.rating ?? 0,
    title: mine?.title ?? '',
    body: mine?.body ?? '',
  }
  const value = draft ?? savedReview
  const set = (patch: Partial<ReviewDraft>) => setDraft({ ...value, ...patch })
  const unrated = value.rating === 0

  if (!ready) return null

  if (!isAuthenticated) {
    return (
      <Shell>
        <p className="text-[14px] text-ink-soft">
          Сэтгэгдэл бичихийн тулд нэвтэрнэ үү.
        </p>
        <Link href={`/login?next=/shop/${slug}`} className="label link-underline mt-3 inline-block">
          Нэвтрэх
        </Link>
      </Shell>
    )
  }

  if (mine && !editing && !justSent) {
    return (
      <Shell>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars value={mine.rating} />
          <span className="text-[13px] text-ink-soft">
            {mine.isApproved ? 'Таны сэтгэгдэл нийтлэгдсэн.' : 'Таны сэтгэгдэл хянагдаж байна.'}
          </span>
        </div>
        {mine.title && <p className="mt-2 font-medium">{mine.title}</p>}
        {mine.body && <p className="mt-1 text-[14px] text-ink-soft">{mine.body}</p>}
        <button
          onClick={() => { setEditing(true); setDraft(null) }}
          className="label link-underline mt-4 inline-block"
        >
          Засах
        </button>
      </Shell>
    )
  }

  if (justSent) {
    return (
      <Shell>
        <p className="text-[14px]">Баярлалаа! 🎀</p>
        <p className="mt-1 text-[14px] text-ink-soft">
          Сэтгэгдлийг чинь хянаад нийтэлнэ.
        </p>
        <button
          onClick={() => { setJustSent(false); setEditing(true); setDraft(null) }}
          className="label link-underline mt-4 inline-block"
        >
          Засах
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          try {
            await submitReview({
              variables: {
                productId,
                rating: value.rating,
                title: value.title.trim() || null,
                body: value.body.trim() || null,
              },
            })
            setEditing(false)
            setJustSent(true)
            setDraft(null)
            refetch()
          } catch (err) {
            setError(errorMessage(err, 'Илгээж чадсангүй. Дахин оролдоно уу.'))
          }
        }}
      >
        <fieldset>
          <legend className="label text-ink-faint">Үнэлгээ</legend>
          <div role="radiogroup" aria-label="Үнэлгээ" className="mt-2 flex gap-1">
            {STAR_VALUES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value.rating === n}
                aria-label={`${n} од`}
                onClick={() => set({ rating: n })}
                className={`text-[26px] leading-none transition-colors ${
                  n <= value.rating ? 'text-ink' : 'text-line hover:text-ink-faint'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-5 block">
          <span className="label text-ink-faint">Гарчиг (заавал биш)</span>
          <Input
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={120}
            className="mt-2 h-10 rounded-none border-0 border-b px-0 text-[14px] md:text-[14px]"
          />
        </label>

        <label className="mt-4 block">
          <span className="label text-ink-faint">Сэтгэгдэл (заавал биш)</span>
          <Textarea
            value={value.body}
            onChange={(e) => set({ body: e.target.value })}
            rows={4}
            maxLength={2000}
            className="mt-2 min-h-28 resize-y rounded-none p-3 text-[14px] md:text-[14px]"
          />
        </label>

        {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="line" size="touch" disabled={loading || unrated}>
            {loading ? 'Илгээж байна…' : mine ? 'Хадгалах' : 'Илгээх'}
          </Button>
          {mine && (
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(null); setError(null) }}
              className="label link-underline text-ink-faint"
            >
              Болих
            </button>
          )}
          {unrated && (
            <span className="text-[13px] text-ink-faint">Од сонгоно уу</span>
          )}
        </div>

        <p className="mt-4 text-[12px] text-ink-faint">
          Сэтгэгдэл хянагдсаны дараа нийтлэгдэнэ.
          {mine?.isVerifiedPurchase && ' Таны худалдан авалт баталгаажсан.'}
        </p>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line p-6 sm:p-7">
      <p className="label">Сэтгэгдэл бичих</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="tabular-nums" aria-label={`5-аас ${value}`} role="img">
      <span aria-hidden>{'★'.repeat(value)}{'☆'.repeat(MAX_STARS - value)}</span>
    </span>
  )
}
