import { QPayError } from './config.ts'
import { checkPayment, createInvoice, type BankAppUrl } from './client.ts'
import { callbackUrlFor } from './callback-token.ts'
import * as realStore from './store.ts'
import type { OrderForInvoice, QpayPayment } from './store.ts'
import type { AdminClient } from '../supabase/admin.ts'
import type { FetchLike } from '../http.ts'

export interface QpayStore<Admin = AdminClient> {
  loadOrderForInvoice(admin: Admin, orderId: string): Promise<OrderForInvoice>
  attachInvoice(admin: Admin, args: { orderId: string; invoiceId: string; payload: unknown }): Promise<void>
  loadPayment(admin: Admin, orderId: string): Promise<QpayPayment | null>
  confirmQpay(admin: Admin, args: { orderId: string; invoiceId: string; amountMnt: number; payload: unknown }): Promise<void>
  noteMismatch(admin: Admin, args: { orderId: string; message: string }): Promise<void>
}

export interface QpayDeps<Admin = AdminClient> {
  admin: Admin
  store?: QpayStore<Admin>
  fetchImpl?: FetchLike
}

export interface OrderInvoice {
  invoiceId: string
  qrImage: string | null
  qrText: string | null
  urls: BankAppUrl[]
}

export type CallbackOutcome =
  | { outcome: 'unknown' | 'already' | 'mismatch' | 'confirmed' }
  | { outcome: 'pending'; status: string }

const INVOICE_CUSTOMER_NAME = 'hotaru'

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) throw new QPayError('NEXT_PUBLIC_SITE_URL is not set', { code: 'NO_SITE_URL' })
  return url
}

export async function createInvoiceForOrder<Admin = AdminClient>(
  orderId: string,
  { admin, store = realStore as QpayStore<unknown>, fetchImpl }: QpayDeps<Admin>,
): Promise<OrderInvoice> {
  const { order, settings } = await store.loadOrderForInvoice(admin, orderId)
  if (!order) throw new QPayError('order not found', { code: 'NO_ORDER', status: 404 })
  if (order.paymentStatus === 'confirmed') {
    throw new QPayError('order is already paid', { code: 'ALREADY_PAID', status: 409 })
  }
  if (!settings?.qpayEnabled) {
    throw new QPayError('QPay is switched off for this store', { code: 'QPAY_DISABLED', status: 503 })
  }
  if (!settings.bankCode || !settings.bankAccountNumber || !settings.bankAccountName) {
    throw new QPayError('store bank account is incomplete', { code: 'NO_BANK_ACCOUNT', status: 503 })
  }

  if (order.paymentAmountMnt === null) {
    throw new QPayError('nothing is due on this order right now', { code: 'NOTHING_DUE', status: 409 })
  }
  const agreedAmountMnt = order.paymentAmountMnt

  const invoice = await createInvoice({
    merchantId: settings.qpayMerchantId || (process.env.QPAY_MERCHANT_ID ?? ''),
    amountMnt: agreedAmountMnt,
    description: order.orderNumber,
    callbackUrl: callbackUrlFor(order.id, siteUrl()),
    customerName: INVOICE_CUSTOMER_NAME,
    bankAccount: {
      bankCode: settings.bankCode,
      accountNumber: settings.bankAccountNumber,
      accountName: settings.bankAccountName,
    },
  }, { fetchImpl })

  await store.attachInvoice(admin, {
    orderId: order.id, invoiceId: invoice.invoiceId, payload: invoice.raw,
  })

  return {
    invoiceId: invoice.invoiceId,
    qrImage: invoice.qrImage,
    qrText: invoice.qrText,
    urls: invoice.urls,
  }
}

export async function confirmOrderFromCallback<Admin = AdminClient>(
  orderId: string,
  { admin, store = realStore as QpayStore<unknown>, fetchImpl }: QpayDeps<Admin>,
): Promise<CallbackOutcome> {
  const payment = await store.loadPayment(admin, orderId)
  if (!payment || !payment.externalReference) return { outcome: 'unknown' }
  if (payment.paymentStatus === 'confirmed') return { outcome: 'already' }

  const checked = await checkPayment(payment.externalReference, { fetchImpl })
  if (checked.status !== 'PAID') return { outcome: 'pending', status: checked.status }

  const expected = payment.paymentAmountMnt
  const reported = checked.raw?.paid_amount ?? checked.raw?.amount
  if (reported !== undefined && reported !== null && Number(reported) !== expected) {
    await store.noteMismatch(admin, {
      orderId,
      message: `QPay reported ${reported}₮ against an invoice for ${expected}₮. Not confirmed automatically.`,
    })
    return { outcome: 'mismatch' }
  }

  await store.confirmQpay(admin, {
    orderId,
    invoiceId: payment.externalReference,
    amountMnt: expected,
    payload: checked.raw,
  })
  return { outcome: 'confirmed' }
}
