import Prose, { Block } from '../_components/Prose'

export const metadata = { title: 'Бидний тухай' }

export default function AboutPage() {
  return (
    <Prose title="Бидний тухай" lead="Өдөр тутмын хэрэглээнд зориулсан, сайн бүтээгдсэн зүйлс.">
      <Block heading="Юу хийдэг вэ">
        <p>
          hotaru нь өдөр бүр хэрэглэдэг зүйлсийг — цүнх, аяга сав, жижиг хэрэглэл —
          удаан эдэлгээтэй, энгийн хэлбэртэй байхаар сонгож нийлүүлдэг.
        </p>
      </Block>
      <Block heading="Хэрхэн сонгодог вэ">
        <p>
          Бүтээгдэхүүн бүрийг материал, эдэлгээ, өдөр тутмын хэрэглээнд тохиромжтой эсэхээр нь
          шалгаж авдаг. Их тоогоор биш, цөөн ч чанартайг эрхэмлэдэг.
        </p>
      </Block>
      <Block heading="Холбоо барих">
        <p>
          Асуулт, санал байвал <a href="/contact" className="link-underline text-ink">холбоо барих</a> хуудсаар
          дамжуулан бидэнд бичнэ үү.
        </p>
      </Block>
    </Prose>
  )
}
