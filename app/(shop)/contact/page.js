import Prose, { Block } from '../_components/Prose'

export const metadata = { title: 'Холбоо барих' }

export default function ContactPage() {
  return (
    <Prose title="Холбоо барих" lead="Ажлын өдрүүдэд 1 ажлын өдрийн дотор хариу өгнө.">
      <Block heading="Захиалгын талаар">
        <p>
          Захиалгын дугаараа бэлдээд бичнэ үү — <a href="/orders" className="link-underline text-ink">миний захиалга</a>{' '}
          хуудсанд байгаа. Төлбөр баталгаажаагүй байвал захиалгын хуудсан дээрх дансны мэдээллийг
          дахин шалгана уу.
        </p>
      </Block>
      <Block heading="Бөөний захиалга">
        <p>Хамтран ажиллах, бөөний захиалгын саналыг имэйлээр хүлээн авна.</p>
      </Block>
      <Block heading="Хаяг">
        <p>Улаанбаатар, Монгол Улс</p>
      </Block>
    </Prose>
  )
}
