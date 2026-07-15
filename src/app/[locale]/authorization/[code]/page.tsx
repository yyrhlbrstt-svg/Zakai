import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPublicAuthorization } from "@/lib/services/authorization";
import { bcp47, type Locale } from "@/i18n/config";
import { PrintButton } from "@/components/PrintButton";
import { Logo } from "@/components/Logo";

export default async function AuthorizationDocPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const auth = await getPublicAuthorization(code);
  if (!auth) notFound();

  const t = await getTranslations("authorizationDoc");
  const tp = await getTranslations("providers");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify?code=${auth!.code}`;
  const active = auth!.status === "ACTIVE";

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-20 pt-2">
      <div className="flex justify-end mb-3">
        <PrintButton />
      </div>

      {/* The document: a white "paper" sheet so it prints as a real form. */}
      <article
        dir="rtl"
        className="bg-white text-[#0d1622] rounded-2xl p-8 md:p-10 shadow-[0_24px_60px_rgba(0,0,0,0.45)] leading-relaxed"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <div className="flex items-start justify-between border-b-2 border-[#0d1622] pb-4 mb-6">
          <div>
            <Logo tone="light" height={20} className="mb-3" />
            <div className="text-2xl font-extrabold">{t("docTitle")}</div>
            <div className="text-sm text-[#5a6b6a] mt-1">{t("subtitle")}</div>
          </div>
          <div
            className="text-xs font-extrabold rounded-full px-3 py-1"
            style={{
              color: active ? "#0a7a52" : "#a3341f",
              background: active ? "#d6f7ea" : "#fbe2da",
              border: `1px solid ${active ? "#0a7a52" : "#a3341f"}`,
            }}
          >
            {t("status")}: {active ? t("statusActive") : t("statusRevoked")}
          </div>
        </div>

        <DocRow label={t("principal")} value={`${auth!.principalName} · ${auth!.principalPhoneMasked}`} />
        <DocRow label={t("agent")} value={t("agentValue")} />
        <DocRow label={t("provider")} value={tp(auth!.provider)} />
        <DocRow label={t("issuedAt")} value={new Date(auth!.issuedAt).toLocaleString(bcp47[locale as Locale])} />

        <section className="mt-6">
          <div className="font-extrabold text-lg mb-1.5">{t("scope")}</div>
          <p className="text-[15px]">{auth!.scope}</p>
        </section>

        <section className="mt-5 bg-[#f2f6f5] rounded-xl p-4 text-[14px]">
          {t("disclosure")}
        </section>

        <section className="mt-6 border-t border-[#c9d3d2] pt-5">
          <div className="font-extrabold mb-1.5">{t("verifyHeading")}</div>
          <p className="text-[14px] mb-2">{t("verifyBody")}</p>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <span className="text-[#5a6b6a] text-sm">{t("verifyCodeLabel")}: </span>
              <span className="font-extrabold text-lg tracking-wide">{auth!.code}</span>
            </div>
            <a href={verifyUrl} className="text-[#0a5b8a] font-bold text-sm break-all">
              {verifyUrl}
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}

function DocRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-[#e2e8e7]">
      <span className="text-[#5a6b6a] text-sm">{label}</span>
      <span className="text-[15px] font-bold text-start">{value}</span>
    </div>
  );
}
