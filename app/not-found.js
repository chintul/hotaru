import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-32 text-center">
      <p className="label text-ink-faint">404</p>
      <h1 className="display mt-4 text-3xl">Хуудас олдсонгүй</h1>
      <Link href="/" className="label link-underline mt-6 inline-block">Нүүр хуудас</Link>
    </div>
  )
}
