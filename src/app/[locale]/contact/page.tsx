import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";
import {
  publicSupportEmail,
  publicSecurityEmail,
  salesInboundEmail,
  FOUNDER_EMAIL,
} from "@/lib/contact";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return publicPageMetadata(locale, {
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/contact",
  });
}

/**
 * How to reach a person here.
 *
 * The one thing this page must not do is promise a callback. Zakai's whole
 * design is that the path finishes in the app rather than in a queue behind a
 * phone, and a contact page that says "we will get back to you" quietly
 * reinstates the thing the product exists to remove — and then fails to do it,
 * because there is no callback team.
 *
 * So the promise made here is one the system can actually keep: the message is
 * stored the moment it is sent, and the reply comes by email. The response
 * window is one string in the message catalogue, because it is the founder's
 * commitment to make and change, not an engineering constant.
 */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });

  const channels = [
    { key: "support", email: publicSupportEmail() },
    { key: "institutions", email: salesInboundEmail() },
    { key: "security", email: publicSecurityEmail() },
  ];

  return (
    <main className="max-w-[720px] mx-auto px-5 py-10">
      <h1 className="font-display text-h1 mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-body-lg mt-0 mb-6 leading-relaxed">{t("subtitle")}</p>

      <Card className="p-5 mb-6">
        <p className="text-body text-ink m-0 leading-relaxed font-bold">{t("promise")}</p>
        <p className="text-caption text-ink-soft mt-2 mb-0 leading-relaxed">{t("noCallback")}</p>
      </Card>

      <ContactForm />

      <h2 className="font-display text-title mt-9 mb-3">{t("directTitle")}</h2>
      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {channels.map((c) => (
          <li key={c.key}>
            <Card className="p-4">
              <div className="font-extrabold text-body-lg">{t(`channel.${c.key}.title`)}</div>
              <div className="text-caption text-ink-soft mt-1 leading-relaxed">
                {t(`channel.${c.key}.desc`)}
              </div>
              <a
                href={`mailto:${c.email}`}
                dir={c.email === FOUNDER_EMAIL ? undefined : "ltr"}
                className="text-emerald text-body font-bold no-underline mt-2 inline-block"
              >
                {/* A configured mailbox is worth printing; the founder-inbox
                    fallback still receives the mail but is not shown as text —
                    a personal gmail on the contact page reads as a hobby. */}
                {c.email === FOUNDER_EMAIL ? t("emailCta") : c.email}
              </a>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-caption text-ink-soft mt-7 mb-0 leading-relaxed">
        {t("faqHint")}{" "}
        <Link href="/faq" className="text-emerald font-bold no-underline">
          {t("faqLink")}
        </Link>
      </p>
    </main>
  );
}
