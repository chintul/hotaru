'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { MY_PRODUCT_REVIEW, SUBMIT_REVIEW } from '@/lib/queries'
import { firstNode } from '@/lib/format'
import { useSession } from './useSession'

/**
 * Write or edit a review.
 *
 * submit_review() upserts on (product_id, profile_id), so a second submission
 * edits the first rather than failing on the unique constraint — and clears the
 * approval, because edited copy has to be moderated again. The form mirrors
 * that: one customer, one review, always editable.
 *
 * Anonymous cart identities are refused by the function (42501), which is the
 * same line useSession draws, so the signed-out branch below never produces a
 * request the database would reject.
 */
export default function ReviewForm({ productId, slug }) {
  const { isAuthenticated, ready, user } = useSession()

  const { data, refetch } = useQuery(MY_PRODUCT_REVIEW, {
    variables: { productId, profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })
  const [submitReview, { loading }] = useMutation(SUBMIT_REVIEW)

  const mine = firstNode(data?.reviewCollection)
  const [draft, setDraft] = useState(null)   // null until the customer touches it
  const [editing, setEditing] = useState(false)
  const [justSent, setJustSent] = useState(false)
  const [error, setError] = useState(null)

  // Derived rather than copied into state by an effect: the saved review
  // arrives after first paint, and seeding state from it in an effect would
  // both trip the repo's lint rule and clobber anything typed in between.
  const value = draft ?? {
    rating: mine?.rating ?? 0,
    title: mine?.title ?? '',
    body: mine?.body ?? '',
  }
  const set = (patch) => setDraft({ ...value, ...patch })

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

  // Saved and not being edited: say where it stands instead of showing an empty
  // form that looks like nothing was ever submitted.
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
            setError(err?.message ?? 'Илгээж чадсангүй. Дахин оролдоно уу.')
          }
        }}
      >
        <fieldset>
          <legend className="label text-ink-faint">Үнэлгээ</legend>
          <div role="radiogroup" aria-label="Үнэлгээ" className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
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
          <input
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={120}
            className="mt-2 w-full border-b border-line bg-transparent py-2 text-[14px] outline-none transition-colors focus:border-ink"
          />
        </label>

        <label className="mt-4 block">
          <span className="label text-ink-faint">Сэтгэгдэл (заавал биш)</span>
          <textarea
            value={value.body}
            onChange={(e) => set({ body: e.target.value })}
            rows={4}
            maxLength={2000}
            className="mt-2 w-full resize-y border border-line bg-transparent p-3 text-[14px] outline-none transition-colors focus:border-ink"
          />
        </label>

        {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* rating is `check (rating between 1 and 5)`, so submitting 0 would
              be refused by Postgres — stop it here instead. */}
          <button type="submit" disabled={loading || value.rating === 0} className="btn-outline px-6 py-3">
            {loading ? 'Илгээж байна…' : mine ? 'Хадгалах' : 'Илгээх'}
          </button>
          {mine && (
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(null); setError(null) }}
              className="label link-underline text-ink-faint"
            >
              Болих
            </button>
          )}
          {value.rating === 0 && (
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

function Shell({ children }) {
  return (
    <div className="border border-line p-6 sm:p-7">
      <p className="label">Сэтгэгдэл бичих</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function Stars({ value }) {
  return (
    <span className="tabular-nums" aria-label={`5-аас ${value}`} role="img">
      <span aria-hidden>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>
    </span>
  )
}
