import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderNotification } from '../../lib/email/templates.ts'

const PAYLOAD = {
  order_number: 'HTR-000099',
  status: 'awaiting_payment',
  total_mnt: '226000',
  upfront_mnt: '156000',
  balance_mnt: '70000',
  subtotal_mnt: '221000',
  delivery_mnt: '5000',
  items: [
    { title: 'Цүнх', quantity: 1, line_total_mnt: '100000', is_preorder: true, preorder_eta: '2–3 долоо хоног' },
    { title: 'Хавчаар', quantity: 1, line_total_mnt: '121000', is_preorder: false },
  ],
  bank: { bank_name: 'Хаан банк', account_number: '5000', account_name: 'HOTARU' },
}

test('the placed email asks only for the upfront amount and states the terms', () => {
  const { html } = renderNotification('order_placed_customer', PAYLOAD)
  assert.match(html, /Хамгийн бага урьдчилгаа/)
  assert.match(html, /156,000|156 000|156000/)
  assert.match(html, /буцаагдахгүй/)
  assert.match(html, /Урьдчилсан захиалга · ирэх хугацаа 2–3 долоо хоног/)
})

test('the balance request asks for the remainder', () => {
  const { subject, html } = renderNotification('balance_requested_customer', { ...PAYLOAD, status: 'awaiting_balance' })
  assert.match(subject, /үлдэгдэл/)
  assert.match(html, /Үлдэгдэл/)
  assert.match(html, /70,000|70 000|70000/)
})

test('an order without pre-order lines keeps the plain wording', () => {
  const { html } = renderNotification('order_placed_customer', { ...PAYLOAD, balance_mnt: '0', upfront_mnt: '226000' })
  assert.doesNotMatch(html, /Урьдчилгаа/)
  assert.match(html, /Доорх дансанд/)
})
