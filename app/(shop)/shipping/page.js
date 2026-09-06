import Prose, { Block } from '../_components/Prose'
import { paymentCopy } from '@/lib/payment-copy'

export const metadata = { title: 'Хүргэлтийн нөхцөл' }

export default async function ShippingPage() {
  const pay = await paymentCopy()
  return (
    <Prose title="Хүргэлт" lead="Улаанбаатар хотод ажлын 1–2 хоногт хүргэнэ.">
      <Block heading="Хүргэлтийн төрөл">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-ink">Улаанбаатар хот доторх хүргэлт</strong> — 5,000₮, ажлын 1–2 хоног</li>
          <li><strong className="text-ink">Дэлгүүрээс өөрөө авах</strong> — үнэгүй, урьдчилан утсаар холбогдоно</li>
          <li><strong className="text-ink">Орон нутгийн хүргэлт</strong> — 15,000₮, унаанд тавьж илгээнэ</li>
        </ul>
      </Block>
      <Block heading="Хэзээ илгээх вэ">
        <p>
          Төлбөр баталгаажсаны дараа бэлтгэж эхэлнэ.{' '}
          {pay.qpay
            ? 'QPay QR-аар төлсөн төлбөр шууд, дансаар шилжүүлсэн төлбөр ажлын цагт ихэвчлэн нэг өдрийн дотор баталгаажна.'
            : 'Дансаар шилжүүлсэн төлбөр ажлын цагт ихэвчлэн нэг өдрийн дотор баталгаажна.'}
        </p>
      </Block>
      <Block heading="Хаяг">
        <p>
          Хүргэлтийн хаягаа дүүрэг, хороо, байр, орц, тоот хүртэл бүрэн бичнэ үү. Жолооч
          холбогдох тул утасны дугаараа зөв оруулах нь чухал.
        </p>
      </Block>
    </Prose>
  )
}
