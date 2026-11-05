import Link from "next/link";
import NewsletterForm from "./NewsletterForm";
import { paymentCopy } from "@/lib/payment-copy";
import { storeContact } from "@/lib/store-contact";
import { T } from "@/lib/i18n";
import {
  IconFacebook,
  IconInstagram,
  IconMail,
  IconPhone,
  IconPin,
} from "./Icons";

const COLUMNS = [
  {
    title: ["Дэлгүүр", "Shop"],
    links: [
      { href: "/shop", label: ["Бүх бүтээгдэхүүн", "All products"] },
    ],
  },
  {
    title: ["Мэдээлэл", "Information"],
    links: [
      { href: "/about", label: ["Бидний тухай", "About us"] },
      { href: "/contact", label: ["Холбоо барих", "Contact"] },
    ],
  },
  {
    title: ["Үйлчилгээ", "Help"],
    links: [
      { href: "/shipping", label: ["Хүргэлтийн нөхцөл", "Delivery"] },
      { href: "/returns", label: ["Буцаалт, солилт", "Returns & exchanges"] },
      { href: "/faq", label: ["Түгээмэл асуулт", "FAQ"] },
      { href: "/orders", label: ["Захиалга хянах", "Track an order"] },
    ],
  },
] as const;

export default async function Footer() {
  const [pay, contact] = await Promise.all([paymentCopy(), storeContact()]);

  return (
    <footer className="bg-footer text-white">
      <div className="mx-auto grid max-w-350 gap-6 px-5 py-10 sm:gap-10 sm:py-16 sm:grid-cols-2 lg:grid-cols-6 lg:px-8">
        {COLUMNS.map((col) => (
          <div key={col.title[0]}>
            <h3 className="nav-link text-white"><T mn={col.title[0]} en={col.title[1]} /></h3>
            <ul className="mt-3 sm:mt-5 sm:space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex min-h-9 items-center text-[13px] text-white/70 transition-colors hover:text-white sm:min-h-0"
                  >
                    <T mn={l.label[0]} en={l.label[1]} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!contact.isEmpty && (
          <div>
            <h3 className="nav-link text-white"><T mn="Холбоо барих" en="Contact" /></h3>
            <ul className="mt-3 space-y-1 sm:mt-5 sm:space-y-3">
              {contact.phone && (
                <li>
                  <a
                    href={contact.phoneHref ?? undefined}
                    className="flex min-h-9 items-start gap-2.5 text-[13px] text-white/70 transition-colors hover:text-white sm:min-h-0"
                  >
                    <IconPhone
                      className="mt-px shrink-0 opacity-70"
                      width="16"
                      height="16"
                    />
                    <span className="tabular-nums">{contact.phone}</span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex min-h-9 items-start gap-2.5 text-[13px] text-white/70 transition-colors hover:text-white sm:min-h-0"
                  >
                    <IconMail
                      className="mt-px shrink-0 opacity-70"
                      width="16"
                      height="16"
                    />
                    <span className="break-all">{contact.email}</span>
                  </a>
                </li>
              )}
              {contact.address && (
                <li className="flex items-start gap-2.5 text-[13px] text-white/70">
                  <IconPin
                    className="mt-px shrink-0 opacity-70"
                    width="16"
                    height="16"
                  />
                  <span>{contact.address}</span>
                </li>
              )}
            </ul>

            {contact.socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {contact.socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={s.label}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white hover:text-white sm:h-9 sm:w-9"
                  >
                    {s.key === "facebook" ? (
                      <IconFacebook />
                    ) : (
                      <IconInstagram />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lg:col-span-2">
          <h3 className="nav-link text-white"><T mn="Мэдээлэл авах" en="Stay in the loop" /></h3>
          <p className="mt-5 text-[13px] text-white/70">
            <T
              mn="Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээллийг хамгийн түрүүнд аваарай."
              en="Be the first to hear about new products and discounts."
            />
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-6 lg:px-8">
          <p className="text-[12px] text-white/50">
            © {new Date().getFullYear()} hotaru
          </p>
          <p className="text-[12px] text-white/50"><T mn={`${pay.short}, Улаанбаатар`} en={`${pay.shortEn}, Ulaanbaatar`} /></p>
        </div>
      </div>
    </footer>
  );
}
