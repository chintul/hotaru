import type { Metadata } from 'next'
import Prose, { Block } from '../_components/Prose'
import { T } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Буцаалт, солилт' }

export default function ReturnsPage() {
  return (
    <Prose
      title={<T mn="Буцаалт, солилт" en="Returns & exchanges" />}
      lead={<T mn="Гэмтэлтэй бараа ирсэн бол бид 100% хариуцна." en="If an item arrives damaged, we cover it in full." />}
    >
      <Block heading={<T mn="Гэмтэлтэй бараа" en="Damaged items" />}>
        <p>
          <T
            mn="Хүлээн авснаас хойш 48 цагийн дотор мэдэгдэнэ үү. Зураг илгээвэл шийдвэрлэхэд хурдан байна. Тээвэрлэлтийн зардлыг бид хариуцна."
            en="Let us know within 48 hours of receiving it. Sending a photo helps us sort it out faster. We pay for the shipping."
          />
        </p>
      </Block>
      <Block heading={<T mn="Санаа таарахгүй байвал" en="If it's not quite right" />}>
        <p>
          <T
            mn="Хэрэглээгүй, савлагаа нь бүрэн бол 7 хоногийн дотор солих боломжтой. Буцаах тээврийн зардлыг худалдан авагч хариуцна."
            en="Unused items in full packaging can be exchanged within 7 days. Return shipping is paid by the buyer."
          />
        </p>
      </Block>
      <Block heading={<T mn="Мөнгө буцаалт" en="Refunds" />}>
        <p>
          <T
            mn="Захиалга илгээгдээгүй байхад цуцалбал төлсөн дүнг бүтэн буцаана. Төлсөн мөнгийг ажлын 1–3 хоногт таны данс руу буцаана."
            en="If you cancel before the order ships, we refund the full amount to your account within 1–3 working days."
          />
        </p>
      </Block>
    </Prose>
  )
}
