"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSession } from "@/components/useSession";
import PhoneVerify from "@/components/PhoneVerify";
import EmailOtp from "@/components/EmailOtp";
import OAuthButtons, { hasOAuth } from "@/components/OAuthButtons";
import { useRedeemParkedCart } from "@/components/CartHandoff";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

function SignIn() {
  useRedeemParkedCart();

  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";
  const oauthFailed = params.get("oauth") === "failed";
  const { isAuthenticated, ready } = useSession();

  const [method, setMethod] = useState<Method>("phone");

  if (ready && isAuthenticated) {
    return (
      <div className="text-center">
        <p className="text-[14px] text-ink-soft">Та нэвтэрсэн байна.</p>
        <Button
          variant="solid"
          size="cta"
          onClick={() => router.push(next)}
          className="mt-5 w-full rounded-full"
        >
          Үргэлжлүүлэх
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-.02em]">Нэвтрэх</h1>
      <p className="mt-2 text-[14px] text-ink-soft">
        {next === "/checkout"
          ? "Захиалгаа баталгаажуулахын тулд нэвтэрнэ үү. Сагс хадгалагдана."
          : "Нууц үг хэрэггүй. Бүртгэлгүй бол автоматаар үүснэ."}
      </p>

      {oauthFailed && (
        <p className="mt-5 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-[13px] text-danger-ink">
          Нэвтэрч чадсангүй. Дахин оролдоно уу.
        </p>
      )}

      <div className="mt-7">
        <p className="mb-2 text-[13px] font-medium text-ink">Юугаар нэвтрэх вэ?</p>
        <div role="group" aria-label="Нэвтрэх арга" className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-shade p-1">
          {METHODS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              aria-pressed={method === key}
              className={`min-h-11 rounded-full py-2.5 text-[14px] font-medium transition-colors ${
                method === key
                  ? "bg-paper text-ink-strong shadow-(--t-lift)"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {method === "phone" ? (
          <PhoneVerify onVerified={() => router.push(next)} />
        ) : (
          <EmailOtp onVerified={() => router.push(next)} next={next} />
        )}

        {hasOAuth && (
          <>
            <Divider />
            <OAuthButtons next={next} />
          </>
        )}
      </div>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-ink-faint">
        Үргэлжлүүлснээр манай{" "}
        <Link href="/returns" className="link-underline">
          үйлчилгээний нөхцөл
        </Link>
        -ийг зөвшөөрнө.
      </p>
    </>
  );
}

type Method = "phone" | "email";

const METHODS: ReadonlyArray<readonly [Method, string]> = [
  ["phone", "Утасны дугаар"],
  ["email", "Имэйл"],
];

const Divider = () => (
  <div className="my-6 flex items-center gap-3">
    <span className="h-px flex-1 bg-line" />
    <span className="text-[12px] text-ink-faint">эсвэл</span>
    <span className="h-px flex-1 bg-line" />
  </div>
);

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo className="h-9 w-auto" />
      </Link>

      <div className="w-full max-w-100 rounded-3xl bg-paper px-6 py-8 shadow-(--t-lift) sm:px-9 sm:py-10">
        <Suspense
          fallback={<p className="text-center text-[13px] text-ink-faint">…</p>}
        >
          <SignIn />
        </Suspense>
      </div>

      <Link
        href="/shop"
        className="mt-6 flex min-h-11 items-center text-[13px] text-ink-soft hover:text-ink"
      >
        ← Дэлгүүр рүү буцах
      </Link>
    </div>
  );
}
