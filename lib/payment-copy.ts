import { safeQuery } from './apollo/safeQuery.ts'
import { PAYMENT_MODE } from './queries.ts'
import { firstNode } from './format.ts'
import type { Connection, StoreSettings } from './types.ts'

export interface PaymentCopy {
  qpay: boolean
  short: string
  long: string
  tile: readonly [title: string, body: string]
}

export async function paymentCopy(): Promise<PaymentCopy> {
  const { data } = await safeQuery<{ storeSettingsCollection: Connection<StoreSettings> | null }>(PAYMENT_MODE)
  const qpay = Boolean(firstNode(data?.storeSettingsCollection)?.qpayEnabled)
  return {
    qpay,
    short: qpay ? 'QPay эсвэл дансаар' : 'Дансаар шилжүүлж төлнө',
    long: qpay
      ? 'QPay эсвэл дансаар төлнө — захиалга өгсний дараа QR код харагдана.'
      : 'Дансаар шилжүүлж төлнө — захиалга өгсний дараа дансны мэдээлэл харагдана.',
    tile: qpay
      ? ['QPay эсвэл данс', 'Захиалга өгсний дараа QR код харагдана']
      : ['Дансаар төлөх', 'Захиалга өгсний дараа дансны мэдээлэл'],
  }
}
