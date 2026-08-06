import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { JsonDocView } from "@/components/JsonDocView";
import { alternateLanguages } from "@/lib/seo";
import { buildNetworkFeed } from "@/lib/protocol/discovery";
import type { Locale } from "@/i18n/config";

const copy = {
  he: {
    metaTitle: "פיד רשת ציבורי | Zakai",
    kicker: "פיד ציבורי",
    title: "פיד רשת ציבורי",
    sub: "מצב חוקים, דגלי הפעלה בזמן אמת, וסך תצפיות בגרף התוצאות המנותק — ללא זיהוי משתמשים.",
    raw: "פתח JSON גולמי",
    back: "חזרה לפרוטוקול",
  },
  en: {
    metaTitle: "Public network feed | Zakai",
    kicker: "Public feed",
    title: "Public network feed",
    sub: "Live laws, operational flags, and de-identified outcome-graph totals.",
    raw: "Open raw JSON",
    back: "Back to protocol",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const c = copy[locale === "he" || locale === "ar" ? "he" : "en"];
  return {
    title: c.metaTitle,
    alternates: { languages: alternateLanguages("/protocol/network") },
  };
}

export const dynamic = "force-dynamic";

export default async function ProtocolNetworkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const he = locale === "he" || locale === "ar";
  const c = he ? copy.he : copy.en;

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
  const doc = await buildNetworkFeed(origin).catch(() => ({ error: "unavailable" }));

  return (
    <VerticalPageShell kicker={c.kicker} title={c.title} sub={c.sub}>
      <JsonDocView doc={doc} />
      <div className="flex flex-wrap gap-3 mt-5">
        <a href={`${origin}/api/network`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" className="!text-[12.5px]">
            {c.raw}
          </Button>
        </a>
        <Link href="/protocol">
          <Button variant="ghost" className="!text-[12.5px]">
            {c.back}
          </Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
