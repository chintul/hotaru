/**
 * Every database read and write the QPay feature performs, one function each.
 *
 * Kept separate from orders.js so the orchestration can be tested without a
 * database, and so the exact shape of what QPay is allowed to touch is
 * readable in one place.
 */

/** The order, its recorded price, and the settings an invoice needs. */
export async function loadOrderForInvoice(admin, orderId) {
  const { data: order, error } = await admin
    .from('orders')
    .select('id, order_number, total_mnt, payment_status, payments(amount_mnt, external_reference)')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw new Error(`could not load order: ${error.message}`)
  if (!order) return { order: null, settings: null }

  const { data: settings, error: sErr } = await admin
    .from('store_settings')
    .select('qpay_enabled, qpay_merchant_id, bank_code, bank_account_number, bank_account_name')
    .limit(1)
    .maybeSingle()
  if (sErr) throw new Error(`could not load store settings: ${sErr.message}`)

  const payment = order.payments?.[0] ?? null
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

/**
 * Record the invoice against the order's existing payment row.
 *
 * amount_mnt is deliberately not written: place_order set it from the order
 * total and it is the price the customer agreed to.
 */
export async function attachInvoice(admin, { orderId, invoiceId, payload }) {
  const { error } = await admin
    .from('payments')
    .update({
      provider: 'qpay_quickqr',
      external_reference: invoiceId,
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
  if (error) throw new Error(`could not attach invoice: ${error.message}`)
}

export async function loadPayment(admin, orderId) {
  const { data, error } = await admin
    .from('payments')
    .select('order_id, amount_mnt, external_reference, status')
    .eq('order_id', orderId)
    .maybeSingle()
  if (error) throw new Error(`could not load payment: ${error.message}`)
  if (!data) return null
  return {
    id: data.order_id,
    paymentAmountMnt: Number(data.amount_mnt),
    externalReference: data.external_reference,
    paymentStatus: data.status,
  }
}

export async function confirmQpay(admin, { orderId, invoiceId, amountMnt, payload }) {
  const { error } = await admin.rpc('confirm_payment_qpay', {
    order_id: orderId, invoice_id: invoiceId, amount_mnt: amountMnt, payload,
  })
  if (error) throw new Error(`could not confirm payment: ${error.message}`)
}

/** A mismatch is the owner's problem to resolve, so it must be visible to them. */
export async function noteMismatch(admin, { orderId, message }) {
  const { data } = await admin.from('orders').select('internal_note').eq('id', orderId).maybeSingle()
  const stamped = `[${new Date().toISOString()}] ${message}`
  const note = data?.internal_note ? `${data.internal_note}\n${stamped}` : stamped
  const { error } = await admin.from('orders').update({ internal_note: note }).eq('id', orderId)
  if (error) throw new Error(`could not record note: ${error.message}`)
}
