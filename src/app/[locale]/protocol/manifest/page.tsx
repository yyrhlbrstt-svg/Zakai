import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { JsonDocView } from "@/components/JsonDocView";
import { alternateLanguages } from "@/lib/seo";
import { buildZakaiProtocolDocument } from "@/lib/protocol/discovery";
import type { Locale } from "@/i18n/config";

const copy = {
  he: {
    metaTitle: "מניפסט פרוטוקול זכאי | Zakai",
    kicker: "מסמך גילוי",
    title: "מניפסט פרוטוקול זכאי",
    sub: "מסמך ה-JSON המלא — לאינטגרציה מכנית עדיף הקישור הגולמי בתחתית העמוד; לקריאה אנושית זה כאן.",
    raw: "פתח JSON גולמי",
    back: "חזרה לפרוטוקול",
  },
  en: {
    metaTitle: "Zakai protocol manifest | Zakai",
    kicker: "Discovery document",
    title: "Zakai protocol manifest",
    sub: "The full JSON document — for machine integration use the raw link at the bottom; for humans, it's rendered here.",
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
    alternates: { languages: alternateLanguages("/protocol/manifest") },
  };
}

export const dynamic = "force-dynamic";

export default async function ProtocolManifestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const he = locale === "he" || locale === "ar";
  const c = he ? copy.he : copy.en;

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
  const doc = buildZakaiProtocolDocument(origin);

  return (
    <VerticalPageShell kicker={c.kicker} title={c.title} sub={c.sub}>
      <JsonDocView doc={doc} />
      <div className="flex flex-wrap gap-3 mt-5">
        <a
          href={`${origin}/.well-known/zakai-protocol.json`}
          target="_blank"
          rel="noopener noreferrer"
        >
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
