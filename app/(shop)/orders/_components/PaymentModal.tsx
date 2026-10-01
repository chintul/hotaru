'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { formatMnt } from '@/lib/format'
import { IconBank, IconCheck, IconClose, IconQr } from '@/components/Icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CopyRow from './CopyRow'
import type { Order, StoreSettings } from '@/lib/types'

export type PayMethod = 'qpay' | 'bank'

export type QpayState = 'idle' | 'loading' | 'ready' | 'error'

export type PaymentCheckState = 'idle' | 'checking' | 'pending' | 'failed'

export interface QpayDeeplink {
  name?: string | null
  description?: string | null
  logo?: string | null
  link: string
}

export interface QpayInvoice {
  invoiceId?: string
  qrImage?: string | null
  qrText?: string | null
  urls?: QpayDeeplink[] | null
}

interface PaymentModalProps {
  order: Order
  bank: StoreSettings | undefined
  method: PayMethod
  onMethod: (method: PayMethod) => void
  qpay: QpayInvoice | null
  qpayState: QpayState
  onMintQpay: () => void
  paymentCheck: PaymentCheckState
  onCheckPayment: () => void
  onClose: () => void
  onSubmitProof: (externalReference: string | null) => void
  submitting: boolean
  submitted: boolean
}

export default function PaymentModal({
  order,
  bank,
  method,
  onMethod,
  qpay,
  qpayState,
  onMintQpay,
  paymentCheck,
  onCheckPayment,
  onClose,
  onSubmitProof,
  submitting,
  submitted,
}: PaymentModalProps) {
  const paid = order.status !== 'awaiting_payment'
  const [reference, setReference] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const referenceId = useId()

  useEffect(() => {
    if (method === 'qpay' && qpayState === 'idle') onMintQpay()
  }, [method, qpayState, onMintQpay])

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        ref={panelRef}
        placement="bottom-on-phone"
        showCloseButton={false}
        aria-describedby={undefined}
        overlayProps={{ className: 'bg-foreground/35 backdrop-blur-[2px]' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          panelRef.current?.focus()
        }}
        className="flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-none sm:max-w-[460px] sm:p-0"
      >
        <DialogTitle className="sr-only">Төлбөр төлөх</DialogTitle>
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />

        <header className="flex items-start gap-3 px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">
              {order.orderNumber}
            </p>
            <p className="display mt-0.5 text-[26px] font-bold tabular-nums leading-none">
              {formatMnt(order.totalMnt)}
            </p>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-touch" className="-mr-1.5 -mt-1" aria-label="Хаах">
              <IconClose />
            </Button>
          </DialogClose>
        </header>

        {paid ? (
          <Confirmed onClose={onClose} />
        ) : (
          <>
            {bank?.qpayEnabled && (
              <div className="mx-5 mb-4 grid shrink-0 grid-cols-2 gap-1 rounded-full bg-shade p-1 sm:mx-6">
                <Tab active={method === 'qpay'} onClick={() => onMethod('qpay')} icon={<IconQr width="16" height="16" />}>
                  QPay
                </Tab>
                <Tab active={method === 'bank'} onClick={() => onMethod('bank')} icon={<IconBank width="16" height="16" />}>
                  Данс
                </Tab>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
              {method === 'qpay'
                ? (
                  <QpayPanel
                    qpay={qpay}
                    state={qpayState}
                    onRetry={onMintQpay}
                    onBank={() => onMethod('bank')}
                    check={paymentCheck}
                    onCheck={onCheckPayment}
                  />
                )
                : <BankPanel bank={bank} order={order} />}

              <div className="mt-5 border-t border-line pt-4">
                {method === 'qpay' ? null : submitted ? (
                  <p className="rounded-2xl bg-mint px-4 py-3 text-[13px] text-mint-ink">
                    Мэдэгдэл хүлээн авлаа. Төлбөр баталгаажмагц танд имэйл илгээнэ.
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); onSubmitProof(reference.trim() || null) }}
                  >
                    <Label
                      className="text-[11px] font-semibold uppercase leading-normal tracking-[.6px] text-ink-faint"
                      htmlFor={referenceId}
                    >
                      Гүйлгээний дугаар (заавал биш)
                    </Label>
                    <Input
                      id={referenceId}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Жишээ: 2401159876"
                      className="mt-2 h-12 rounded-2xl bg-paper-warm px-4 text-[14px] md:text-[14px]"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-3 w-full rounded-full bg-ink-strong px-5 py-3.5 text-[13px] font-bold uppercase tracking-[.7px] text-paper transition-opacity hover:opacity-85 disabled:opacity-40"
                    >
                      {submitting ? 'Илгээж байна…' : 'Төлбөр шилжүүлсэн'}
                    </button>
                  </form>
                )}

                <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-ink-faint">
                  <span aria-hidden className="relative grid h-2 w-2 place-items-center">
                    <span className="o-ping absolute h-2 w-2 rounded-full bg-mint-ink" />
                    <span className="h-2 w-2 rounded-full bg-mint-ink" />
                  </span>
                  Төлбөрийг автоматаар шалгаж байна
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface TabProps {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}

function Tab({ active, onClick, icon, children }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-[12px] font-semibold uppercase tracking-[.5px] transition-colors ${
        active ? 'bg-paper text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-ink-faint hover:text-ink-soft'
      }`}
    >
      {icon}{children}
    </button>
  )
}

interface QpayPanelProps {
  qpay: QpayInvoice | null
  state: QpayState
  onRetry: () => void
  onBank: () => void
  check: PaymentCheckState
  onCheck: () => void
}

const CHECK_MESSAGE: Partial<Record<PaymentCheckState, string>> = {
  pending: 'Төлбөр хараахан орж ирээгүй байна. Төлсөн бол хэдэн секунд хүлээгээд дахин шалгана уу.',
  failed: 'Шалгаж чадсангүй. Дахин оролдоно уу.',
}

function QpayPanel({ qpay, state, onRetry, onBank, check, onCheck }: QpayPanelProps) {
  if (state === 'error') {
    return (
      <div className="rounded-2xl bg-blush px-4 py-5 text-center">
        <p className="text-[13px] font-semibold text-blush-ink">QPay түр ажиллахгүй байна</p>
        <p className="mt-1 text-[13px] text-ink-soft">Дахин оролдох эсвэл дансаар шилжүүлж болно.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={onRetry} className="rounded-full border border-ink px-4 py-2 text-[12px] font-semibold uppercase tracking-[.5px]">
            Дахин оролдох
          </button>
          <button onClick={onBank} className="rounded-full bg-ink-strong px-4 py-2 text-[12px] font-semibold uppercase tracking-[.5px] text-paper">
            Дансаар төлөх
          </button>
        </div>
      </div>
    )
  }

  if (state !== 'ready' || !qpay?.qrImage) {
    return (
      <div className="flex flex-col items-center">
        <div className="o-skeleton h-[220px] w-[220px] rounded-[22px]" />
        <p className="mt-4 text-[13px] text-ink-faint">QR код бэлтгэж байна…</p>
      </div>
    )
  }

  const src = qpay.qrImage.startsWith('data:') ? qpay.qrImage : `data:image/png;base64,${qpay.qrImage}`

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-[22px] border border-line bg-paper p-3">
        <img src={src} alt="QPay QR код" className="h-[200px] w-[200px] rounded-lg" />
      </div>
      <p className="mt-4 text-center text-[13px] text-ink-soft">
        Банкны аппаараа уншуулна уу. Төлбөр орсон даруйд захиалга автоматаар баталгаажна.
      </p>

      <Button
        type="button"
        variant="solid"
        size="cta"
        onClick={onCheck}
        disabled={check === 'checking'}
        className="mt-5 w-full rounded-full"
      >
        {check === 'checking' ? 'Шалгаж байна…' : 'Төлбөр шалгах'}
      </Button>
      {CHECK_MESSAGE[check] && (
        <p role="status" className="mt-3 text-center text-[13px] text-ink-soft">{CHECK_MESSAGE[check]}</p>
      )}

      {qpay.urls && qpay.urls.length > 0 && (
        <div className="mt-5 w-full lg:hidden">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">
            Эсвэл аппаа сонгоно уу
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {qpay.urls.map((u) => (
              <a
                key={u.link}
                href={u.link}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-line px-1.5 py-2.5 transition-colors hover:border-ink"
              >
                {u.logo ? (
                  <img src={u.logo} alt="" width="26" height="26" className="h-[26px] w-[26px] rounded-lg object-contain"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                ) : (
                  <span aria-hidden className="grid h-[26px] w-[26px] place-items-center rounded-lg bg-shade text-[11px]">
                    {u.name?.charAt(0)}
                  </span>
                )}
                <span className="w-full truncate text-center text-[10px] leading-tight text-ink-soft">{u.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BankPanel({ bank, order }: { bank: StoreSettings | undefined; order: Order }) {
  return (
    <div className="space-y-2">
      <CopyRow label="Банк" value={bank?.bankName} />
      <CopyRow label="Дансны дугаар" value={bank?.bankAccountNumber} mono />
      <CopyRow label="Хүлээн авагч" value={bank?.bankAccountName} />
      <CopyRow label="Шилжүүлэх дүн" value={formatMnt(order.totalMnt)} mono />
      <CopyRow label="Гүйлгээний утга" value={order.orderNumber} mono accent />
      {bank?.paymentInstructions && (
        <p className="pt-2 text-[13px] leading-relaxed text-ink-soft">{bank.paymentInstructions}</p>
      )}
    </div>
  )
}

function Confirmed({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-6 pb-8 pt-2 text-center">
      <span className="o-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint text-mint-ink">
        <IconCheck width="30" height="30" strokeWidth={2.2} />
      </span>
      <p className="mt-4 text-[17px] font-semibold">Төлбөр баталгаажлаа</p>
      <p className="mt-1.5 text-[13px] text-ink-soft">
        Баярлалаа! Захиалгыг тань бэлтгэж эхэллээ.
      </p>
      <button
        onClick={onClose}
        className="mt-6 w-full rounded-full bg-ink-strong px-5 py-3.5 text-[13px] font-bold uppercase tracking-[.7px] text-paper transition-opacity hover:opacity-85"
      >
        Захиалга харах
      </button>
    </div>
  )
}
