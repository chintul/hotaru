import type { AdminClient } from '../supabase/admin.ts'

export interface InvoiceOrder {
  id: string
  orderNumber: string
  totalMnt: number
  paymentStatus: string
  paymentAmountMnt: number | null
  externalReference: string | null
}

export interface InvoiceSettings {
  qpayEnabled: boolean
  qpayMerchantId: string | null
  bankCode: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
}

export interface OrderForInvoice {
  order: InvoiceOrder | null
  settings: InvoiceSettings | null
}

export interface QpayPayment {
  id: string
  paymentAmountMnt: number
  externalReference: string | null
  paymentStatus: string
}

interface PaymentLine {
  id: string
  amount_mnt: string | number
  external_reference: string | null
  status: string
  created_at: string
}

interface OrderRow {
  id: string
  order_number: string
  total_mnt: string | number
  payment_status: string
  payments: PaymentLine[] | null
}

interface SettingsRow {
  qpay_enabled: boolean
  qpay_merchant_id: string | null
  bank_code: string | null
  bank_account_number: string | null
  bank_account_name: string | null
}

const now = (): string => new Date().toISOString()

const OPEN_STATUSES = new Set(['unpaid', 'submitted'])

const newestFirst = (a: PaymentLine, b: PaymentLine) =>
  b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)

export function currentPayment(payments: readonly PaymentLine[] | null | undefined): PaymentLine | null {
  const rows = [...(payments ?? [])].sort(newestFirst)
  return rows.find((p) => OPEN_STATUSES.has(p.status)) ?? rows[0] ?? null
}

async function loadPayments(admin: AdminClient, orderId: string): Promise<PaymentLine[]> {
  const { data, error } = await admin
    .from('payments')
    .select('id, amount_mnt, external_reference, status, created_at')
    .eq('order_id', orderId)
    .returns<PaymentLine[]>()
  if (error) throw new Error(`could not load payments: ${error.message}`)
  return data ?? []
}

export async function loadOrderForInvoice(admin: AdminClient, orderId: string): Promise<OrderForInvoice> {
  const { data: order, error } = await admin
    .from('orders')
    .select('id, order_number, total_mnt, payment_status, payments(id, amount_mnt, external_reference, status, created_at)')
    .eq('id', orderId)
    .maybeSingle<OrderRow>()
  if (error) throw new Error(`could not load order: ${error.message}`)
  if (!order) return { order: null, settings: null }

  const { data: settings, error: sErr } = await admin
    .from('store_settings')
    .select('qpay_enabled, qpay_merchant_id, bank_code, bank_account_number, bank_account_name')
    .limit(1)
    .maybeSingle<SettingsRow>()
  if (sErr) throw new Error(`could not load store settings: ${sErr.message}`)

  const open = currentPayment(order.payments)
  const payment = open && OPEN_STATUSES.has(open.status) ? open : null
  return {
    order: {
      id: order.id,
      orderNumber: order.order_number,
      totalMnt: Number(order.total_mnt),
      paymentStatus: order.payment_status,
      paymentAmountMnt: payment ? Number(payment.amount_mnt) : null,
      externalReference: payment?.external_reference ?? null,
    },
    settings: settings && {
      qpayEnabled: settings.qpay_enabled,
      qpayMerchantId: settings.qpay_merchant_id,
      bankCode: settings.bank_code,
      bankAccountNumber: settings.bank_account_number,
      bankAccountName: settings.bank_account_name,
    },
  }
}

export async function attachInvoice(
  admin: AdminClient,
  { orderId, invoiceId, payload }: { orderId: string; invoiceId: string; payload: unknown },
): Promise<void> {
  const open = currentPayment(await loadPayments(admin, orderId))
  if (!open || !OPEN_STATUSES.has(open.status)) throw new Error('no open payment to attach the invoice to')
  const { error } = await admin
    .from('payments')
    .update({
      provider: 'qpay_quickqr',
      external_reference: invoiceId,
      raw_payload: payload,
      updated_at: now(),
    })
    .eq('id', open.id)
  if (error) throw new Error(`could not attach invoice: ${error.message}`)
}

export async function loadPayment(admin: AdminClient, orderId: string): Promise<QpayPayment | null> {
  const data = currentPayment(await loadPayments(admin, orderId))
  if (!data) return null
  return {
    id: orderId,
    paymentAmountMnt: Number(data.amount_mnt),
    externalReference: data.external_reference,
    paymentStatus: data.status,
  }
}

export async function confirmQpay(
  admin: AdminClient,
  { orderId, invoiceId, amountMnt, payload }: { orderId: string; invoiceId: string; amountMnt: number; payload: unknown },
): Promise<void> {
  const { error } = await admin.rpc('confirm_payment_qpay', {
    order_id: orderId, invoice_id: invoiceId, amount_mnt: amountMnt, payload,
  })
  if (error) throw new Error(`could not confirm payment: ${error.message}`)
}

export async function noteMismatch(
  admin: AdminClient,
  { orderId, message }: { orderId: string; message: string },
): Promise<void> {
  const { data } = await admin
    .from('orders')
    .select('internal_note')
    .eq('id', orderId)
    .maybeSingle<{ internal_note: string | null }>()
  const stamped = `[${now()}] ${message}`
  const note = data?.internal_note ? `${data.internal_note}\n${stamped}` : stamped
  const { error } = await admin.from('orders').update({ internal_note: note }).eq('id', orderId)
  if (error) throw new Error(`could not record note: ${error.message}`)
}
