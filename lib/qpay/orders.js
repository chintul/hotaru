/**
 * Order ↔ invoice orchestration. SERVER ONLY.
 *
 * The two halves of the payment: turning an order into a QuickQR invoice, and
 * turning a callback into a confirmed order. Neither trusts the caller's word
 * about money — the amount comes from the payment row written at checkout, and
 * the payment status comes from QPay's own answer.
 */

import { QPayError } from './config.js'
import { checkPayment, createInvoice } from './client.js'
import { callbackUrlFor } from './callback-token.js'
import * as realStore from './store.js'

function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) throw new QPayError('NEXT_PUBLIC_SITE_URL is not set', { code: 'NO_SITE_URL' })
  return url
}

export async function createInvoiceForOrder(orderId, { admin, store = realStore, fetchImpl } = {}) {
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

  // The recorded payment amount, not a freshly computed total: the customer
  // agreed to this number at checkout.
  const amountMnt = order.paymentAmountMnt ?? order.totalMnt

  const invoice = await createInvoice({
    merchantId: settings.qpayMerchantId || process.env.QPAY_MERCHANT_ID,
    amountMnt,
    description: order.orderNumber,
    callbackUrl: callbackUrlFor(order.id, siteUrl()),
    customerName: 'hotaru',
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

/**
 * Turn a callback into a confirmation, or into nothing.
 *
 * The callback body is never consulted. Whether money arrived is settled by
 * /v2/payment/check, which answers OPEN or PAID and gives no settled total —
 * so the amount is checked against what the invoice was created for.
 */
export async function confirmOrderFromCallback(orderId, { admin, store = realStore, fetchImpl } = {}) {
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
