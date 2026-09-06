import { safeQuery } from '@/lib/apollo/safeQuery'
import { PAYMENT_MODE } from '@/lib/queries'
import { nodes } from '@/lib/format'

/**
 * What the storefront may promise about paying.
 *
 * Read from store_settings rather than hardcoded, because the owner can switch
 * QPay off from /admin and copy that still advertises a QR would be a lie the
 * customer only discovers at the order page. Server-side, on the anon key,
 * cached with the rest of the catalog.
 */
export async function paymentCopy() {
  const { data } = await safeQuery(PAYMENT_MODE)
  const qpay = Boolean(nodes(data?.storeSettingsCollection)[0]?.qpayEnabled)
  return {
    qpay,
    // Footer-length.
    short: qpay ? 'QPay QR эсвэл дансаар' : 'Дансаар шилжүүлж төлнө',
    // A sentence for a product or policy page.
    long: qpay
      ? 'QPay QR эсвэл дансаар төлнө — захиалга өгсний дараа QR код харагдана.'
      : 'Дансаар шилжүүлж төлнө — захиалга өгсний дараа дансны мэдээлэл харагдана.',
    // Home tile: [title, body].
    tile: qpay
      ? ['QPay QR эсвэл данс', 'Захиалга өгсний дараа QR код харагдана']
      : ['Дансаар төлөх', 'Захиалга өгсний дараа дансны мэдээлэл'],
  }
}
