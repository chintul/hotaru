import Link from 'next/link'
import { T } from '@/lib/i18n'

export default function AnnouncementBar() {
  return (
    <div className="store-announcement">
      <span className="hidden sm:block"><T mn="Шинэ улирлын цуглуулга ирлээ" en="The new season collection is here" /></span>
      <Link href="/shop?sort=newest"><T mn="100,000₮-өөс дээш захиалгад 10% хөнгөлөлт" en="10% off orders over 100,000₮" /></Link>
      <Link href="/shipping" className="hidden lg:block"><T mn="Улаанбаатарт 1–2 хоногт хүргэнэ, 5,000₮" en="Delivered in Ulaanbaatar in 1–2 days, 5,000₮" /></Link>
    </div>
  )
}
