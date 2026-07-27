import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { EmbedPreview } from "@/components/EmbedPreview";

export const metadata: Metadata = {
  title: "Zakai Partners — B2B embed & Money OS",
  description:
    "Drop-in embed for banks, fintech and employers. Customer money agent with Mandate — no call center, fee only on documented savings.",
};

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  const snippet = `<div id="zakai-embed" data-locale="${locale}" data-ref="your-partner-id"></div>
<script src="https://zakai-3uxj.vercel.app/embed.js" async></script>`;

  return (
    <main className="max-w-[720px] mx-auto px-5 pb-24 pt-4">
      <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-5">
        B2B · Partners
      </div>
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight m-0">
        {he ? "הטמיעו את סוכן הכסף אצלכם" : "Embed the money agent on your product"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mt-4 max-w-[560px]">
        {he
          ? "סקריפט אחד. הלקוח שלכם נכנס ל-Money OS, סורק חיובים, פותח תיק עם Mandate — בלי מוקד ובלי להשאיר טלפון. אתם מקבלים ref ב-UTM."
          : "One script. Your customer lands in Money OS, scans charges, opens a Mandate case — no call center, no phone left behind. You get a UTM ref."}
      </p>

      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {he ? "הטמעה" : "Install"}
      </h2>
      <Card className="p-5">
        <pre className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed font-mono text-ink-soft overflow-x-auto">
          {snippet}
        </pre>
      </Card>

      <div className="grid gap-3 mt-6 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-locale</div>
          <div className="text-ink-soft text-[12.5px] mt-1">he · en · ar · ru</div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-ref</div>
          <div className="text-ink-soft text-[12.5px] mt-1">
            {he ? "מזהה שותף (UTM campaign)" : "Partner id (UTM campaign)"}
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="font-extrabold text-[14px]">data-label / data-sub</div>
          <div className="text-ink-soft text-[12.5px] mt-1">
            {he ? "טקסט מותאם (אופציונלי)" : "Custom copy (optional)"}
          </div>
        </SpotlightCard>
      </div>

      <h2 className="text-[16px] font-extrabold mt-10 mb-3">
        {he ? "תצוגה מקדימה" : "Live preview"}
      </h2>
      <EmbedPreview locale={locale} />

      <div className="mt-10 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.07)] px-5 py-5">
        <div className="font-extrabold text-[15px]">
          {he ? "למה זה עובד לשותפים" : "Why partners ship this"}
        </div>
        <ul className="mt-3 mb-0 ps-5 text-[13.5px] text-ink-soft leading-relaxed flex flex-col gap-1.5">
          <li>{he ? "אפס PII אצלכם — הלקוח עובד אצלנו" : "Zero PII on your side — the customer works with us"}</li>
          <li>{he ? "Mandate מוסדי (Ed25519 + JWKS)" : "Institutional Mandate (Ed25519 + JWKS)"}</li>
          <li>{he ? "עמלה רק על SavingsProof — יישור תמריצים" : "Fee only on SavingsProof — aligned incentives"}</li>
          <li>{he ? "בלי מוקד, בלי callback" : "No call center, no callback"}</li>
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/business">
          <Button>{he ? "זכאי לעובדים" : "Zakai for employees"}</Button>
        </Link>
        <Link href="/institutions">
          <Button variant="ghost">{he ? "למוסדות" : "For institutions"}</Button>
        </Link>
        <Link href="/money">
          <Button variant="ghost">Money OS</Button>
        </Link>
      </div>
    </main>
  );
}
