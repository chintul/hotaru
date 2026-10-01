'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_BULK_DELETE_REVIEWS, ADMIN_BULK_SET_REVIEW_APPROVAL,
  ADMIN_DELETE_REVIEW, ADMIN_REVIEWS, ADMIN_SET_REVIEW_APPROVAL,
} from '@/lib/queries'
import { copy, formatDate, nodes } from '@/lib/format'
import type { Connection, Review } from '@/lib/types'
import { BulkBar, Button, Card, EmptyState, PageHeader, Status, type BulkAction } from '@/components/admin/ui'
import { SelectCell, useSelection } from '@/components/admin/selection'
import { errorMessage } from '@/lib/errors'

type ReviewFilter = 'pending' | 'all'

interface ReviewsData {
  reviewCollection: Connection<Review> | null
}

export default function ReviewsPage() {
  const { data, loading, refetch } = useQuery<ReviewsData>(ADMIN_REVIEWS, { fetchPolicy: 'cache-and-network' })
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const all = nodes(data?.reviewCollection)
  const pending = all.filter((r) => !r.isApproved)
  const shown = filter === 'pending' ? pending : all

  const sel = useSelection(shown)
  const [bulkApproval] = useMutation<unknown, { reviewIds: string[]; approved: boolean }>(ADMIN_BULK_SET_REVIEW_APPROVAL)
  const [bulkDelete] = useMutation<unknown, { reviewIds: string[] }>(ADMIN_BULK_DELETE_REVIEWS)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const n = sel.count

  const run = async (confirmText: string, fn: (ids: string[]) => Promise<unknown>) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    const ids = sel.ids
    try {
      await fn(ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(errorMessage(e, 'Үйлдэл амжилтгүй боллоо.'))
    }
  }

  const bulkActions: BulkAction[] = [
    { key: 'approve', label: 'Зөвшөөрөх',
      run: () => run(`${n} сэтгэгдлийг нийтлэх үү?`,
        (ids) => bulkApproval({ variables: { reviewIds: ids, approved: true } })) },
    { key: 'hide', label: 'Нуух',
      run: () => run(`${n} сэтгэгдлийг нуух уу?`,
        (ids) => bulkApproval({ variables: { reviewIds: ids, approved: false } })) },
    { key: 'delete', label: 'Устгах', tone: 'danger', separatorBefore: true,
      run: () => run(`${n} сэтгэгдлийг устгах уу? Буцаах боломжгүй.`,
        (ids) => bulkDelete({ variables: { reviewIds: ids } })) },
  ]

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return (
    <>
      <PageHeader
        title="Сэтгэгдэл"
        subtitle="Зөвшөөрсний дараа л дэлгүүр дээр харагдана."
        actions={
          <>
            <Button variant={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>
              Хүлээгдэж буй{pending.length ? ` (${pending.length})` : ''}
            </Button>
            <Button variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>
              Бүгд ({all.length})
            </Button>
          </>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'Хүлээгдэж буй сэтгэгдэл алга' : 'Сэтгэгдэл алга'}
          body="Худалдан авалт хийсэн хэрэглэгч сэтгэгдэл үлдээх боломжтой."
        />
      ) : (
        <>
          {bulkError && (
            <p className="mb-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-2.5 text-[13px] text-danger-ink">
              {bulkError}
            </p>
          )}

          {sel.count > 0 && (
            <div className="mb-3 overflow-hidden rounded-xl border border-a-line bg-a-surface">
              <BulkBar count={sel.count} actions={bulkActions} onClear={sel.clear} />
            </div>
          )}

          <div className="space-y-3">
            {shown.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                selected={sel.isSelected(r)}
                onToggle={() => sel.toggleRow(r)}
                onDone={refetch}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}

interface ReviewCardProps {
  review: Review
  selected: boolean
  onToggle: () => void
  onDone: () => unknown
}

const MAX_RATING = 5

function ReviewCard({ review, selected, onToggle, onDone }: ReviewCardProps) {
  const [setApproval, { loading }] = useMutation<unknown, { reviewId: string; approved: boolean }>(ADMIN_SET_REVIEW_APPROVAL)
  const [remove, { loading: removing }] = useMutation<unknown, { reviewId: string }>(ADMIN_DELETE_REVIEW)
  const [error, setError] = useState<string | null>(null)
  const title = copy(review.product).title ?? review.product?.slug

  const toggleApproval = async () => {
    setError(null)
    try {
      await setApproval({ variables: { reviewId: review.id, approved: !review.isApproved } })
      onDone()
    } catch (e) { setError(errorMessage(e, 'Алдаа гарлаа.')) }
  }

  const deleteOne = async () => {
    if (!window.confirm('Энэ сэтгэгдлийг устгах уу? Буцаах боломжгүй.')) return
    setError(null)
    try {
      await remove({ variables: { reviewId: review.id } })
      onDone()
    } catch (e) { setError(errorMessage(e, 'Устгаж чадсангүй.')) }
  }

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <SelectCell checked={selected} onChange={onToggle} />
          <span className="tabular-nums text-[15px]">{'★'.repeat(review.rating)}{'☆'.repeat(MAX_RATING - review.rating)}</span>
          <span>{title}</span>
        </span>
      }
      subtitle={formatDate(review.createdAt)}
      actions={
        <>
          {review.isVerifiedPurchase && <Status tone="green">баталгаажсан</Status>}
          <Status tone={review.isApproved ? 'blue' : 'amber'}>
            {review.isApproved ? 'нийтлэгдсэн' : 'хүлээгдэж буй'}
          </Status>
        </>
      }
    >
      {review.title && <p className="text-[13px] font-medium text-a-ink">{review.title}</p>}
      {review.body && <p className="mt-1 text-[13px] text-a-muted">{review.body}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant={review.isApproved ? 'secondary' : 'primary'}
          disabled={loading}
          onClick={toggleApproval}
        >
          {review.isApproved ? 'Нуух' : 'Зөвшөөрөх'}
        </Button>
        <Button
          variant="danger"
          disabled={removing}
          onClick={deleteOne}
        >
          {removing ? 'Устгаж байна…' : 'Устгах'}
        </Button>
        {error && <span className="text-[13px] text-danger-ink">{error}</span>}
      </div>
    </Card>
  )
}
