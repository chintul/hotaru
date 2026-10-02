import { formatMnt } from '../format.ts'
import type { Mnt } from '../types.ts'

export interface NotificationItem {
  title: string
  variant?: string | null
  quantity: number
  line_total_mnt: Mnt
  is_preorder?: boolean | null
  preorder_eta?: string | null
}

export interface NotificationBank {
  bank_name?: string | null
  account_number?: string | null
  account_name?: string | null
  instructions?: string | null
}

export interface NotificationPayload {
  order_number?: string
  customer_email?: string | null
  customer_phone?: string | null
  items?: NotificationItem[]
  subtotal_mnt?: Mnt | null
  discount_mnt?: Mnt | null
  delivery_mnt?: Mnt | null
  total_mnt?: Mnt | null
  upfront_mnt?: Mnt | null
  min_upfront_mnt?: Mnt | null
  balance_mnt?: Mnt | null
  status?: string | null
  tracking_number?: string | null
  bank?: NotificationBank | null
}

export interface RenderedEmail {
  subject: string
  html: string
}

const shell = (title: string, body: string): string => `<!doctype html>
<html lang="mn"><body style="margin:0;background:#f4f4f4;font-family:system-ui,-apple-system,sans-serif;color:#232323">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px">
    <p style="font-size:20px;font-weight:700;letter-spacing:-.3px;margin:0 0 24px">hotaru</p>
    <h1 style="font-size:18px;font-weight:700;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#8a8a8a">
      hotaru · Улаанбаатар
    </p>
  </div>
</body></html>`

const hasBalance = (p: NotificationPayload): boolean => Number(p.balance_mnt) > 0

const dueNow = (p: NotificationPayload): Mnt | null | undefined =>
  p.status === 'awaiting_balance' ? p.balance_mnt : hasBalance(p) ? p.upfront_mnt : p.total_mnt

const preorderNote = (i: NotificationItem): string =>
  i.is_preorder
    ? `<br><span style="font-size:12px;color:#2d67e2">Урьдчилсан захиалга${i.preorder_eta ? ` · ирэх хугацаа ${i.preorder_eta}` : ''}</span>`
    : ''

const siteLink = (orderNumber: string | undefined, label: string): string => {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site || !orderNumber) return ''
  return `<p style="margin:20px 0 0"><a href="${site}/orders/${orderNumber}" style="display:inline-block;background:#152b57;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600">${label}</a></p>`
}

const bankTable = (p: NotificationPayload, bank: NotificationBank, amountLabel: string, amount: Mnt | null | undefined): string => `
  <table style="width:100%;font-size:14px;background:#f7f6f4;padding:16px">
    <tr><td style="color:#6b6b6b">Банк</td><td style="text-align:right">${bank.bank_name ?? '—'}</td></tr>
    <tr><td style="color:#6b6b6b">Данс</td><td style="text-align:right;font-weight:700">${bank.account_number ?? '—'}</td></tr>
    <tr><td style="color:#6b6b6b">Хүлээн авагч</td><td style="text-align:right">${bank.account_name ?? '—'}</td></tr>
    <tr><td style="color:#6b6b6b">${amountLabel}</td><td style="text-align:right;font-weight:700">${formatMnt(amount)}</td></tr>
    <tr><td style="color:#6b6b6b">Гүйлгээний утга</td><td style="text-align:right;font-weight:700">${p.order_number}</td></tr>
  </table>`

const itemRows = (items: readonly NotificationItem[] = []): string =>
  items.map((i) => `<tr>
      <td style="padding:6px 0">${i.title}${i.variant ? ` <span style="color:#8a8a8a">${i.variant}</span>` : ''} × ${i.quantity}${preorderNote(i)}</td>
      <td style="padding:6px 0;text-align:right">${formatMnt(i.line_total_mnt)}</td>
    </tr>`).join('')

const customerIdentity = (p: NotificationPayload): string => [p.customer_email, p.customer_phone].filter(Boolean).join(' · ') || '—'

const totals = (p: NotificationPayload): string => `<table style="width:100%;font-size:14px;border-top:1px solid #e5e5e5;margin-top:12px">
    ${itemRows(p.items)}
    <tr><td style="padding-top:10px;border-top:1px solid #e5e5e5">Дүн</td>
        <td style="padding-top:10px;border-top:1px solid #e5e5e5;text-align:right">${formatMnt(p.subtotal_mnt)}</td></tr>
    ${Number(p.discount_mnt) > 0 ? `<tr><td>Хөнгөлөлт</td><td style="text-align:right">−${formatMnt(p.discount_mnt)}</td></tr>` : ''}
    <tr><td>Хүргэлт</td><td style="text-align:right">${formatMnt(p.delivery_mnt)}</td></tr>
    <tr><td style="font-weight:700;padding-top:8px">Нийт</td>
        <td style="font-weight:700;text-align:right;padding-top:8px">${formatMnt(p.total_mnt)}</td></tr>
    ${hasBalance(p) ? `
    <tr><td style="padding-top:8px;color:#6b6b6b">Урьдчилгаа (одоо)</td>
        <td style="padding-top:8px;text-align:right">${formatMnt(p.upfront_mnt)}</td></tr>
    <tr><td style="color:#6b6b6b">Үлдэгдэл (бараа ирэхэд)</td>
        <td style="text-align:right">${formatMnt(p.balance_mnt)}</td></tr>` : ''}
  </table>`

const DEPOSIT_TERMS = `<p style="font-size:12px;color:#6b6b6b;margin:12px 0 0">Урьдчилсан захиалгын урьдчилгаа
  төлбөр буцаагдахгүй. Үлдэгдлийг бараа ирмэгц нэхэмжилнэ.</p>`

export function renderNotification(kind: string, payload: NotificationPayload | null | undefined): RenderedEmail {
  const p: NotificationPayload = payload ?? {}
  const bank: NotificationBank = p.bank ?? {}

  switch (kind) {
    case 'order_placed_customer':
      return {
        subject: `Захиалга ${p.order_number} — төлбөр хүлээгдэж байна`,
        html: shell('Захиалга хүлээн авлаа', `
          <p style="font-size:14px;margin:0 0 16px">${hasBalance(p)
            ? `Урьдчилсан захиалгатай тул одоо урьдчилгаа төлнө. Дүнгээ төлөхдөө өөрөө сонгоно: хамгийн багадаа ${formatMnt(p.min_upfront_mnt ?? p.upfront_mnt)}, бүтэн ${formatMnt(p.total_mnt)} хүртэл. Үлдэгдлийг бараа ирэхэд төлнө.`
            : 'Доорх дансанд төлбөрөө шилжүүлнэ үү.'}</p>
          ${bankTable(p, bank, hasBalance(p) ? 'Хамгийн бага урьдчилгаа' : 'Дүн', hasBalance(p) ? (p.min_upfront_mnt ?? p.upfront_mnt) : dueNow(p))}
          <p style="font-size:13px;color:#6b6b6b;margin:12px 0 0">${bank.instructions ?? ''}</p>
          ${totals(p)}
          ${hasBalance(p) ? DEPOSIT_TERMS : ''}`),
      }

    case 'order_placed_owner':
      return {
        subject: `Шинэ захиалга ${p.order_number} · ${formatMnt(p.total_mnt)}`,
        html: shell(`Шинэ захиалга ${p.order_number}`, `
          <p style="font-size:14px">${customerIdentity(p)}</p>
          ${totals(p)}`),
      }

    case 'payment_submitted_owner':
      return {
        subject: `Төлбөр шилжүүлсэн гэж мэдэгдлээ — ${p.order_number}`,
        html: shell('Дансаа шалгана уу', `
          <p style="font-size:14px">${customerIdentity(p)} захиалга ${p.order_number}-ийн төлбөрийг
          шилжүүлсэн гэж мэдэгдлээ. Дүн: <strong>${formatMnt(dueNow(p))}</strong>${
            p.status === 'awaiting_balance' ? ' (үлдэгдэл)' : hasBalance(p) ? ' (урьдчилгаа)' : ''}.</p>`),
      }

    case 'payment_submitted_customer':
      return {
        subject: `Төлбөрийн мэдэгдэл хүлээн авлаа — ${p.order_number}`,
        html: shell('Мэдэгдлийг тань хүлээн авлаа', `
          <p style="font-size:14px;margin:0 0 16px">Захиалга ${p.order_number}-ийн төлбөрийг
          шилжүүлсэн тухай мэдэгдлийг тань хүлээн авлаа. Дансаа шалгаад
          баталгаажмагц тан руу дахин имэйл илгээнэ — ихэвчлэн ажлын цагт
          нэг өдрийн дотор.</p>
          <p style="font-size:13px;color:#6b6b6b;margin:0 0 16px">Энэ нь төлбөр баталгаажсан
          гэсэн үг биш. Баталгаажсан үед тусдаа мэдэгдэл очно.</p>
          ${totals(p)}`),
      }

    case 'payment_confirmed_customer':
      return {
        subject: `Төлбөр баталгаажлаа — ${p.order_number}`,
        html: shell('Төлбөр баталгаажлаа', `
          <p style="font-size:14px">${hasBalance(p)
            ? 'Үлдэгдэл төлбөр баталгаажлаа. Баярлалаа, захиалгыг тань бэлтгэж эхэллээ.'
            : 'Баярлалаа. Захиалгыг тань бэлтгэж эхэллээ.'}</p>${totals(p)}`),
      }

    case 'deposit_confirmed_customer':
      return {
        subject: `Урьдчилгаа баталгаажлаа — ${p.order_number}`,
        html: shell('Урьдчилгаа баталгаажлаа', `
          <p style="font-size:14px;margin:0 0 12px">Баярлалаа. Урьдчилсан захиалгын бараа ирмэгц
          үлдэгдэл <strong>${formatMnt(p.balance_mnt)}</strong>-ийн нэхэмжлэлийг танд илгээнэ.</p>
          ${totals(p)}
          ${DEPOSIT_TERMS}
          ${siteLink(p.order_number, 'Захиалгаа харах')}`),
      }

    case 'balance_requested_customer':
      return {
        subject: `Бараа ирлээ — үлдэгдэл ${formatMnt(p.balance_mnt)} төлнө үү (${p.order_number})`,
        html: shell('Бараа тань ирлээ', `
          <p style="font-size:14px;margin:0 0 16px">Урьдчилсан захиалгын бараа ирсэн. Үлдэгдэл төлбөрөө
          төлмөгц захиалгыг тань хүргэлтэд бэлтгэнэ.</p>
          ${bankTable(p, bank, 'Үлдэгдэл', p.balance_mnt)}
          <p style="font-size:13px;color:#6b6b6b;margin:12px 0 0">${bank.instructions ?? ''}</p>
          ${siteLink(p.order_number, 'Үлдэгдэл төлөх')}
          ${totals(p)}`),
      }

    case 'order_shipped_customer':
      return {
        subject: `Захиалга ${p.order_number} хүргэлтэд гарлаа`,
        html: shell('Хүргэлтэд гарлаа', `
          <p style="font-size:14px">Захиалга тань хүргэлтэд гарсан.
          ${p.tracking_number ? `Хяналтын дугаар: <strong>${p.tracking_number}</strong>.` : ''}</p>`),
      }

    case 'order_cancelled_customer':
      return {
        subject: `Захиалга ${p.order_number} цуцлагдлаа`,
        html: shell('Захиалга цуцлагдлаа', `
          <p style="font-size:14px">Захиалга ${p.order_number} цуцлагдсан. Асуулт байвал бидэнтэй холбогдоно уу.</p>`),
      }

    case 'order_oversold_owner':
      return {
        subject: `ЯАРАЛТАЙ: ${p.order_number} — нөөц хүрэлцэхгүй`,
        html: shell('Нөөц хүрэлцэхгүй', `
          <p style="font-size:14px">Захиалга ${p.order_number}-ийн төлбөр баталгаажсан ч бараа дууссан.
          <strong>Буцаалт хийх шаардлагатай.</strong></p>
          <p style="font-size:14px">${customerIdentity(p)}</p>${totals(p)}`),
      }

    default:
      return { subject: `hotaru — ${kind}`, html: shell(kind, `<pre>${JSON.stringify(p, null, 2)}</pre>`) }
  }
}
