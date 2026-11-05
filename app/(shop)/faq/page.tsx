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
      'Одоогоор дансаар шилжүүлж төлнө. Захиалга өгсний дараа дансны дугаар харагдана. Гүйлгээний утга дээр захиалгын дугаараа бичихээ мартуузай — тэгснээр төлбөрийг хурдан баталгаажуулна.',
      'For now, by bank transfer. The account number appears after you place your order. Put your order number in the transfer note so we can confirm it quickly.',
    ],
  },
  {
    q: ['Төлбөр хэзээ баталгаажих вэ?', 'When is my payment confirmed?'],
    a: [
      'Дансаа шалгаад гараар баталгаажуулдаг тул ажлын цагт ихэвчлэн нэг өдрийн дотор. Баталгаажмагц танд имэйл очно.',
      'We check our account and confirm by hand, so usually within one working day. You get an email as soon as it is confirmed.',
    ],
  },
  {
    q: ['Бүртгэлгүйгээр захиалж болох уу?', 'Can I order without an account?'],
    a: [
      'Үгүй. Захиалгаа хянах, төлбөрийн явцыг харах боломжтой байхын тулд имэйлээр бүртгүүлэх шаардлагатай. Сагсанд байгаа бараа бүртгэлийн явцад хадгалагдана.',
      'No. You need an account so you can track your order and see its payment status. Your cart is kept while you sign up.',
    ],
  },
  {
    q: ['Барааны үлдэгдэл яаж шалгах вэ?', 'How do I check stock?'],
    a: [
      'Бүтээгдэхүүний хуудсан дээр сонголт бүрийн үлдэгдэл харагдана. Үлдэгдэл 3-аас цөөн бол тоо нь тодорхой харуулна.',
      'The product page shows stock for every option. When fewer than 3 are left, it shows the exact number.',
    ],
  },
  {
    q: ['Хүргэлт хэр хугацаанд ирэх вэ?', 'How long does delivery take?'],
    a: [
      'Улаанбаатар хотод ажлын 1–2 хоног. Орон нутагт унааны хуваарь дагана.',
      '1–2 working days in Ulaanbaatar. Outside the city it depends on the transport schedule.',
    ],
  },
  {
    q: ['Захиалгаа цуцалж болох уу?', 'Can I cancel my order?'],
    a: [
      'Илгээгдээгүй байхад цуцалж болно. Захиалгын хуудаснаас цуцлах эсвэл бидэнтэй холбогдоно уу.',
      'Yes, as long as it has not shipped. Cancel from the order page or get in touch with us.',
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
