'use client'

import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_DELETE_REVIEW, ADMIN_REVIEWS, ADMIN_SET_REVIEW_APPROVAL } from '@/lib/queries'
import { copy, formatDate, nodes } from '@/lib/format'
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/admin/ui'

export default function ReviewsPage() {
  const { data, loading, refetch } = useQuery(ADMIN_REVIEWS, { fetchPolicy: 'cache-and-network' })
  const reviews = nodes(data?.reviewCollection)
  const pending = reviews.filter((r) => !r.isApproved)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return (
    <>
      <PageHeader
        title="Сэтгэгдэл"
        description={`${pending.length} хүлээгдэж буй · зөвшөөрсний дараа л дэлгүүр дээр харагдана`}
      />

      {reviews.length === 0 ? (
        <EmptyState
          title="Сэтгэгдэл алга"
          body="Худалдан авалт хийсэн хэрэглэгч сэтгэгдэл үлдээх боломжтой."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => <ReviewCard key={r.id} review={r} onDone={refetch} />)}
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
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="tabular-nums text-[15px]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            <span className="font-medium text-a-ink">{title}</span>
            {review.isVerifiedPurchase && <Badge tone="green">баталгаажсан</Badge>}
            {review.isApproved ? <Badge tone="blue">нийтлэгдсэн</Badge> : <Badge tone="amber">хүлээгдэж буй</Badge>}
            <span className="text-[12px] text-a-muted">{formatDate(review.createdAt)}</span>
          </p>
          {review.title && <p className="mt-2 text-[13px] font-medium text-a-ink">{review.title}</p>}
          {review.body && <p className="mt-1 text-[13px] text-a-muted">{review.body}</p>}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            disabled={loading}
            variant={review.isApproved ? 'secondary' : 'primary'}
            onClick={async () => {
              await setApproval({ variables: { reviewId: review.id, approved: !review.isApproved } })
              onDone()
            }}
          >
            {review.isApproved ? 'Нуух' : 'Зөвшөөрөх'}
          </Button>
          <Button
            variant="danger"
            onClick={async () => { await remove({ variables: { reviewId: review.id } }); onDone() }}
          >
            Устгах
          </Button>
        </div>
      </div>
    </Card>
  )
}
