import type { Metadata } from 'next'
import Prose from '../_components/Prose'
import { T } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Түгээмэл асуулт' }

interface QA {
  q: readonly [mn: string, en: string]
  a: readonly [mn: string, en: string]
}

const QA: readonly QA[] = [
  {
    q: ['Хэрхэн төлбөр төлөх вэ?', 'How do I pay?'],
    a: [
      'Одоогоор дансаар шилжүүлж төлнө. Захиалга өгсний дараа дансны дугаар харагдана. Гүйлгээний утга дээр захиалгын дугаараа бичихээ мартуузай. Ингэснээр төлбөрийг тань хурдан баталгаажуулна.',
      'For now, by bank transfer. The account number appears after you place your order. Put your order number in the transfer note so we can confirm it quickly.',
    ],
  },
  {
    q: ['Төлбөр хэзээ баталгаажих вэ?', 'When is my payment confirmed?'],
    a: [
      'Бид дансаа шалгаж гараар баталгаажуулдаг тул ажлын цагаар ихэвчлэн нэг өдрийн дотор баталгаажна. Баталгаажмагц танд имэйл очно.',
      'We check our account and confirm by hand, so usually within one working day. You get an email as soon as it is confirmed.',
    ],
  },
  {
    q: ['Бүртгэлгүйгээр захиалж болох уу?', 'Can I order without an account?'],
    a: [
      'Үгүй. Захиалгаа хянах, төлбөрийн явцаа харахын тулд бүртгүүлэх шаардлагатай. Сагсанд байгаа бараа тань бүртгэлийн явцад хадгалагдана.',
      'No. You need an account so you can track your order and see its payment status. Your cart is kept while you sign up.',
    ],
  },
  {
    q: ['Барааны үлдэгдэл яаж шалгах вэ?', 'How do I check stock?'],
    a: [
      'Бүтээгдэхүүний хуудсан дээр сонголт бүрийн үлдэгдэл харагдана. Үлдэгдэл 3-аас цөөн бол тоог нь харуулна.',
      'The product page shows stock for every option. When fewer than 3 are left, it shows the exact number.',
    ],
  },
  {
    q: ['Урьдчилсан захиалга хэзээ ирэх вэ?', 'When does a pre-order arrive?'],
    a: [
      'Захиалга баталгаажсанаас хойш 10–14 хоногт ирнэ. Бараа ирмэгц бид мэдэгдэж, үлдэгдлийн нэхэмжлэл илгээнэ.',
      'It arrives 10–14 days after your order is confirmed. We let you know as soon as it does and send an invoice for the balance.',
    ],
  },
  {
    q: ['Буцааж, сольж болох уу?', 'Can I return or exchange?'],
    a: [
      'Үгүй. Захиалсан барааг буцаах, солих боломжгүй. Гэмтэлтэй ирсэн бол хүлээн авснаас хойш 48 цагийн дотор мэдэгдээрэй, бид сольж өгнө.',
      'No. Orders can’t be returned or exchanged. If something arrives damaged, tell us within 48 hours and we replace it.',
    ],
  },
  {
    q: ['Хүргэлт хэр хугацаанд ирэх вэ?', 'How long does delivery take?'],
    a: [
      'Улаанбаатар хотод ажлын 1–2 хоногт хүргэнэ. Орон нутагт унааны хуваариас хамаарна.',
      '1–2 working days in Ulaanbaatar. Outside the city it depends on the transport schedule.',
    ],
  },
  {
    q: ['Захиалгаа цуцалж болох уу?', 'Can I cancel my order?'],
    a: [
      'Төлбөр төлөхөөс өмнө захиалгын хуудаснаас цуцалж болно. Төлбөр төлсний дараа цуцлах, мөнгө буцаах боломжгүй.',
      'Yes, before you pay, from the order page. Once paid, orders can’t be cancelled or refunded.',
    ],
  },
]

export default function FaqPage() {
  return (
    <Prose title={<T mn="Түгээмэл асуулт" en="Frequently asked questions" />}>
      <div className="divide-y divide-line border-y border-line">
        {QA.map(({ q, a }) => (
          <details key={q[0]} className="group py-2 sm:py-4">
            <summary className="cursor-pointer list-none text-[14px] font-semibold text-ink marker:hidden">
              <span className="flex min-h-9 items-center justify-between gap-4 sm:min-h-0">
                <T mn={q[0]} en={q[1]} />
                <span className="text-ink-faint transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-2.5 pr-8"><T mn={a[0]} en={a[1]} /></p>
          </details>
        ))}
      </div>
    </Prose>
  )
}
