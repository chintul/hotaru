import type { Metadata } from 'next'
import Prose, { Block } from '../_components/Prose'
import { paymentCopy } from '@/lib/payment-copy'
import { T } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Хүргэлтийн нөхцөл' }

export default async function ShippingPage() {
  const pay = await paymentCopy()
  return (
    <Prose
      title={<T mn="Хүргэлт" en="Delivery" />}
      lead={<T mn="Улаанбаатар хотод ажлын 1–2 хоногт хүргэнэ." en="Delivered in Ulaanbaatar in 1–2 working days." />}
    >
      <Block heading={<T mn="Хүргэлтийн төрөл" en="Delivery options" />}>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <T
              mn={<><strong className="text-ink">Улаанбаатар хот доторх хүргэлт</strong> — 5,000₮, ажлын 1–2 хоног</>}
              en={<><strong className="text-ink">Within Ulaanbaatar</strong>: 5,000₮, 1–2 working days</>}
            />
          </li>
          <li>
            <T
              mn={<><strong className="text-ink">Дэлгүүрээс өөрөө авах</strong> — үнэгүй, урьдчилан утсаар холбогдоно</>}
              en={<><strong className="text-ink">Pick up from the store</strong>: free, call ahead first</>}
            />
          </li>
          <li>
            <T
              mn={<><strong className="text-ink">Орон нутгийн хүргэлт</strong> — 15,000₮, унаанд тавьж илгээнэ</>}
              en={<><strong className="text-ink">Outside Ulaanbaatar</strong>: 15,000₮, sent by intercity transport</>}
            />
          </li>
        </ul>
      </Block>
      <Block heading={<T mn="Хэзээ илгээх вэ" en="When we ship" />}>
        <p>
          {pay.qpay ? (
            <T
              mn="Төлбөр баталгаажсаны дараа бэлтгэж эхэлнэ. QPay-аар төлсөн төлбөр шууд, дансаар шилжүүлсэн төлбөр ажлын цагт ихэвчлэн нэг өдрийн дотор баталгаажна."
              en="We start packing once your payment is confirmed. QPay payments are confirmed straight away; bank transfers usually within one working day."
            />
          ) : (
            <T
              mn="Төлбөр баталгаажсаны дараа бэлтгэж эхэлнэ. Дансаар шилжүүлсэн төлбөр ажлын цагт ихэвчлэн нэг өдрийн дотор баталгаажна."
              en="We start packing once your payment is confirmed. Bank transfers are usually confirmed within one working day."
            />
          )}
        </p>
      </Block>
      <Block heading={<T mn="Хаяг" en="Address" />}>
        <p>
          <T
            mn="Хүргэлтийн хаягаа дүүрэг, хороо, байр, орц, тоот хүртэл бүрэн бичнэ үү. Жолооч холбогдох тул утасны дугаараа зөв оруулах нь чухал."
            en="Write your full address, down to the district, khoroo, building, entrance and apartment. The driver will call you, so make sure your phone number is right."
          />
        </p>
      </Block>
    </Prose>
  )
}
