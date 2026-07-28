import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LeadForm } from "@/components/LeadForm";
import { LogoMark } from "@/components/Logo";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "התחל עכשיו — זכאי Money OS",
  description: "סריקה → תיק סוכן עם Mandate. בלי מוקד. בלי להשאיר טלפון.",
};

export default async function StartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { locale } = await params;
  const { v } = await searchParams;
  setRequestLocale(locale);

  const vertical = (v || "general").replace(/[^a-z-]/g, "").slice(0, 60) || "general";
  const he = locale === "he" || locale === "ar";

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-5">
        <LogoMark size={44} />
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5">
          {he ? "Money OS · בלי מוקד · בלי שיחה חזרה" : "Money OS · no callback"}
        </div>
      </div>
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.14] m-0 text-balance mb-3">
        {he ? "מאיפה מתחילים?" : "Where do you start?"}
      </h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-6">
        {he
          ? "בחר בעיה. הסוכן פותח תיק, Mandate, שולח ועוקב. עמלה רק על חיסכון מתועד."
          : "Pick a problem. The agent opens a case, Mandate, sends and follows up. Fee only on documented savings."}
      </p>

      <div className="flex flex-col gap-2.5 mb-8">
        <Link href="/money">
          <Button className="w-full !text-[15px] !py-3">
            {he ? "משלם יותר מדי — סרוק עכשיו" : "Paying too much — scan now"}
          </Button>
        </Link>
        <Link href="/electricity">
          <Button variant="ghost" className="w-full">
            {he ? "חשמל יקר — מעבר ספק עם סוכן" : "Electricity high — agent switch"}
          </Button>
        </Link>
        <Link href="/cancel">
          <Button variant="ghost" className="w-full">
            {he ? "בטל מנוי עם סוכן" : "Cancel a sub with agent"}
          </Button>
        </Link>
        <Link href="/bank-fees">
          <Button variant="ghost" className="w-full">
            {he ? "עמלות בנק" : "Bank fees"}
          </Button>
        </Link>
        <Link href="/what-am-i-owed">
          <Button variant="ghost" className="w-full">
            {he ? "מה מגיע לי?" : "What am I owed?"}
          </Button>
        </Link>
        <Link href="/leaks">
          <Button variant="ghost" className="w-full">
            {he ? "מפת נזילות" : "Leaks map"}
          </Button>
        </Link>
      </div>

      <LeadForm vertical={vertical} />
    </main>
  );
}
