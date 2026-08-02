import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { alternateLanguages } from "@/lib/seo";
import { buildZakaiProtocolDocument, getOutcomeGraphPublicStats } from "@/lib/protocol/discovery";
import { PROTOCOL_LAWS } from "@/lib/protocol/laws";
import type { Locale } from "@/i18n/config";

const copy = {
  he: {
    metaTitle: "פרוטוקול זכאי — סמכות ניתנת לאימות | Zakai",
    metaDesc:
      "שכבת פרוטוקול: Mandate ב-Ed25519, גרף תוצאות מנותק מזהות, וחוקים קבועים. לא אפליקציה שמבטיחה מוקד — רשת שאפשר לאמת.",
    kicker: "תשתית, לא מוקד",
    title: "פרוטוקול שאפשר לאמת — כמו ביטקוין, אבל לסמכות צרכנית",
    sub: "ביטקוין הוכיח שאפשר להחזיק כללים בלי לסמוך על בנק מרכזי. זכאי מחזיקה את אותו רעיון לכסף שמגיע לך: ייפוי כוח חתום, ניתן לביטול, עם JWKS ציבורי — וגרף תוצאות מצטבר בלי שמות.",
    layersTitle: "שלוש שכבות",
    authority: "סמכות (Mandate)",
    authorityBody:
      "JWT ב-Ed25519, קהל (aud) לכל מוסד, רשימת ביטולים, ו-API verify/decide. הבנק לא צריך להאמין לנו — רק לאמת חתימה.",
    outcomes: "גרף תוצאות",
    outcomesBody:
      "StrategyOutcome — מה עבד מול איזה ספק, בלי קישור למשתמש. ככל שיש יותר נתונים, הסוכן משתפר לכולם (קיר הוכחות).",
    settlement: "יישוב (Settlement)",
    settlementBody: "שרשרת קבלות JWT: mandate → החלטה → תוצאה — לפסיקה אוטומטית כשיש מחלוקת.",
    lawsTitle: "חוקים קבועים (לא שיווק)",
    liveTitle: "מצב הרשת עכשיו",
    outcomesCount: "תצפיות בגרף",
    mandateLive: "חתימת Mandate בפרודקשן",
    yes: "פעיל",
    no: "לא מוגדר",
    manifest: "מניפסט פרוטוקול (JSON)",
    network: "פיד רשת ציבורי",
    institutions: "לאינטגרציות מוסדות",
    proofs: "קיר הוכחות",
    start: "התחל כצרכן",
    disclaimer:
      "זה לא מטבע קריפטו ולא הבטחת תשואה — זה פרוטוקול לסמכות ולתיעוד. הערך גדל כשמוסדות מאמתים mandates וכשיותר תוצאות מתועדות בכנות.",
  },
  en: {
    metaTitle: "Zakai Protocol — verifiable consumer authority | Zakai",
    metaDesc:
      "Protocol layer: Ed25519 Mandate, de-identified outcome graph, fixed laws. Not a call-centre app — a network you can verify.",
    kicker: "Infrastructure, not a hotline",
    title: "A protocol you can verify — Bitcoin's idea, for consumer authority",
    sub: "Bitcoin showed rules can be held without trusting a central bank. Zakai holds the same idea for money you're owed: signed, revocable mandate with public JWKS — plus an aggregate outcome graph with no names.",
    layersTitle: "Three layers",
    authority: "Authority (Mandate)",
    authorityBody:
      "Ed25519 JWT, per-institution audience, revocation list, verify/decide APIs. Banks verify signatures — they don't have to trust our word.",
    outcomes: "Outcome graph",
    outcomesBody:
      "StrategyOutcome — what worked against which counterparty, no user link. More honest data improves the agent for everyone (proofs wall).",
    settlement: "Settlement",
    settlementBody: "JWT receipt chain: mandate → decision → outcome — for machine adjudication when parties disagree.",
    lawsTitle: "Fixed laws (not marketing)",
    liveTitle: "Network state now",
    outcomesCount: "Graph observations",
    mandateLive: "Mandate signing in production",
    yes: "Live",
    no: "Not configured",
    manifest: "Protocol manifest (JSON)",
    network: "Public network feed",
    institutions: "For institutions",
    proofs: "Proofs wall",
    start: "Start as consumer",
    disclaimer:
      "This is not a cryptocurrency or a return promise — it's a protocol for authority and proof. Value grows when institutions verify mandates and outcomes are recorded honestly.",
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
    description: c.metaDesc,
    alternates: { languages: alternateLanguages("/protocol") },
  };
}

export const dynamic = "force-dynamic";

export default async function ProtocolPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const he = locale === "he" || locale === "ar";
  const c = he ? copy.he : copy.en;

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
  const doc = buildZakaiProtocolDocument(origin);
  const stats = await getOutcomeGraphPublicStats().catch(() => ({
    totalOutcomes: 0,
    markets: [],
    updatedAt: new Date().toISOString(),
  }));

  return (
    <VerticalPageShell kicker={c.kicker} title={c.title} sub={c.sub}>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: c.authority, body: c.authorityBody },
          { title: c.outcomes, body: c.outcomesBody },
          { title: c.settlement, body: c.settlementBody },
        ].map((layer) => (
          <Card key={layer.title} className="p-5">
            <div className="font-extrabold text-[15px] text-emerald">{layer.title}</div>
            <p className="text-[13.5px] text-ink-soft mt-2 mb-0 leading-relaxed">{layer.body}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5 mt-6">
        <div className="font-display text-xl mb-3">{c.lawsTitle}</div>
        <ul className="m-0 pl-5 text-[13.5px] leading-relaxed text-ink-soft space-y-2">
          {PROTOCOL_LAWS.map((law) => (
            <li key={law.id}>
              <code className="text-[12px] text-[#3EC6FF]">{law.id}</code> — {law.summary}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 mt-4 border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.06)]">
        <div className="font-extrabold text-[15px]">{c.liveTitle}</div>
        <div className="flex flex-wrap gap-6 mt-3 text-[14px]">
          <div>
            <div className="text-ink-soft text-[12px]">{c.outcomesCount}</div>
            <div className="font-display text-2xl">{stats.totalOutcomes.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-ink-soft text-[12px]">{c.mandateLive}</div>
            <div className="font-extrabold text-emerald">
              {doc.layers.authority.live ? c.yes : c.no}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <a href={`${origin}/.well-known/zakai-protocol.json`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" className="!text-[12.5px]">
              {c.manifest}
            </Button>
          </a>
          <a href={`${origin}/api/network`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" className="!text-[12.5px]">
              {c.network}
            </Button>
          </a>
          <Link href="/institutions">
            <Button variant="ghost" className="!text-[12.5px]">
              {c.institutions}
            </Button>
          </Link>
          <Link href="/proofs">
            <Button variant="ghost" className="!text-[12.5px]">
              {c.proofs}
            </Button>
          </Link>
        </div>
      </Card>

      <p className="text-[12.5px] text-ink-soft mt-6 leading-relaxed">{c.disclaimer}</p>

      <div className="mt-6">
        <Link href="/door">
          <Button className="w-full md:w-auto">{c.start}</Button>
        </Link>
      </div>
    </VerticalPageShell>
  );
}
