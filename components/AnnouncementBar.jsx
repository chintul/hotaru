const MESSAGES = [
  '🚚 Улаанбаатар доторх хүргэлт 5,000₮',
  '✨ Шинэ цуглуулга: 2026 Намар',
  '🎁 100,000₮-с дээш захиалгад 10% хөнгөлөлт',
  '📦 Ажлын 1–2 хоногт хүргэнэ',
]

/**
 * Scrolling announcement strip above the header.
 * The message list is rendered twice so the -50% translate loops seamlessly;
 * hovering pauses it, which is the only way to actually read a moving line.
 */
export default function AnnouncementBar() {
  const track = [...MESSAGES, ...MESSAGES]
  return (
    <div className="overflow-hidden border-b border-line bg-shade py-2.5">
      <div className="marquee-track">
        {track.map((m, i) => (
          <span key={i} className="whitespace-nowrap px-8 text-[13px] text-ink">
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
