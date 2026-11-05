'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { preload } from 'react-dom'
import SiteMascot from '@/components/SiteMascot'
import { useT, type Translate } from '@/lib/i18n'

interface GuideLink {
  href: string
  label: string
}

export interface GuideQuestion {
  q: string
  a: string[]
  link?: GuideLink
}

export interface GuideTip {
  lines: string[]
  link?: GuideLink
  questions?: GuideQuestion[]
}

type SetTip = (tip: GuideTip | null) => void

const GuideContext = createContext<{ tip: GuideTip | null; setTip: SetTip } | null>(null)

export function GuideProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<GuideTip | null>(null)
  return <GuideContext.Provider value={{ tip, setTip }}>{children}</GuideContext.Provider>
}

export function GuideTipSetter({ tip }: { tip: GuideTip | null }) {
  const setTip = useContext(GuideContext)?.setTip
  const key = tip ? JSON.stringify(tip) : ''
  useEffect(() => {
    if (!setTip) return
    setTip(key ? (JSON.parse(key) as GuideTip) : null)
    return () => setTip(null)
  }, [setTip, key])
  return null
}

export function guideQuestions(t: Translate) {
  const contact: GuideLink = { href: '/contact', label: t('Холбоо барих', 'Contact us') }
  return {
    contact,
    delivery: {
      q: t('Хүргэлт хэдэн хоног болох вэ?', 'How long does delivery take?'),
      a: [
        t('Улаанбаатарт ажлын 1–2 хоногт, 5,000₮.', 'In Ulaanbaatar, 1–2 working days, 5,000₮.'),
        t('Орон нутагт 15,000₮, унаанд тавьж илгээнэ.', 'Outside the city, 15,000₮, sent by intercity transport.'),
      ],
      link: { href: '/shipping', label: t('Хүргэлтийн нөхцөл', 'Delivery terms') },
    },
    preorder: {
      q: t('Урьдчилсан захиалга гэж юу вэ?', 'What is a pre-order?'),
      a: [
        t('Үлдэгдэлгүй барааг урьдчилгаа төлөөд захиална.', 'You order an out-of-stock item by paying a deposit.'),
        t('Захиалга баталгаажсанаас хойш 10–14 хоногт ирнэ.', 'It arrives 10–14 days after your order is confirmed.'),
        t('Үлдсэнийг бараа ирэхэд төлнө. Ирмэгц бид мэдэгдэнэ.', 'You pay the rest when it arrives. We let you know as soon as it does.'),
      ],
    },
    pay: {
      q: t('Хэрхэн төлөх вэ?', 'How do I pay?'),
      a: [
        t('Захиалга өгсний дараа төлбөрийн мэдээлэл харагдана.', 'Payment details appear after you place your order.'),
        t('Дансаар шилжүүлбэл гүйлгээний утга дээр захиалгын дугаараа бичээрэй.', 'For a bank transfer, put your order number in the transfer note.'),
      ],
    },
    discount: {
      q: t('Хөнгөлөлт байгаа юу?', 'Are there any discounts?'),
      a: [t('100,000₮-өөс дээш захиалгад 10% хөнгөлөлттэй.', 'Orders over 100,000₮ get 10% off.')],
    },
    returns: {
      q: t('Буцааж, сольж болох уу?', 'Can I return or exchange?'),
      a: [
        t('Үгүй. Захиалсан барааг буцаах, солих боломжгүй.', 'No. Orders can’t be returned or exchanged.'),
        t('Гэмтэлтэй ирсэн бол хүлээн авснаас хойш 48 цагийн дотор мэдэгдээрэй, бид сольж өгнө.', 'If it arrives damaged, tell us within 48 hours and we replace it.'),
      ],
      link: { href: '/returns', label: t('Буцаалтын нөхцөл', 'Returns policy') },
    },
    confirm: {
      q: t('Төлбөр хэзээ баталгаажих вэ?', 'When is my payment confirmed?'),
      a: [
        t('Ажлын цагт ихэвчлэн нэг өдрийн дотор.', 'Usually within one working day.'),
        t('Баталгаажмагц танд мэдэгдэнэ.', 'We let you know as soon as it is.'),
      ],
    },
    cancel: {
      q: t('Захиалгаа цуцалж болох уу?', 'Can I cancel my order?'),
      a: [
        t('Төлбөр төлөхөөс өмнө цуцалж болно.', 'Yes, before you pay.'),
        t('Төлбөр төлсний дараа цуцлах, мөнгө буцаах боломжгүй.', 'Once paid, orders can’t be cancelled or refunded.'),
      ],
      link: contact,
    },
    filter: {
      q: t('Яаж шүүж хайх вэ?', 'How do I filter?'),
      a: [
        t('Ангилал, үнэ, бэлэн байгаа эсэхээр нь шүүнэ.', 'Filter by category, price and availability.'),
        t('Утсан дээр «Шүүх» товчийг дараарай.', 'On a phone, tap “Filter”.'),
      ],
    },
    account: {
      q: t('Бүртгэлгүй захиалж болох уу?', 'Can I order without an account?'),
      a: [
        t('Үгүй, захиалгаа хянахын тулд бүртгүүлнэ.', 'No, an account lets you track your order.'),
        t('Сагсанд байгаа бараа тань бүртгэлийн явцад хадгалагдана.', 'Your cart is kept while you sign up.'),
      ],
    },
  } satisfies Record<string, GuideQuestion | GuideLink>
}

function defaultTip(pathname: string, t: Translate): GuideTip {
  const g = guideQuestions(t)
  if (pathname === '/')
    return {
      lines: [t('Зураг дээр дарвал тэр ангиллын бараа руу орно.', 'Tap a photo to see that category.')],
      link: { href: '/shop', label: t('Бүх бараа', 'All products') },
      questions: [g.delivery, g.preorder, g.pay, g.discount],
    }
  if (pathname === '/shop')
    return {
      lines: [t('«Урьдчилсан захиалга» тэмдэгтэй бараа одоогоор үлдэгдэлгүй.', 'Items marked “Pre-order” are out of stock for now.')],
      questions: [g.preorder, g.filter, g.delivery],
    }
  if (pathname.startsWith('/shop/'))
    return { lines: [t('Өнгө, хэмжээгээ сонгоод сагсандаа нэмээрэй.', 'Pick a colour and size, then add it to your cart.')], questions: [g.delivery, g.returns] }
  if (pathname.startsWith('/checkout'))
    return {
      lines: [
        t('1. Хүргэлтийн хаягаа оруулна.', '1. Enter your delivery address.'),
        t('2. Төлөх аргаа сонгоно.', '2. Choose how to pay.'),
        t('3. Захиалгаа баталгаажуулна.', '3. Confirm your order.'),
      ],
      questions: [g.preorder, g.pay, g.account, g.delivery],
    }
  if (pathname.startsWith('/orders'))
    return { lines: [t('Захиалгынхаа дугаар дээр дарж явцыг нь хараарай.', 'Tap an order number to see its progress.')], questions: [g.confirm, g.cancel] }
  if (pathname.startsWith('/account'))
    return { lines: [t('Хувийн мэдээлэл, хаягаа эндээс засна.', 'Edit your details and addresses here.')], questions: [g.cancel, g.returns] }
  if (pathname.startsWith('/wishlist'))
    return { lines: [t('Хадгалсан бараа тань энд байна.', 'Your saved items are here.')], questions: [g.preorder, g.delivery] }
  return {
    lines: [t('Сайн уу! Юу асуух вэ?', 'Hi! What would you like to know?')],
    link: g.contact,
    questions: [g.delivery, g.returns, g.pay],
  }
}

const GUIDE_KHISHIG = ['/checkout', '/orders', '/account']

const GUIDE_CHARACTERS = ['elsa', 'khishig'] as const

const CALM_ADVICE = [
  ['Гүнзгий амьсгаа аваад, мөрөө сулла. Яарах хэрэггүй.', 'Take a deep breath and drop your shoulders. No rush.'],
  ['Өнөөдөр ус уусан уу? Нэг аяга уучихаарай.', 'Had some water today? Have a glass.'],
  ['Өөртөө жаахан амсхийх зав гаргаарай.', 'Give yourself a little break.'],
  ['Чи өнөөдөр сайн ажилласан.', 'You did well today.'],
  ['Жаахан суниаад авбал бие чинь баярлана.', 'A little stretch will feel nice.'],
  ['Унтахаасаа өмнө утсаа жаахан хол тавиарай.', 'Put your phone away a little before bed.'],
] as const

const subscribeScroll = (onChange: () => void) => {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}
const pastCover = () => window.scrollY > window.innerHeight * 0.7
const serverPastCover = () => false

const WIDE = '(min-width: 1024px)'
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const getWide = () => window.matchMedia(WIDE).matches
const serverWide = () => false

function TipLink({ link }: { link: GuideLink }) {
  return (
    <Link href={link.href} className="link-underline mt-2.5 inline-block font-semibold text-primary-strong">
      {link.label}
    </Link>
  )
}

export function MascotGuide() {
  const pathname = usePathname()
  const t = useT()
  const tip = useContext(GuideContext)?.tip ?? defaultTip(pathname, t)
  const [openOn, setOpenOn] = useState<string | null>(null)
  const [answer, setAnswer] = useState<number | null>(null)
  const [advice, setAdvice] = useState(0)
  const scrolled = useSyncExternalStore(subscribeScroll, pastCover, serverPastCover)
  const wide = useSyncExternalStore(subscribeWide, getWide, serverWide)
  const open = openOn === pathname
  const elsa = !GUIDE_KHISHIG.some((p) => pathname.startsWith(p))
  const character = elsa ? 'elsa' : 'khishig'
  const name = elsa ? t('Элса', 'Elsa') : t('Нова', 'Nova')
  const questions = (tip.questions ?? []).slice(0, 4)
  const picked = answer === null ? null : questions[answer]

  const close = () => {
    setOpenOn(null)
    setAnswer(null)
  }

  for (const c of GUIDE_CHARACTERS) {
    preload(`/mascots/${c}-directions.webp`, { as: 'image', fetchPriority: 'low' })
    preload(`/mascots/${c}-reactions.webp`, { as: 'image', fetchPriority: 'low' })
  }

  if (pathname === '/' && !scrolled) return null

  return (
    <div
      className="mascot-guide fixed left-3 z-30 flex items-end gap-2 lg:left-6 lg:gap-1.5"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
    >
      <div
        className="relative shrink-0"
        onClick={() => {
          if (open) close()
          else {
            setAdvice(Math.floor(Math.random() * CALM_ADVICE.length))
            setOpenOn(pathname)
          }
        }}
      >
        <div className="guide-avatar max-lg:grid max-lg:h-[76px] max-lg:w-[76px] max-lg:items-end max-lg:justify-items-center max-lg:overflow-hidden max-lg:rounded-full max-lg:bg-cream max-lg:shadow-(--t-lift) max-lg:ring-1 max-lg:ring-line lg:drop-shadow-[0_6px_12px_rgb(23_35_46/0.22)]">
          <SiteMascot key={character} className="guide-swap" character={character} label={`${name}, ${t('зөвлөгөө', 'help')}`} size={wide ? (elsa ? 124 : 104) : elsa ? 82 : 78} />
        </div>
        {!open && (
          <span aria-hidden className="absolute -right-1 -top-1 grid h-[22px] w-[22px] place-items-center rounded-full bg-primary-strong text-[11px] font-bold text-on-primary ring-2 ring-paper lg:right-1 lg:top-2 lg:h-6 lg:w-6 lg:text-[12px] lg:ring-0">
            ?
          </span>
        )}
      </div>

      <div aria-live="polite" className="min-w-0">
        {open && (
          <div className="relative mb-2 w-[min(300px,calc(100vw-108px))] rounded-2xl lg:mb-8 lg:w-[min(300px,calc(100vw-128px))] border border-line bg-paper p-4 pr-9 text-[14px] leading-relaxed text-ink shadow-(--t-lift)">
            <p className="text-[13px] font-semibold text-note-ink">{name}</p>

            {picked ? (
              <>
                <p className="mt-1 font-semibold text-primary-strong">{picked.q}</p>
                <div className="mt-1.5 space-y-1.5">
                  {picked.a.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                {picked.link && <TipLink link={picked.link} />}
                <button
                  type="button"
                  onClick={() => setAnswer(null)}
                  className="mt-3 flex min-h-10 items-center text-[13px] font-semibold text-ink-soft underline underline-offset-4 hover:text-ink-strong"
                >
                  {t('Бусад асуулт', 'Other questions')}
                </button>
              </>
            ) : (
              <>
                <div className="mt-1 space-y-1.5">
                  {tip.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                {tip.link && <TipLink link={tip.link} />}
                {elsa && (
                  <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-[13px] text-ink">
                    {t(CALM_ADVICE[advice][0], CALM_ADVICE[advice][1])}
                  </p>
                )}
                {questions.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {questions.map((item, i) => (
                      <li key={item.q}>
                        <button
                          type="button"
                          onClick={() => setAnswer(i)}
                          className="flex min-h-10 w-full items-center rounded-xl bg-note-soft px-3 py-2 text-left text-[13px] font-medium text-primary-strong transition-colors hover:bg-line-soft"
                        >
                          {item.q}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <button
              type="button"
              aria-label={t('Хаах', 'Close')}
              onClick={close}
              className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full text-[18px] leading-none text-ink-soft hover:bg-shade"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
