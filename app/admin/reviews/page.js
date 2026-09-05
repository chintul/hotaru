'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_DELETE_REVIEW, ADMIN_REVIEWS, ADMIN_SET_REVIEW_APPROVAL } from '@/lib/queries'
import { copy, formatDate, nodes } from '@/lib/format'
import { Button, Card, EmptyState, PageHeader, Status } from '@/components/admin/ui'

export default function ReviewsPage() {
  const { data, loading, refetch } = useQuery(ADMIN_REVIEWS, { fetchPolicy: 'cache-and-network' })
  const [filter, setFilter] = useState('pending')
  const all = nodes(data?.reviewCollection)
  const pending = all.filter((r) => !r.isApproved)
  const shown = filter === 'pending' ? pending : all

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
        <div className="space-y-3">
          {shown.map((r) => <ReviewCard key={r.id} review={r} onDone={refetch} />)}
        </div>
      )}
    </>
  )
}

function ReviewCard({ review, onDone }) {
  const [setApproval, { loading }] = useMutation(ADMIN_SET_REVIEW_APPROVAL)
  const [remove] = useMutation(ADMIN_DELETE_REVIEW)
  const title = copy(review.product).title ?? review.product?.slug

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums text-[15px]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
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

      <div className="mt-4 flex gap-2">
        <Button
          variant={review.isApproved ? 'secondary' : 'primary'}
          disabled={loading}
          onClick={async () => {
            await setApproval({ variables: { reviewId: review.id, approved: !review.isApproved } })
            onDone()
          }}
        >
          {review.isApproved ? 'Нуух' : 'Зөвшөөрөх'}
        </Button>
        <Button variant="danger"
          onClick={async () => { await remove({ variables: { reviewId: review.id } }); onDone() }}>
          Устгах
        </Button>
      </div>
    </Card>
  )
}
