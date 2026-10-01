"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  ORDER_DETAIL,
  SET_UPFRONT_AMOUNT,
  SUBMIT_PAYMENT_PROOF,
} from "@/lib/queries";
import {
  orderStatusLabel,
  formatAddress,
  formatDate,
  formatMnt,
  firstNode,
  nodes,
  parseJson,
  toNumber,
} from "@/lib/format";
import { useSession } from "@/components/useSession";
import ProductImage from "@/components/ProductImage";
import PreorderTag from "@/components/PreorderTag";
import {
  IconBank,
  IconChevronLeft,
  IconClock,
  IconQr,
  IconTruck,
} from "@/components/Icons";
import AmountChooser from "../_components/AmountChooser";
import OrderSkeleton from "../_components/OrderSkeleton";
import OrderTrail, { trailApplies } from "../_components/OrderTrail";
import PaymentModal from "../_components/PaymentModal";
import type {
  PayMethod,
  QpayInvoice,
  QpayState,
  PaymentCheckState,
} from "../_components/PaymentModal";
import useCountdown, { paymentDeadline } from "../_components/useCountdown";
import {
  STAGE_TITLE,
  dueNow,
  hasBalance,
  isPreorderOrder,
  minUpfront,
  payStage,
} from "../_components/payStage";
import type { PayStage } from "../_components/payStage";
import type {
  AddressSnapshot,
  Connection,
  Order,
  OrderStatus,
  StoreSettings,
} from "@/lib/types";

interface OrderDetailData {
  orderCollection: Connection<Order> | null;
  storeSettingsCollection: Connection<StoreSettings> | null;
}

interface SetUpfrontData {
  setUpfrontAmount: Order | null;
}

interface SetUpfrontVars {
  orderId: string;
  amountMnt: string;
}

function upfrontErrorMessage(e: unknown, min: string): string {
  const message = e instanceof Error ? e.message : "";
  if (message.includes("amount must be between")) {
    return `Хамгийн багадаа ${min} төлөх боломжтой.`;
  }
  if (message.includes("can only change before payment")) {
    return "Төлбөр аль хэдийн эхэлсэн тул дүнг өөрчлөх боломжгүй.";
  }
  return "Дүн хадгалахад алдаа гарлаа. Дахин оролдоно уу.";
}

type Tone = "wait" | "good" | "move" | "stop";

const STATUS_TONE: Record<OrderStatus, Tone> = {
  awaiting_payment: "wait",
  deposit_paid: "move",
  awaiting_balance: "wait",
  paid: "good",
  packed: "move",
  shipped: "move",
  delivered: "good",
  cancelled: "stop",
  refunded: "stop",
  oversold: "stop",
};

const STATUS_NOTE: Record<OrderStatus, readonly [note: string, emoji: string]> = {
  awaiting_payment: ["Төлбөрөө хүлээж байна", "🕰️"],
  deposit_paid: ["Урьдчилгаа баталгаажлаа, бараа ирэхийг хүлээж байна", "🌱"],
  awaiting_balance: ["Бараа тань ирлээ. Үлдэгдлээ төлмөгц хүргэнэ", "🎁"],
  paid: ["Төлбөр баталгаажлаа, баярлалаа", "🎀"],
  packed: ["Захиалга тань савлагдлаа", "📦"],
  shipped: ["Хүргэлтэд гарсан", "🚚"],
  delivered: ["Хүргэгдсэн, сайхан хэрэглээрэй", "💛"],
  cancelled: ["Захиалга цуцлагдсан", "🥀"],
  refunded: ["Төлбөр буцаагдсан", "↩️"],
  oversold: ["Нөөц хүрэлцээгүй", "⚠️"],
};

export default function OrderPage({
  params,
}: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = use(params);
  const { isAuthenticated, ready, user } = useSession();
  const { data, loading, refetch } = useQuery<OrderDetailData>(ORDER_DETAIL, {
    variables: { orderNumber, profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
  });
  const [submitProof, { loading: submitting }] =
    useMutation(SUBMIT_PAYMENT_PROOF);
  const [doneStage, setDoneStage] = useState<PayStage | null>(null);
  const [openedStage, setOpenedStage] = useState<PayStage | null>(null);
  const [amountChosen, setAmountChosen] = useState(false);
  const [changingAmount, setChangingAmount] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [setUpfront, { loading: savingAmount }] = useMutation<
    SetUpfrontData,
    SetUpfrontVars
  >(SET_UPFRONT_AMOUNT);

  const [qpay, setQpay] = useState<QpayInvoice | null>(null);
  const [qpayState, setQpayState] = useState<QpayState>("idle");
  const [paymentCheck, setPaymentCheck] = useState<PaymentCheckState>("idle");
  const [method, setMethod] = useState<PayMethod | null>(null);

  const order = firstNode(data?.orderCollection);
  const bank = firstNode(data?.storeSettingsCollection);
  const items = nodes(order?.orderItemCollection);
  const address: AddressSnapshot = parseJson(order?.shippingAddress);

  const stage = payStage(order);
  const submitted =
    (stage !== null && doneStage === stage) ||
    order?.paymentStatus === "submitted";
  const deadline = useCountdown(
    order?.status === "awaiting_payment"
      ? paymentDeadline(order, bank?.paymentDeadlineHours)
      : null,
  );

  const choosingAmount =
    stage === "deposit" && !submitted && (!amountChosen || changingAmount);

  const resetQpay = () => {
    setQpay(null);
    setQpayState("idle");
    setPaymentCheck("idle");
  };

  const openPayment = (next: PayMethod) => {
    if (stage && openedStage !== stage) {
      setOpenedStage(stage);
      resetQpay();
    }
    setMethod(next);
  };

  const confirmAmount = async (amount: number) => {
    if (!order) return;
    setAmountError(null);
    try {
      if (amount !== dueNow(order, "deposit")) {
        await setUpfront({
          variables: { orderId: order.id, amountMnt: String(amount) },
        });
        resetQpay();
        await refetch();
      }
      setAmountChosen(true);
      setChangingAmount(false);
    } catch (e) {
      setAmountError(upfrontErrorMessage(e, formatMnt(minUpfront(order))));
    }
  };

  const changeAmount = () => {
    setMethod(null);
    setAmountError(null);
    setChangingAmount(true);
  };

  const orderId = order?.id;
  const mintQpay = async () => {
    if (!orderId) return;
    setQpayState("loading");
    try {
      const res = await fetch("/api/payments/qpay/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setQpay((await res.json()) as QpayInvoice);
      setQpayState("ready");
    } catch {
      setQpayState("error");
    }
  };

  const checkPayment = async () => {
    setPaymentCheck("checking");
    try {
      const result = await refetch();
      const latest = firstNode(result.data?.orderCollection);
      setPaymentCheck(
        latest && payStage(latest) === openedStage ? "pending" : "idle",
      );
    } catch {
      setPaymentCheck("failed");
    }
  };

  const watching = stage !== null && (method !== null || qpayState === "ready");
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(id);
  }, [watching, refetch]);

  if (!ready || (loading && !order)) return <OrderSkeleton />;

  if (!isAuthenticated) {
    return (
      <Empty
        emoji="🔑"
        title="Нэвтэрч орно уу"
        body="Захиалгаа харахын тулд нэвтэрнэ үү."
        href={`/login?next=/orders/${orderNumber}`}
        cta="Нэвтрэх"
      />
    );
  }
  if (!order) {
    return (
      <Empty
        emoji="🔍"
        title="Захиалга олдсонгүй"
        body="Энэ дугаартай захиалга таны бүртгэлд алга байна."
        href="/orders"
        cta="Бүх захиалга"
      />
    );
  }

  const [note, noteEmoji] = (order.status && STATUS_NOTE[order.status]) || ["", ""];
  const count = items.reduce((n, i) => n + (i.quantity ?? 0), 0);
  const preorder = isPreorderOrder(order);
  const eta = items.find((i) => i.isPreorder && i.preorderEta)?.preorderEta;
  const modalStage = openedStage ?? stage;

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink"
      >
        <IconChevronLeft width="16" height="16" /> Бүх захиалга
      </Link>

      <header className="o-card o-card-warm fade-up mt-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="o-chip" data-tone={order.status ? STATUS_TONE[order.status] : undefined}>
            {orderStatusLabel(order.status)}
          </span>
          <span className="text-[12px] text-ink-faint">
            {formatDate(order.placedAt)}
          </span>
        </div>
        <h1 className="display mt-3 text-[clamp(1.7rem,5vw,2.4rem)] tabular-nums">
          {order.orderNumber}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          {note} <span aria-hidden>{noteEmoji}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-4 text-[13px] text-ink-soft">
          <span>{count} ширхэг бараа</span>
          <span className="font-semibold text-ink tabular-nums">
            {formatMnt(order.totalMnt)}
          </span>
        </div>
      </header>

      {trailApplies(order.status) && (
        <section className="o-card mt-4 px-3 py-6 sm:px-6">
          <OrderTrail order={order} />
        </section>
      )}

      {order.status === "oversold" && (
        <Banner tone="stop" title="Нөөц хүрэлцээгүй">
          Уучлаарай, таны төлбөр баталгаажсан ч бараа дууссан байна. Бид тантай
          холбогдож төлбөрийг буцаана.
        </Banner>
      )}
      {order.status === "cancelled" && (
        <Banner tone="stop" title="Захиалга цуцлагдсан">
          Асуух зүйл байвал бидэнтэй холбогдоорой.
        </Banner>
      )}
      {order.status === "refunded" && (
        <Banner tone="stop" title="Төлбөр буцаагдсан">
          Мөнгө таны данс руу 1–3 ажлын өдөрт орно.
        </Banner>
      )}

      {order.status === "deposit_paid" && (
        <Banner tone="move" title="Бараа тань замдаа явж байна">
          Урьдчилгаа тань баталгаажлаа, баярлалаа.
          {eta ? ` Ирэх хугацаа: ${eta}.` : ""} Бараа ирмэгц бид үлдэгдлийн
          нэхэмжлэл илгээж, имэйлээр мэдэгдэнэ. Үлдэгдэл төлөгдсөний дараа бүх
          барааг тань хамт хүргэнэ.
        </Banner>
      )}

      {stage && bank && (
        <section className="o-card fade-up mt-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">
                {choosingAmount ? "Одоо хэдийг төлөх вэ?" : STAGE_TITLE[stage]}
              </p>
              {choosingAmount ? (
                <p className="mt-1 text-[13px] text-ink-soft">
                  Нийт дүн{" "}
                  <span className="font-semibold text-ink tabular-nums">
                    {formatMnt(order.totalMnt)}
                  </span>
                </p>
              ) : (
                <p className="display mt-1 text-[clamp(1.5rem,4vw,2rem)] tabular-nums">
                  {formatMnt(dueNow(order, stage))}
                </p>
              )}
            </div>
            {deadline && (
              <span
                className="o-chip"
                data-tone={deadline.expired ? "stop" : "wait"}
              >
                <IconClock />
                {deadline.expired
                  ? "Хугацаа дууссан"
                  : `${deadline.text} үлдсэн`}
              </span>
            )}
          </div>

          {stage === "balance" && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Бараа тань ирлээ. Үлдэгдлээ төлмөгц бүх барааг тань хамт савлаж
              хүргэнэ.
            </p>
          )}
          {choosingAmount && (
            <div className="mt-4">
              <AmountChooser
                key={String(order.upfrontMnt)}
                min={minUpfront(order)}
                total={toNumber(order.totalMnt)}
                initial={dueNow(order, "deposit")}
                busy={savingAmount}
                error={amountError}
                onConfirm={confirmAmount}
                onCancel={
                  amountChosen ? () => setChangingAmount(false) : undefined
                }
              />
            </div>
          )}
          {stage === "deposit" && !choosingAmount && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 text-[13px] leading-relaxed text-ink-soft">
              <p>
                {hasBalance(order)
                  ? `Бараа ирэхэд төлөх үлдэгдэл: ${formatMnt(order.balanceMnt)}`
                  : "Бүтэн дүнгээр төлж байна"}
              </p>
              {!submitted && (
                <button
                  type="button"
                  onClick={changeAmount}
                  className="link-underline -my-2 min-h-11 font-semibold text-ink"
                >
                  Дүн өөрчлөх
                </button>
              )}
            </div>
          )}
          {stage === "deposit" && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              Урьдчилгаа төлбөр буцаагдахгүйг анхаарна уу.
            </p>
          )}

          {submitted && (
            <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-[13px] text-mint-ink">
              Мэдэгдэл хүлээн авлаа. Төлбөр баталгаажмагц танд имэйл илгээнэ.
            </p>
          )}

          {!choosingAmount && (
          <>
          <div
            className={`mt-5 grid gap-3 ${bank.qpayEnabled ? "sm:grid-cols-2" : ""}`}
          >
            {bank.qpayEnabled && (
              <PayPick
                icon={<IconQr />}
                tint="bg-sky text-sky-ink"
                title="Qpay"
                sub="Банкны аппаараа уншуулах"
                onClick={() => openPayment("qpay")}
              />
            )}
            <PayPick
              icon={<IconBank />}
              tint="bg-cream text-cream-ink"
              title="Дансаар шилжүүлэх"
              sub={bank.bankName || "Дансны мэдээлэл харах"}
              onClick={() => openPayment("bank")}
            />
          </div>

          <p className="mt-4 text-[12px] text-ink-faint">
            Гүйлгээний утга:{" "}
            <span className="font-semibold text-ink">{order.orderNumber}</span>
            {stage !== "balance" && bank.paymentDeadlineHours
              ? ` · ${bank.paymentDeadlineHours} цагийн дотор`
              : ""}
          </p>
          </>
          )}
        </section>
      )}

      {preorder && <PaymentBreakdown order={order} />}

      <section className="o-card mt-4 overflow-hidden">
        <p className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint sm:px-6">
          Бараа
        </p>
        <ul className="mt-3 divide-y divide-line-soft px-5 sm:px-6">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-4">
              <span className="relative h-16 w-16 shrink-0">
                <span className="block h-full w-full overflow-hidden rounded-2xl bg-paper-warm">
                  <ProductImage
                    filePath={i.imagePath}
                    alt={i.productTitle}
                    seed={i.sku || i.productTitle || undefined}
                    sizes="64px"
                  />
                </span>
                {(i.quantity ?? 0) > 1 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-semibold text-paper">
                    {i.quantity}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[14px] font-medium">
                  {i.productTitle}
                </span>
                {i.variantLabel && (
                  <span className="mt-1 inline-block rounded-full bg-shade px-2.5 py-0.5 text-[11px] text-ink-soft">
                    {i.variantLabel}
                  </span>
                )}
                <span className="mt-1 block text-[12px] text-ink-faint tabular-nums">
                  {formatMnt(i.unitPriceMnt)} × {i.quantity}
                </span>
                {i.isPreorder && (
                  <PreorderTag eta={i.preorderEta} className="mt-1.5" />
                )}
              </span>
              <span className="shrink-0 text-[14px] font-medium tabular-nums">
                {formatMnt(i.lineTotalMnt)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-1 space-y-2 bg-paper-warm px-5 py-5 text-[13px] sm:px-6">
          <Row label="Барааны дүн" value={formatMnt(order.subtotalMnt)} />
          {toNumber(order.discountMnt) > 0 && (
            <Row
              label="Хөнгөлөлт"
              value={`−${formatMnt(order.discountMnt)}`}
              accent
            />
          )}
          <Row
            label="Хүргэлт"
            value={
              toNumber(order.deliveryMnt) === 0
                ? "Үнэгүй"
                : formatMnt(order.deliveryMnt)
            }
          />
          <div className="flex justify-between border-t border-line pt-3 text-[16px] font-semibold">
            <dt>Нийт</dt>
            <dd className="tabular-nums">{formatMnt(order.totalMnt)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="o-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">
            Хүргэлтийн хаяг
          </p>
          <p className="mt-3 text-[14px] font-medium">
            {address.recipient_name}
          </p>
          <p className="text-[13px] text-ink-soft tabular-nums">
            {address.phone}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {formatAddress(address)}
            {address.landmark_note ? (
              <>
                <br />
                {address.landmark_note}
              </>
            ) : null}
          </p>
        </section>

        <section className="o-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">
            Хүргэлт
          </p>
          <p className="mt-3 flex items-center gap-2 text-[14px] font-medium">
            <IconTruck className="text-ink-soft" />
            {order.deliveryMethod?.name ?? "—"}
          </p>
          {order.trackingNumber ? (
            <p className="mt-2 text-[13px] text-ink-soft">
              Хяналтын дугаар:{" "}
              <span className="font-medium text-ink tabular-nums">
                {order.trackingNumber}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-faint">
              Хүргэлтэд гарахад хяналтын дугаар энд харагдана.
            </p>
          )}
          {order.customerNote && (
            <p className="mt-3 rounded-2xl bg-paper-warm px-3.5 py-2.5 text-[13px] text-ink-soft">
              “{order.customerNote}”
            </p>
          )}
        </section>
      </div>

      <p className="mt-8 text-center text-[13px] text-ink-faint">
        Асуух зүйл байна уу?{" "}
        <Link href="/contact" className="link-underline text-ink-soft">
          Бидэнтэй холбогдох
        </Link>
      </p>

      {method && bank && modalStage && (
        <PaymentModal
          order={order}
          stage={modalStage}
          amount={dueNow(order, modalStage)}
          onChangeAmount={
            modalStage === "deposit" && !submitted ? changeAmount : undefined
          }
          bank={bank}
          method={method}
          onMethod={setMethod}
          qpay={qpay}
          qpayState={qpayState}
          onMintQpay={mintQpay}
          paymentCheck={paymentCheck}
          onCheckPayment={checkPayment}
          onClose={() => setMethod(null)}
          onSubmitProof={async (externalReference) => {
            await submitProof({
              variables: { orderId: order.id, externalReference },
            });
            setDoneStage(modalStage);
            refetch();
          }}
          submitting={submitting}
          submitted={submitted}
        />
      )}
    </div>
  );
}

type StepState = "paid" | "checking" | "due" | "later";

const STEP_BADGE: Record<StepState, { tone: Tone; text: string }> = {
  paid: { tone: "good", text: "✓ Төлсөн" },
  checking: { tone: "move", text: "Шалгаж байна" },
  due: { tone: "wait", text: "Төлөх" },
  later: { tone: "move", text: "Бараа ирэхэд" },
};

const SETTLED: ReadonlySet<OrderStatus> = new Set([
  "paid",
  "packed",
  "shipped",
  "delivered",
]);

function PaymentBreakdown({ order }: { order: Order }) {
  const status = order.status;
  const submitted = order.paymentStatus === "submitted";
  const deposit: StepState =
    status === "awaiting_payment" ? (submitted ? "checking" : "due") : "paid";
  const balance: StepState =
    order.balancePaidAt || (status && SETTLED.has(status))
      ? "paid"
      : status === "awaiting_balance"
        ? submitted
          ? "checking"
          : "due"
        : "later";
  const closed =
    status === "cancelled" || status === "refunded" || status === "oversold";

  return (
    <section className="o-card mt-4 p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">
        Төлбөрийн хуваарь
      </p>
      <ul className="mt-3 divide-y divide-line-soft text-[14px]">
        <BreakdownRow
          title="Хамгийн бага урьдчилгаа"
          hint="Үүнээс багагүй төлнө"
          amount={formatMnt(minUpfront(order))}
          state={null}
          muted
        />
        <BreakdownRow
          title={hasBalance(order) ? "Урьдчилгаа" : "Бүтэн дүн"}
          hint="Таны сонгосон дүн"
          amount={formatMnt(order.upfrontMnt)}
          state={closed ? null : deposit}
        />
        {hasBalance(order) ? (
          <BreakdownRow
            title="Үлдэгдэл"
            hint={
              balance === "due" || balance === "checking"
                ? "Нэхэмжлэл ирсэн"
                : "Бараа ирэхэд"
            }
            amount={formatMnt(order.balanceMnt)}
            state={closed ? null : balance}
          />
        ) : (
          <li className="py-3 text-[13px] text-ink-soft">
            Бүтэн дүнгээр төлөх тул үлдэгдэл үлдэхгүй.
          </li>
        )}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-faint">
        Урьдчилгаа төлбөр буцаагдахгүй. Бүх бараа тань хамт, бүрэн төлөгдсөний
        дараа хүргэгдэнэ.
      </p>
    </section>
  );
}

interface BreakdownRowProps {
  title: string;
  hint: string;
  amount: string;
  state: StepState | null;
  muted?: boolean;
}

function BreakdownRow({
  title,
  hint,
  amount,
  state,
  muted = false,
}: BreakdownRowProps) {
  return (
    <li className={`flex items-center gap-3 py-3 ${muted ? "text-ink-soft" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-[12px] text-ink-faint">{hint}</span>
      </span>
      {state && (
        <span className="o-chip shrink-0" data-tone={STEP_BADGE[state].tone}>
          {STEP_BADGE[state].text}
        </span>
      )}
      <span className="w-[92px] shrink-0 text-right font-medium tabular-nums">
        {amount}
      </span>
    </li>
  );
}

interface PayPickProps {
  icon: ReactNode;
  tint: string;
  title: string;
  sub: string;
  onClick: () => void;
}

function PayPick({ icon, tint, title, sub, onClick }: PayPickProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="o-pick flex items-center gap-3.5 sm:block"
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tint}`}
      >
        {icon}
      </span>
      <span className="min-w-0 sm:mt-3 sm:block">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
          {sub}
        </span>
      </span>
    </button>
  );
}

interface BannerProps {
  tone: Tone;
  title: string;
  children: ReactNode;
}

function Banner({ tone, title, children }: BannerProps) {
  const bg =
    tone === "stop" ? "bg-blush" : tone === "move" ? "bg-sky" : "bg-cream";
  const ink =
    tone === "stop"
      ? "text-blush-ink"
      : tone === "move"
        ? "text-sky-ink"
        : "text-cream-ink";
  return (
    <section className={`mt-4 rounded-[20px] ${bg} p-5 sm:p-6`}>
      <p className={`text-[14px] font-semibold ${ink}`}>{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
        {children}
      </p>
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
  accent?: boolean;
}

function Row({ label, value, accent = false }: RowProps) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`tabular-nums ${accent ? "text-mint-ink" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

interface EmptyProps {
  emoji: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}

function Empty({ emoji, title, body, href, cta }: EmptyProps) {
  return (
    <div className="mx-auto max-w-[520px] px-5 py-20 text-center">
      <div className="o-card o-card-warm px-6 py-12">
        <span aria-hidden className="text-[34px]">
          {emoji}
        </span>
        <p className="mt-3 text-[16px] font-semibold">{title}</p>
        <p className="mt-1.5 text-[13px] text-ink-soft">{body}</p>
        <Link
          href={href}
          className="mt-6 inline-block rounded-full bg-ink-strong px-6 py-3 text-[12px] font-bold uppercase tracking-[.7px] text-paper transition-opacity hover:opacity-85"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
