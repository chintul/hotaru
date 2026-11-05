'use client'

import Link from 'next/link'
import SiteMascot from '@/components/SiteMascot'
import { useLang } from '@/lib/i18n'

const TINTS = ['bg-note-soft', 'bg-blush', 'bg-cream'] as const

const COPY = {
  mn: {
    heroTitle: 'Өдөр бүрийг гэрэлтүүлэх жижигхэн зүйлс',
    heroLead: 'Өдөр бүр хэрэглэхэд таатай, удаан эдэлгээтэй зүйлсийг бид өөрсдөө хайж, шалгаж, сонгон хүргэдэг.',
    shop: 'Дэлгүүр үзэх',
    meet: 'Бидэнтэй танилцах',
    aboutTitle: 'hotaru.mn-ийн тухай',
    aboutQuote: 'Бид зөвхөн харагдах байдлыг бус, хэрэглэхэд хэр эвтэйхэн, чанартай, удаан эдэлгээтэй вэ гэдгийг нь чухалчилдаг.',
    aboutBody: 'hotaru.mn нь өдөр тутмын хэрэглээнд зориулсан загварлаг, чанартай бүтээгдэхүүнүүдийг боломжийн үнээр хүргэдэг онлайн дэлгүүр юм.',
    stepsTitle: 'Бид хэрхэн сонгодог вэ',
    steps: [
      { title: 'Сонгоно', body: 'Материал, хийц, багтаамж, тав тух, өдөр тутмын хэрэглээнд тохирох эсэхээр нь шүүнэ.' },
      { title: 'Шалгана', body: 'Олон төрлөөс илүү, өөрсдөө итгэлтэй санал болгож чадахыг нь л үлдээнэ.' },
      { title: 'Хүргэнэ', body: 'Улаанбаатарт ажлын 1–2 хоногт, 5,000₮-ийн хүргэлттэй.' },
    ],
    foundersTitle: 'Үүсгэн байгуулагчид',
    foundersIntro: 'hotaru-г бид хоёр эхлүүлсэн. Өдөр бүр хэрэглэхэд баярламаар зүйлсийг өөрсдөө хайж, шалгаж, итгэлтэй болсноо л санал болгодог.',
    founders: [
      { name: 'Хишиг', role: 'Үүсгэн байгуулагч, технологи хариуцсан захирал', bio: 'hotaru-г эхлүүлэх санааг гаргасан. Сайт, систем гээд технологийн талыг бүхэлд нь хариуцдаг бөгөөд захиалга бэлтгэх, бараа сонгоход ч гар бие оролцдог.' },
      { name: 'Аму', role: 'Хамтран үүсгэн байгуулагч, үйл ажиллагаа хариуцсан захирал', bio: 'Маркетинг, харилцаа холбоог хариуцдаг. Бараа сонголтыг удирдаж, материал, хийц, тав тухыг нь нэг бүрчлэн нягталдаг. Бидний пост, мессеж бүрийн ард Аму бий.' },
    ],
    goalTitle: 'Бидний зорилго',
    goalBody: 'Өдөр тутамдаа хэрэглэх зүйл тань гоё харагдахаас гадна хэрэглэхэд таатай байх ёстой гэж бид боддог. Тиймээс загварлаг, чанартай бүтээгдэхүүнийг зах зээлийн бодит үнэлгээгээр таны гарт хялбар хүргэхийг зорьж ажиллаж байна.',
    values: ['Чанартай', 'Тав тухтай', 'Боломжийн үнэтэй'],
  },
  en: {
    heroTitle: 'Small things that brighten every day',
    heroLead: 'We find, test and hand-pick things that feel good to use every day and last a long time.',
    shop: 'Shop now',
    meet: 'Meet us',
    aboutTitle: 'About hotaru.mn',
    aboutQuote: 'We care not only about how things look, but about how comfortable, well made and long-lasting they are to use.',
    aboutBody: 'hotaru.mn is an online store bringing stylish, quality everyday products at fair prices.',
    stepsTitle: 'How we choose',
    steps: [
      { title: 'We pick', body: 'By material, craft, capacity, comfort and how well it fits everyday life.' },
      { title: 'We test', body: 'Rather than many options, we keep only what we can recommend with confidence.' },
      { title: 'We deliver', body: 'Across Ulaanbaatar in 1–2 working days, for 5,000₮.' },
    ],
    foundersTitle: 'Founders',
    foundersIntro: 'The two of us started hotaru. We search for things that make everyday life a little happier, test them ourselves, and only recommend what we trust.',
    founders: [
      { name: 'Khishig', role: 'Founder & CTO', bio: 'Came up with the idea for hotaru. Runs the site, the systems and everything technical, and helps prepare orders and choose products.' },
      { name: 'Amu', role: 'Co-founder & COO', bio: 'Leads marketing and communications, and heads product selection, checking material, craft and comfort one by one. Every post and message from us comes from Amu.' },
    ],
    goalTitle: 'Our goal',
    goalBody: 'We believe the things you use every day should feel as good as they look. So we work to bring stylish, quality products to you easily, at honest market prices.',
    values: ['Quality', 'Comfort', 'Fair price'],
  },
} as const

const MASCOTS = [
  { character: 'khishig', size: 120 },
  { character: 'amu', size: 150 },
] as const

const H2 = 'font-(family-name:--font-display) text-[clamp(26px,2.6vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-primary-strong'

export default function AboutContent() {
  const lang = useLang()

  const t = COPY[lang]

  return (
    <div className="text-ink">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7">
        <section className="flex flex-wrap items-center gap-x-16 gap-y-12 pb-20 pt-12 lg:pb-24 lg:pt-16">
          <div className="min-w-0 flex-[1_1_440px]">
            <h1 className="text-[clamp(38px,5.2vw,68px)] font-semibold leading-[1.04] tracking-[-0.035em] text-primary-strong">
              {t.heroTitle}
            </h1>
            <p className="mt-6 max-w-[46ch] text-[18px] leading-relaxed text-ink-soft">{t.heroLead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="inline-flex min-h-12 items-center rounded-full bg-primary-strong px-6 text-[15px] font-semibold text-on-primary transition-opacity hover:opacity-90">
                {t.shop}
              </Link>
              <a href="#founders" className="inline-flex min-h-12 items-center rounded-full border-[1.5px] border-primary-strong px-6 text-[15px] font-semibold text-primary-strong transition-colors hover:bg-note-soft">
                {t.meet}
              </a>
            </div>
          </div>
          <div className="flex flex-[1_1_360px] justify-center">
            <div className="relative grid aspect-square w-full max-w-[440px] place-items-end overflow-hidden rounded-full bg-note-soft">
              <span aria-hidden className="about-bubble absolute left-[10%] top-[12%] aspect-square w-[22%] bg-blush" />
              <span aria-hidden className="about-bubble about-bubble-small absolute right-[12%] top-[20%] aspect-square w-[12%] bg-cream" />
              <span aria-hidden className="about-sparkle left-[38%] top-[14%]" />
              <span aria-hidden className="about-sparkle about-sparkle-2 right-[26%] top-[38%]" />
              <span aria-hidden className="about-sparkle about-sparkle-3 left-[22%] top-[44%]" />
              <div className="relative mb-[6%] flex items-end justify-center gap-2">
                <SiteMascot character="khishig" label={t.founders[0].name} size={150} />
                <SiteMascot character="amu" label={t.founders[1].name} size={180} />
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-x-[72px] gap-y-8 border-t border-line py-16">
          <h2 className={`${H2} flex-[1_1_280px]`}>{t.aboutTitle}</h2>
          <div className="min-w-0 flex-[2_1_480px]">
            <p className="text-[22px] leading-normal tracking-[-0.01em] text-primary-strong">{t.aboutQuote}</p>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.75] text-ink-soft">{t.aboutBody}</p>
          </div>
        </section>

        <section className="border-t border-line py-16">
          <h2 className={H2}>{t.stepsTitle}</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {t.steps.map((step, i) => (
              <li key={step.title} className="relative pl-14 sm:pl-0 sm:pt-14">
                <span className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-primary-strong bg-paper text-[15px] font-semibold text-primary-strong">
                  {i + 1}
                </span>
                {i < t.steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-[-36px] left-5 top-11 w-px bg-line sm:bottom-auto sm:left-12 sm:right-[-28px] sm:top-5 sm:h-px sm:w-auto"
                  />
                )}
                <h3 className="text-[20px] font-semibold text-primary-strong">{step.title}</h3>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="founders" className="scroll-mt-24 border-t border-line py-16">
          <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
            <h2 className={H2}>{t.foundersTitle}</h2>
            <p className="max-w-[56ch] text-[16px] leading-relaxed text-ink-soft">{t.foundersIntro}</p>
          </div>
          <div className="mt-9 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {t.founders.map((f, i) => (
              <article key={MASCOTS[i].character} className="flex flex-wrap items-center gap-6 rounded-[28px] border border-line bg-paper p-7">
                <div className={`grid h-[132px] w-[132px] shrink-0 place-items-end overflow-hidden rounded-full ${TINTS[i % TINTS.length]}`}>
                  <SiteMascot character={MASCOTS[i].character} label={f.name} size={MASCOTS[i].size} />
                </div>
                <div className="min-w-0 flex-[1_1_200px]">
                  <h3 className="text-[22px] font-semibold text-primary-strong">{f.name}</h3>
                  <p className="mt-0.5 text-[14px] font-medium text-note-ink">{f.role}</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{f.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap gap-x-[72px] gap-y-8 border-t border-line pb-20 pt-16">
          <h2 className={`${H2} flex-[1_1_280px]`}>{t.goalTitle}</h2>
          <div className="min-w-0 flex-[2_1_480px]">
            <p className="max-w-[62ch] text-[16px] leading-[1.75] text-ink-soft">{t.goalBody}</p>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {t.values.map((value, i) => (
                <li key={value} className={`rounded-full px-[18px] py-2.5 text-[15px] font-medium text-primary-strong ${TINTS[i % TINTS.length]}`}>
                  {value}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

    </div>
  )
}
