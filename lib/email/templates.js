// Relative, not '@/lib/format': the alias is a Next.js resolution and these
// templates are exercised by node --test, which resolves neither.
import { formatMnt } from '../format.js'

/**
 * Email bodies, built from the payload snapshot the trigger stored.
 *
 * They read the snapshot rather than re-querying, so an email always describes
 * the order as it was when the event happened — bank details included, which
 * matters because the owner can change the account number later.
 */
const shell = (title, body) => `<!doctype html>
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

const itemRows = (items = []) =>
  items.map((i) => `<tr>
      <td style="padding:6px 0">${i.title}${i.variant ? ` <span style="color:#8a8a8a">${i.variant}</span>` : ''} × ${i.quantity}</td>
      <td style="padding:6px 0;text-align:right">${formatMnt(i.line_total_mnt)}</td>
    </tr>`).join('')

/** Phone sign-ins have no email, so the owner alerts fall back to the phone. */
const who = (p) => [p.customer_email, p.customer_phone].filter(Boolean).join(' · ') || '—'

const totals = (p) => `<table style="width:100%;font-size:14px;border-top:1px solid #e5e5e5;margin-top:12px">
    ${itemRows(p.items)}
    <tr><td style="padding-top:10px;border-top:1px solid #e5e5e5">Дүн</td>
        <td style="padding-top:10px;border-top:1px solid #e5e5e5;text-align:right">${formatMnt(p.subtotal_mnt)}</td></tr>
    ${Number(p.discount_mnt) > 0 ? `<tr><td>Хөнгөлөлт</td><td style="text-align:right">−${formatMnt(p.discount_mnt)}</td></tr>` : ''}
    <tr><td>Хүргэлт</td><td style="text-align:right">${formatMnt(p.delivery_mnt)}</td></tr>
    <tr><td style="font-weight:700;padding-top:8px">Нийт</td>
        <td style="font-weight:700;text-align:right;padding-top:8px">${formatMnt(p.total_mnt)}</td></tr>
  </table>`

export function renderNotification(kind, payload) {
  const p = payload ?? {}
  const bank = p.bank ?? {}

  switch (kind) {
    case 'order_placed_customer':
      return {
        subject: `Захиалга ${p.order_number} — төлбөр хүлээгдэж байна`,
        html: shell('Захиалга хүлээн авлаа', `
          <p style="font-size:14px;margin:0 0 16px">Доорх дансанд төлбөрөө шилжүүлнэ үү.</p>
          <table style="width:100%;font-size:14px;background:#f7f6f4;padding:16px">
            <tr><td style="color:#6b6b6b">Банк</td><td style="text-align:right">${bank.bank_name ?? '—'}</td></tr>
            <tr><td style="color:#6b6b6b">Данс</td><td style="text-align:right;font-weight:700">${bank.account_number ?? '—'}</td></tr>
            <tr><td style="color:#6b6b6b">Хүлээн авагч</td><td style="text-align:right">${bank.account_name ?? '—'}</td></tr>
            <tr><td style="color:#6b6b6b">Дүн</td><td style="text-align:right;font-weight:700">${formatMnt(p.total_mnt)}</td></tr>
            <tr><td style="color:#6b6b6b">Гүйлгээний утга</td><td style="text-align:right;font-weight:700">${p.order_number}</td></tr>
          </table>
          <p style="font-size:13px;color:#6b6b6b;margin:12px 0 0">${bank.instructions ?? ''}</p>
          ${totals(p)}`),
      }

    case 'order_placed_owner':
      return {
        subject: `Шинэ захиалга ${p.order_number} · ${formatMnt(p.total_mnt)}`,
        html: shell(`Шинэ захиалга ${p.order_number}`, `
          <p style="font-size:14px">${who(p)}</p>
          ${totals(p)}`),
      }

    case 'payment_submitted_owner':
      return {
        subject: `Төлбөр шилжүүлсэн гэж мэдэгдлээ — ${p.order_number}`,
        html: shell('Дансаа шалгана уу', `
          <p style="font-size:14px">${who(p)} захиалга ${p.order_number}-ийн төлбөрийг
          шилжүүлсэн гэж мэдэгдлээ. Дүн: <strong>${formatMnt(p.total_mnt)}</strong>.</p>`),
      }

    // Deliberately not a confirmation: nothing has been verified when this
    // sends. It has to still read as true if the claim turns out to be wrong.
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
          <p style="font-size:14px">Баярлалаа. Захиалгыг тань бэлтгэж эхэллээ.</p>${totals(p)}`),
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
          <p style="font-size:14px">${who(p)}</p>${totals(p)}`),
      }

    default:
      return { subject: `hotaru — ${kind}`, html: shell(kind, `<pre>${JSON.stringify(p, null, 2)}</pre>`) }
  }
}
