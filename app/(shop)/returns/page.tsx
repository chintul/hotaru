import type { Metadata } from 'next'
import Prose, { Block } from '../_components/Prose'
import { T } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Буцаалтын нөхцөл' }

export default function ReturnsPage() {
  return (
    <Prose
      title={<T mn="Буцаалтын нөхцөл" en="Returns policy" />}
      lead={<T mn="Захиалсан барааг буцаах, солих боломжгүй." en="Orders can't be returned or exchanged." />}
    >
      <Block heading={<T mn="Буцаалт, солилт" en="Returns & exchanges" />}>
        <p>
          <T
            mn="Бүх бараа буцаалтгүй. Хүлээн авсны дараа буцаах, солих, мөнгө буцаан олгох боломжгүй тул захиалахаасаа өмнө хэмжээ, өнгө, тайлбарыг сайтар шалгаарай."
            en="All sales are final. Once received, items can't be returned, exchanged or refunded, so please check the size, colour and description before you order."
          />
        </p>
      </Block>
      <Block heading={<T mn="Гэмтэлтэй ирсэн бол" en="If it arrives damaged" />}>
        <p>
          <T
            mn="Хүлээн авснаас хойш 48 цагийн дотор зургийн хамт бидэнд мэдэгдээрэй. Бид шалгаад ижил бараагаар сольж өгөх бөгөөд тээврийн зардлыг хариуцна."
            en="Tell us within 48 hours of receiving it, with a photo. We check it and replace the item, and we pay for the shipping."
          />
        </p>
      </Block>
      <Block heading={<T mn="Цуцлах, урьдчилгаа" en="Cancelling & deposits" />}>
        <p>
          <T
            mn="Төлбөр төлөхөөс өмнө захиалгаа цуцалж болно. Төлбөр төлсний дараа цуцлах, мөнгө буцаах боломжгүй. Урьдчилсан захиалгын урьдчилгаа буцаагдахгүй."
            en="You can cancel an order before you pay. Once paid, it can't be cancelled or refunded. Pre-order deposits are non-refundable."
          />
        </p>
      </Block>
    </Prose>
  )
}
