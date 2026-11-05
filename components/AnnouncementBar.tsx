import Link from 'next/link'

export default function AnnouncementBar() {
  return (
    <div className="store-announcement">
      <span className="hidden sm:block">Шинэ улирлын цуглуулга ирлээ</span>
      <Link href="/shop?sort=newest">100,000₮-с дээш захиалгад 10% хөнгөлөлт</Link>
      <Link href="/shipping" className="hidden lg:block">Улаанбаатарт 1–2 хоногт хүргэнэ, 5,000₮</Link>
    </div>
  )
}
