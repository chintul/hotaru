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
import { guideQuestions, GuideTipSetter, type GuideTip } from "@/components/guide/Guide";
import { useT, type Translate } from "@/lib/i18n";
import ProductImage from "@/components/ProductImage";
import PreorderTag from "@/components/PreorderTag";
import { PREORDER_ARRIVAL_DAYS } from "@/lib/preorder";
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
  STAGE_TITLE_EN,
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

function upfrontErrorMessage(e: unknown, min: string, t: Translate): string {
  const message = e instanceof Error ? e.message : "";
  if (message.includes("amount must be between")) {
    return t(`Хамгийн багадаа ${min} төлөх боломжтой.`, `The minimum you can pay is ${min}.`);
  }
  if (message.includes("can only change before payment")) {
    return t(
      "Төлбөр аль хэдийн эхэлсэн тул дүнг өөрчлөх боломжгүй.",
      "Payment has already started, so the amount can’t be changed.",
    );
  }
  return t(
    "Дүн хадгалахад алдаа гарлаа. Дахин оролдоно уу.",
    "Couldn’t save the amount. Please try again.",
  );
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

const STATUS_NOTE: Record<OrderStatus, readonly [note: string, en: string, emoji: string]> = {
  awaiting_payment: ["Төлбөрөө хүлээж байна", "Waiting for your payment", "🕰️"],
  deposit_paid: ["Урьдчилгаа баталгаажлаа, бараа ирэхийг хүлээж байна", "Deposit confirmed, waiting for your items to arrive", "🌱"],
  awaiting_balance: ["Бараа тань ирлээ. Үлдэгдлээ төлмөгц хүргэнэ", "Your items are here. We’ll deliver once the balance is paid", "🎁"],
  paid: ["Төлбөр баталгаажлаа, баярлалаа", "Payment confirmed, thank you", "🎀"],
  packed: ["Захиалга тань савлагдлаа", "Your order is packed", "📦"],
  shipped: ["Хүргэлтэд гарсан", "Out for delivery", "🚚"],
  delivered: ["Хүргэгдсэн, сайхан хэрэглээрэй", "Delivered, enjoy", "💛"],
  cancelled: ["Захиалга цуцлагдсан", "Order cancelled", "🥀"],
  refunded: ["Төлбөр буцаагдсан", "Payment refunded", "↩️"],
  oversold: ["Нөөц хүрэлцээгүй", "Out of stock", "⚠️"],
};

function orderGuideTip(order: Order, eta: string | null | undefined, t: Translate): GuideTip {
  const g = guideQuestions(t);
  const upfront = formatMnt(order.upfrontMnt);
  const balance = formatMnt(order.balanceMnt);
  switch (order.status) {
    case "awaiting_payment":
      return order.paymentStatus === "submitted"
        ? {
            lines: [
              t("Төлбөрийн мэдээллийг тань хүлээн авлаа.", "We’ve received your payment details."),
              t("Бид шалгаад удахгүй баталгаажуулна. Энэ хуудсыг хааж болно.", "We’ll check and confirm shortly. You can close this page."),
            ],
            questions: [g.confirm, g.cancel],
          }
        : {
            lines: [
              t("Захиалга тань бүртгэгдлээ.", "Your order is placed."),
              t(
                `Доорх QPay эсвэл дансаар ${upfront} төлөөд «Төлсөн» товчийг дарна уу. Бид шалгаад баталгаажуулна.`,
                `Pay ${upfront} by QPay or bank transfer below, then tap “I’ve paid”. We’ll check and confirm.`,
              ),
            ],
            questions: [g.pay, g.confirm, g.cancel],
          };
    case "deposit_paid":
      return {
        lines: [
          t("Урьдчилгаа тань баталгаажлаа.", "Your deposit is confirmed."),
          eta
            ? t(`Бараа ${eta} орчим ирнэ.`, `Your items should arrive around ${eta}.`)
            : t("Бараа ирэхэд бид танд мэдэгдэнэ.", "We’ll let you know when your items arrive."),
          t(`Ирэхэд үлдэгдэл ${balance}-ийг төлнө.`, `You’ll pay the ${balance} balance when they arrive.`),
        ],
        questions: [
          {
            q: t("Үлдэгдлээ хэзээ төлөх вэ?", "When do I pay the balance?"),
            a: [
              t("Бараа ирэхэд бид мэдэгдэнэ.", "We’ll let you know when your items arrive."),
              t(`Тэр үед энэ хуудаснаас ${balance}-ийг төлнө.`, `Then you pay ${balance} from this page.`),
            ],
          },
          g.cancel,
        ],
      };
    case "awaiting_balance":
      return {
        lines: [
          t("Бараа тань ирлээ.", "Your items have arrived."),
          t(`Үлдэгдэл ${balance}-ийг төлмөгц хүргэлтэд гаргана.`, `We’ll send them out as soon as the ${balance} balance is paid.`),
        ],
        questions: [g.pay, g.delivery],
      };
    case "paid":
    case "packed":
      return {
        lines: [
          t("Төлбөр баталгаажлаа.", "Payment confirmed."),
          t("Савлаад Улаанбаатарт ажлын 1–2 хоногт хүргэнэ.", "We’ll pack it and deliver in Ulaanbaatar within 1–2 working days."),
        ],
        questions: [g.delivery, g.cancel],
      };
    case "shipped":
      return {
        lines: [
          t("Захиалга тань замдаа явж байна.", "Your order is on its way."),
          t("Жолооч залгах тул утсаа ойрхон байлгаарай.", "The driver will call, so keep your phone nearby."),
        ],
        questions: [g.delivery, g.returns],
      };
    case "delivered":
      return {
        lines: [
          t("Хүргэгдсэн. Сайхан хэрэглээрэй!", "Delivered. Enjoy!"),
          t("Сэтгэгдэл үлдээвэл бусдад тус болно.", "Leaving a review helps other shoppers."),
        ],
        questions: [g.returns],
      };
    default:
      return {
        lines: [
          t(orderStatusLabel(order.status), orderStatusLabel(order.status, "en")) + ".",
          t("Асуух зүйл байвал бидэнтэй холбогдоорой.", "If you have any questions, get in touch."),
        ],
        link: g.contact,
        questions: [g.cancel],
      };
  }
}

export default function OrderPage({
  params,
}: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = use(params);
  const t = useT();
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
      setAmountError(upfrontErrorMessage(e, formatMnt(minUpfront(order)), t));
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
        title={t("Нэвтэрнэ үү", "Please log in")}
        body={t("Захиалгаа харахын тулд нэвтэрнэ үү.", "Log in to see your order.")}
        href={`/login?next=/orders/${orderNumber}`}
        cta={t("Нэвтрэх", "Log in")}
      />
    );
  }
  if (!order) {
    return (
      <Empty
        emoji="🔍"
        title={t("Захиалга олдсонгүй", "Order not found")}
        body={t(
          "Энэ дугаартай захиалга таны бүртгэлд алга байна.",
          "There’s no order with this number on your account.",
        )}
        href="/orders"
        cta={t("Бүх захиалга", "All orders")}
      />
    );
  }

  const [note, noteEn, noteEmoji] = (order.status && STATUS_NOTE[order.status]) || ["", "", ""];
  const count = items.reduce((n, i) => n + (i.quantity ?? 0), 0);
  const preorder = isPreorderOrder(order);
  const eta = items.find((i) => i.isPreorder && i.preorderEta)?.preorderEta;
  const modalStage = openedStage ?? stage;

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-12">
      <GuideTipSetter tip={orderGuideTip(order, eta, t)} />
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink"
      >
        <IconChevronLeft width="16" height="16" /> {t("Бүх захиалга", "All orders")}
      </Link>

      <header className="o-card o-card-warm fade-up mt-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="o-chip" data-tone={order.status ? STATUS_TONE[order.status] : undefined}>
            {t(orderStatusLabel(order.status), orderStatusLabel(order.status, "en"))}
          </span>
          <span className="text-[12px] text-ink-faint">
            {formatDate(order.placedAt)}
          </span>
        </div>
        <h1 className="display mt-3 text-[clamp(1.7rem,5vw,2.4rem)] tabular-nums">
          {order.orderNumber}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          {t(note, noteEn)} <span aria-hidden>{noteEmoji}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-4 text-[13px] text-ink-soft">
          <span>{t(`${count} ширхэг бараа`, count === 1 ? "1 item" : `${count} items`)}</span>
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
        <Banner tone="stop" title={t("Нөөц хүрэлцээгүй", "Out of stock")}>
          {t(
            "Уучлаарай, таны төлбөр баталгаажсан ч бараа дууссан байна. Бид тантай холбогдож төлбөрийг буцаана.",
            "Sorry, your payment was confirmed but the item has sold out. We’ll contact you and refund your payment.",
          )}
        </Banner>
      )}
      {order.status === "cancelled" && (
        <Banner tone="stop" title={t("Захиалга цуцлагдсан", "Order cancelled")}>
          {t("Асуух зүйл байвал бидэнтэй холбогдоорой.", "If you have any questions, get in touch.")}
        </Banner>
      )}
      {order.status === "refunded" && (
        <Banner tone="stop" title={t("Төлбөр буцаагдсан", "Payment refunded")}>
          {t(
            "Мөнгө таны дансанд ажлын 1–3 өдөрт орно.",
            "The money will reach your account within 1–3 working days.",
          )}
        </Banner>
      )}

      {order.status === "deposit_paid" && (
        <Banner tone="move" title={t("Бараа тань замдаа явж байна", "Your items are on their way")}>
          {t("Урьдчилгаа тань баталгаажлаа, баярлалаа.", "Your deposit is confirmed, thank you.")}
          {eta ? t(` Ирэх хугацаа: ${eta}.`, ` Expected arrival: ${eta}.`) : ""}{" "}
          {t(
            "Бараа ирмэгц бид үлдэгдлийн нэхэмжлэл илгээж, имэйлээр мэдэгдэнэ. Үлдэгдэл төлөгдсөний дараа бүх барааг тань хамт хүргэнэ.",
            "As soon as they arrive we’ll send the balance invoice and let you know by email. Once the balance is paid, we’ll deliver everything together.",
          )}
        </Banner>
      )}

      {stage && bank && (
        <section className="o-card fade-up mt-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-ink-faint">
                {choosingAmount
                  ? t("Одоо хэдэн төгрөг төлөх вэ?", "How much would you like to pay now?")
                  : t(STAGE_TITLE[stage], STAGE_TITLE_EN[stage])}
              </p>
              {choosingAmount ? (
                <p className="mt-1 text-[13px] text-ink-soft">
                  {t("Нийт дүн", "Total")}{" "}
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
                  ? t("Хугацаа дууссан", "Time’s up")
                  : t(`${deadline.text} үлдсэн`, `${deadline.text} left`)}
              </span>
            )}
          </div>

          {stage === "balance" && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              {t(
                "Бараа тань ирлээ. Үлдэгдлээ төлмөгц бүх барааг тань хамт савлаж хүргэнэ.",
                "Your items have arrived. Once the balance is paid, we’ll pack and deliver everything together.",
              )}
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
                  ? t(
                      `Бараа ирэхэд төлөх үлдэгдэл: ${formatMnt(order.balanceMnt)}`,
                      `Balance due when your items arrive: ${formatMnt(order.balanceMnt)}`,
                    )
                  : t("Бүтэн дүнгээр төлж байна", "Paying in full")}
              </p>
              {!submitted && (
                <button
                  type="button"
                  onClick={changeAmount}
                  className="link-underline -my-2 min-h-11 font-semibold text-ink"
                >
                  {t("Дүн өөрчлөх", "Change amount")}
                </button>
              )}
            </div>
          )}
          {stage === "deposit" && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {t("Урьдчилгаа төлбөр буцаагдахгүй гэдгийг анхаарна уу.", "Please note the deposit is non-refundable.")}
            </p>
          )}

          {submitted && (
            <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-[13px] text-mint-ink">
              {t(
                "Мэдэгдэл хүлээн авлаа. Төлбөр баталгаажмагц танд имэйл илгээнэ.",
                "Got it. We’ll email you once the payment is confirmed.",
              )}
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
                sub={t("Банкны аппаараа уншуулах", "Scan with your bank app")}
                onClick={() => openPayment("qpay")}
              />
            )}
            <PayPick
              icon={<IconBank />}
              tint="bg-cream text-cream-ink"
              title={t("Дансаар шилжүүлэх", "Bank transfer")}
              sub={bank.bankName || t("Дансны мэдээлэл харах", "See account details")}
              onClick={() => openPayment("bank")}
            />
          </div>

          <p className="mt-4 text-[12px] text-ink-faint">
            {t("Гүйлгээний утга:", "Payment reference:")}{" "}
            <span className="font-semibold text-ink">{order.orderNumber}</span>
            {stage !== "balance" && bank.paymentDeadlineHours
              ? t(
                  ` · ${bank.paymentDeadlineHours} цагийн дотор`,
                  ` · within ${bank.paymentDeadlineHours} hours`,
                )
              : ""}
          </p>
          </>
          )}
        </section>
      )}

      {preorder && <PaymentBreakdown order={order} />}

      <section className="o-card mt-4 overflow-hidden">
        <p className="px-5 pt-5 text-[11px] font-semibold text-ink-faint sm:px-6">
          {t("Бараа", "Items")}
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
          <Row label={t("Барааны дүн", "Subtotal")} value={formatMnt(order.subtotalMnt)} />
          {toNumber(order.discountMnt) > 0 && (
            <Row
              label={t("Хөнгөлөлт", "Discount")}
              value={`−${formatMnt(order.discountMnt)}`}
              accent
            />
          )}
          <Row
            label={t("Хүргэлт", "Delivery")}
            value={
              toNumber(order.deliveryMnt) === 0
                ? t("Үнэгүй", "Free")
                : formatMnt(order.deliveryMnt)
            }
          />
          <div className="flex justify-between border-t border-line pt-3 text-[16px] font-semibold">
            <dt>{t("Нийт", "Total")}</dt>
            <dd className="tabular-nums">{formatMnt(order.totalMnt)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="o-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold text-ink-faint">
            {t("Хүргэлтийн хаяг", "Delivery address")}
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
          <p className="text-[11px] font-semibold text-ink-faint">
            {t("Хүргэлт", "Delivery")}
          </p>
          <p className="mt-3 flex items-center gap-2 text-[14px] font-medium">
            <IconTruck className="text-ink-soft" />
            {order.deliveryMethod?.name ?? "—"}
          </p>
          {order.trackingNumber ? (
            <p className="mt-2 text-[13px] text-ink-soft">
              {t("Хяналтын дугаар:", "Tracking number:")}{" "}
              <span className="font-medium text-ink tabular-nums">
                {order.trackingNumber}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-faint">
              {t(
                "Хүргэлтэд гарахад хяналтын дугаар энд харагдана.",
                "Your tracking number will show here once it ships.",
              )}
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
        {t("Асуух зүйл байна уу?", "Have a question?")}{" "}
        <Link href="/contact" className="link-underline text-ink-soft">
          {t("Бидэнтэй холбогдох", "Contact us")}
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

const STEP_BADGE: Record<StepState, { tone: Tone; text: string; en: string }> = {
  paid: { tone: "good", text: "✓ Төлсөн", en: "✓ Paid" },
  checking: { tone: "move", text: "Шалгаж байна", en: "Checking" },
  due: { tone: "wait", text: "Төлөх", en: "Due" },
  later: { tone: "move", text: "Бараа ирэхэд", en: "On arrival" },
};

const SETTLED: ReadonlySet<OrderStatus> = new Set([
  "paid",
  "packed",
  "shipped",
  "delivered",
]);

function PaymentBreakdown({ order }: { order: Order }) {
  const t = useT();
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
      <p className="text-[11px] font-semibold text-ink-faint">
        {t("Төлбөрийн хуваарь", "Payment schedule")}
      </p>
      <ul className="mt-3 divide-y divide-line-soft text-[14px]">
        <BreakdownRow
          title={t("Хамгийн бага урьдчилгаа", "Minimum deposit")}
          hint={t("Үүнээс багагүй төлнө", "Pay at least this much")}
          amount={formatMnt(minUpfront(order))}
          state={null}
          muted
        />
        <BreakdownRow
          title={hasBalance(order) ? t("Урьдчилгаа", "Deposit") : t("Бүтэн дүн", "Full amount")}
          hint={t("Таны сонгосон дүн", "The amount you chose")}
          amount={formatMnt(order.upfrontMnt)}
          state={closed ? null : deposit}
        />
        {hasBalance(order) ? (
          <BreakdownRow
            title={t("Үлдэгдэл", "Balance")}
            hint={
              balance === "due" || balance === "checking"
                ? t("Нэхэмжлэл ирсэн", "Invoice sent")
                : t("Бараа ирэхэд", "When your items arrive")
            }
            amount={formatMnt(order.balanceMnt)}
            state={closed ? null : balance}
          />
        ) : (
          <li className="py-3 text-[13px] text-ink-soft">
            {t("Бүтэн дүнгээр төлж байгаа тул үлдэгдэл гарахгүй.", "You’re paying in full, so there’s no balance.")}
          </li>
        )}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-faint">
        {t(
          `Бараа захиалга баталгаажсанаас хойш ${PREORDER_ARRIVAL_DAYS} хоногт ирнэ. Урьдчилгаа буцаагдахгүй. Бүрэн төлөгдсөний дараа бүх барааг тань хамт хүргэнэ.`,
          `Items arrive ${PREORDER_ARRIVAL_DAYS} days after your order is confirmed. The deposit is non-refundable. All your items are delivered together once fully paid.`,
        )}
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
  const t = useT();
  return (
    <li className={`flex items-center gap-3 py-3 ${muted ? "text-ink-soft" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-[12px] text-ink-faint">{hint}</span>
      </span>
      {state && (
        <span className="o-chip shrink-0" data-tone={STEP_BADGE[state].tone}>
          {t(STEP_BADGE[state].text, STEP_BADGE[state].en)}
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
          className="mt-6 inline-block rounded-full bg-ink-strong px-6 py-3 text-[12px] font-bold text-paper transition-opacity hover:opacity-85"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
