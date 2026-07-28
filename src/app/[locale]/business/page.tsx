import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Reveal } from "@/components/Reveal";
import { SpotlightCard } from "@/components/SpotlightCard";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";
import { EmbedPreview } from "@/components/EmbedPreview";

export const metadata: Metadata = {
  title: "Zakai for Business — Employee benefits + Mandate infrastructure",
  description:
    "Employee money-rights benefit + verifiable Mandate API for banks, insurers and fintechs. No outbound payments. Success fee only on documented savings.",
};

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("business");
  const he = locale === "he" || locale === "ar";

  const values = t.raw("values") as Array<{ icon: string; title: string; sub: string }>;
  const steps = t.raw("steps") as Array<{ title: string; sub: string }>;

  return (
    <main className="max-w-[980px] mx-auto px-5 pb-24 pt-6">
      <div className="max-w-[680px]">
        <Reveal>
          <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
            {he ? "שני מסלולים · עובדים + תשתית Mandate" : "Two tracks · employees + Mandate infrastructure"}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(30px,5.4vw,48px)] leading-[1.12] m-0 text-balance">
            {he
              ? "זכאי לעסקים ומוסדות"
              : "Zakai for business & institutions"}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="text-ink-soft text-[16.5px] leading-[1.7] my-6">
            {he
              ? "הטבת רווחה שמחזירה לעובדים כסף אמיתי — וגם תשתית Mandate שמוסדות, בנקים ופינטק יכולים לאמת offline בלי סיכון לתשלומים יוצאים."
              : "An employee benefit that returns real money — and a Mandate infrastructure banks, insurers and fintechs can verify offline with zero outbound-payment risk."}
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="flex flex-wrap gap-3">
            <a href="#employees" className="inline-block">
              <span className="grad-bg btn-sheen text-[#06121A] font-extrabold rounded-[14px] px-6 py-3.5 text-[15px] inline-block shadow-[0_10px_30px_rgba(63,203,155,0.28)]">
                {he ? "הטבת עובדים" : "Employee benefit"}
              </span>
            </a>
            <a href="#infrastructure" className="inline-block">
              <span className="border border-[rgba(63,203,155,0.45)] text-emerald font-extrabold rounded-[14px] px-6 py-3.5 text-[15px] inline-block">
                {he ? "Mandate / API" : "Mandate / API"}
              </span>
            </a>
          </div>
        </Reveal>
      </div>

      {/* Track A — Employees */}
      <div id="employees" className="scroll-mt-8">
        <Reveal>
          <h2 className="text-[17px] font-extrabold mt-16 mb-2">
            {he ? "מסלול א׳ · הטבת רווחה לעובדים" : "Track A · Employee welfare benefit"}
          </h2>
          <p className="text-ink-soft text-[14px] mb-5 max-w-[560px]">
            {he
              ? "עובדים מגלים זכויות, בודקים תלוש, מבטלים מנויים ומחזירים כסף — בלי עלות הקמה לעסק."
              : "Employees discover rights, check payslips, cancel subs and recover money — zero setup cost for the company."}
          </p>
        </Reveal>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 70}>
              <SpotlightCard className="p-5 h-full">
                <div className="text-[26px]" aria-hidden>
                  {v.icon}
                </div>
                <div className="font-extrabold text-[15px] mt-2.5">{v.title}</div>
                <div className="text-ink-soft text-[12.5px] mt-1 leading-relaxed">{v.sub}</div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <h3 className="text-[15px] font-extrabold mt-10 mb-4">{t("howTitle")}</h3>
        </Reveal>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 80}>
              <SpotlightCard className="p-6 h-full">
                <div className="w-[30px] h-[30px] rounded-[9px] grad-bg text-[#06121A] flex items-center justify-center font-black text-sm">
                  {i + 1}
                </div>
                <div className="font-extrabold text-base mt-3">{s.title}</div>
                <div className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{s.sub}</div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Track B — Infrastructure / Mandate */}
      <div id="infrastructure" className="scroll-mt-8 mt-16">
        <Reveal>
          <h2 className="text-[17px] font-extrabold mb-2">
            {he ? "מסלול ב׳ · תשתית Mandate למוסדות" : "Track B · Mandate infrastructure for institutions"}
          </h2>
          <p className="text-ink-soft text-[14px] mb-6 max-w-[600px]">
            {he
              ? "סמכות צרכנית חתומה, מוגבלת, ניתנת לאימות offline. בלי תשלומים יוצאים. JWKS ציבורי + status endpoint. זה הסטנדרט שאנחנו בונים."
              : "Signed, scoped, offline-verifiable consumer authority. No outbound payments. Public JWKS + status endpoint. This is the standard we are building."}
          </p>
        </Reveal>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] mb-8">
          {[
            {
              title: he ? "אימות offline" : "Offline verification",
              sub: he
                ? "Ed25519 JWS · JWKS · בלי קריאה לשרת שלנו בכל בקשה"
                : "Ed25519 JWS · JWKS · no call to our servers on every request",
            },
            {
              title: he ? "אפס תשלום יוצא" : "Zero outbound payment",
              sub: he
                ? "Scopes אסורים בקוד — לא רק בהסכם. כסף רק לכיוון הלקוח."
                : "Forbidden scopes in code — not just in the contract. Money only toward the consumer.",
            },
            {
              title: he ? "ביטול מיידי" : "Instant revocation",
              sub: he
                ? "status/{jti} · מוסד יכול לדחות Mandate מבוטל בשנייה"
                : "status/{jti} · institution can reject a revoked Mandate in a second",
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              <SpotlightCard className="p-5 h-full border-[rgba(63,203,155,0.25)]">
                <div className="font-extrabold text-[15px] text-emerald">{c.title}</div>
                <div className="text-ink-soft text-[13px] mt-2 leading-relaxed">{c.sub}</div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.025)] p-5 sm:p-6 font-mono text-[12.5px] leading-relaxed overflow-x-auto">
            <div className="text-ink-soft mb-2">// Discovery</div>
            <div>GET {ORIGIN}/.well-known/zakai-mandate.json</div>
            <div>GET {ORIGIN}/.well-known/zakai-jwks.json</div>
            <div className="text-ink-soft mt-3 mb-2">// Verify</div>
            <div>POST {ORIGIN}/api/mandate/verify</div>
            <div>GET {ORIGIN}/api/mandate/status/&#123;jti&#125;</div>
            <div className="text-ink-soft mt-3 mb-2">// OpenAPI</div>
            <div>{ORIGIN}/api/mandate/openapi.json</div>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/institutions"
              className="inline-block text-emerald font-extrabold text-[14px] no-underline border border-[rgba(63,203,155,0.4)] rounded-xl px-5 py-2.5"
            >
              {he ? "מדריך מוסדות מלא →" : "Full institutions guide →"}
            </Link>
            <a
              href={`${ORIGIN}/api/mandate/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-ink-soft font-bold text-[14px] no-underline border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-2.5"
            >
              OpenAPI
            </a>
          </div>
        </Reveal>
      </div>

      {/* Embed widget */}
      <Reveal>
        <h2 className="text-[17px] font-extrabold mt-16 mb-3">
          {he ? "Embed — widget לשותפים" : "Embed — partner widget"}
        </h2>
        <p className="text-ink-soft text-[13.5px] mb-5 max-w-[560px]">
          {he
            ? "הטמעה באתר בנק / מעסיק / פינטק. בלי credentials. בלי callback."
            : "Drop into a bank / employer / fintech site. No credentials. No callback."}
        </p>
      </Reveal>
      <div className="max-w-[420px]">
        <EmbedPreview locale={locale} />
      </div>
      <pre className="mt-4 text-[12px] leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-lg max-w-[560px]">
        {`<div id="zakai-embed" data-locale="${locale}" data-ref="your-partner-id" data-path="money"></div>
<script src="${ORIGIN}/embed.js" async></script>`}
      </pre>

      {/* Lead form */}
      <div id="lead" className="mt-16 scroll-mt-6">
        <Reveal>
          <div className="max-w-[620px] mx-auto rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.025)] p-6 sm:p-8">
            <h2 className="font-display text-2xl mb-1.5">{t("form.title")}</h2>
            <p className="text-ink-soft text-[13.5px] mb-6">{t("form.sub")}</p>
            <BusinessLeadForm />
          </div>
        </Reveal>
      </div>
    </main>
  );
}
