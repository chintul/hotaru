const MESSAGES = [
  '🚚 Улаанбаатар доторх хүргэлт 5,000₮',
  '✨ Шинэ цуглуулга: 2026 Намар',
  '🎁 100,000₮-с дээш захиалгад 10% хөнгөлөлт',
  '📦 Ажлын 1–2 хоногт хүргэнэ',
]

const LOOPED_MESSAGES = [...MESSAGES, ...MESSAGES]

export default function AnnouncementBar() {
  return (
    <div className="overflow-hidden border-b border-line bg-shade py-2.5">
      <div className="marquee-track">
        {LOOPED_MESSAGES.map((message, i) => (
          <span key={i} className="whitespace-nowrap px-8 text-[13px] text-ink">
            {message}
          </span>
        ))}
      </div>
    </div>
  )
}
