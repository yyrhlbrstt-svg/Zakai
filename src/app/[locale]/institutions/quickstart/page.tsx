import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button, Card } from "@/components/ui";
import { CodeBlock } from "@/components/CodeBlock";
import { EmeraldInfoPanel } from "@/components/EmeraldInfoPanel";
import { alternateLanguages } from "@/lib/seo";
import { heEn } from "@/lib/heEn";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const he = locale === "he" || locale === "ar";
  return {
    title: he ? "Quickstart — Mandate ב־20–30 דקות" : "Quickstart — Mandate in 20–30 minutes",
    description: he
      ? "Node או Python → READY_FOR_PIONEER → תביעת Pioneer. בלי שיחת מכירות."
      : "Node or Python → READY_FOR_PIONEER → claim Pioneer. No sales call.",
    alternates: { languages: alternateLanguages("/institutions/quickstart") },
  };
}

export default async function InstitutionQuickstartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const he = locale === "he" || locale === "ar";

  return (
    <VerticalPageShell
      heroGlow
      kicker={heEn(he, "מוסדות · מסלול אחד", "Institutions · one path")}
      title={heEn(he, "Mandate ב־20–30 דקות", "Mandate in 20–30 minutes")}
      sub={
        he
          ? "שלושה שלבים בלבד: הרצה על המכונה → READY_FOR_PIONEER → תביעת Pioneer באשף. בלי שיחת מכירות. בלי לקוחות מומצאים."
          : "Three steps only: run on your machine → READY_FOR_PIONEER → claim Pioneer in the wizard. No sales call. No invented customers."
      }
    >
      {/* Linear path strip */}
      <ol className="mb-8 grid gap-3 sm:grid-cols-3 list-none p-0 m-0">
        {(
          he
            ? [
                { n: "1", t: "הרצה", s: "~10 דק׳ — Node או Python" },
                { n: "2", t: "READY_FOR_PIONEER", s: "vectors + Status List חתום" },
                { n: "3", t: "Pioneer", s: "אשף Reference Verifier" },
              ]
            : [
                { n: "1", t: "Run", s: "~10 min — Node or Python" },
                { n: "2", t: "READY_FOR_PIONEER", s: "vectors + signed Status List" },
                { n: "3", t: "Pioneer", s: "Reference Verifier wizard" },
              ]
        ).map((step) => (
          <li
            key={step.n}
            className="rounded-xl border border-[rgba(63,203,155,0.28)] bg-[rgba(63,203,155,0.06)] px-4 py-3"
          >
            <div className="text-[11px] font-extrabold text-emerald tracking-wide">
              {step.n}
            </div>
            <div className="font-extrabold text-[14.5px] mt-0.5">{step.t}</div>
            <div className="text-[12.5px] text-ink-soft mt-1 leading-snug">{step.s}</div>
          </li>
        ))}
      </ol>

      <EmeraldInfoPanel className="mb-6">
        <strong className="text-emerald">
          {heEn(he, "שער ברור:", "Clear gate:")}
        </strong>{" "}
        {he
          ? "עברת test vectors + Status List מאומת קריפטוגרפית = READY_FOR_PIONEER. בלי זה — אל תטענו תמיכה ואל תתבעו Pioneer."
          : "Pass test vectors + cryptographically verified Status List = READY_FOR_PIONEER. Without that — do not claim support and do not claim Pioneer."}
      </EmeraldInfoPanel>

      <Card className="p-5 mb-5 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)]">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "שלב 1א — Node (~10 דק׳)", "Step 1a — Node (~10 min)")}
        </div>
        <p className="text-[13px] text-ink-soft mt-0 mb-3 leading-relaxed">
          {he
            ? "אותו לוגיקת decide כמו בפרודקשן. עד פרסום npm — מהמונורפו."
            : "Same decide logic as production. Until npm publish — from the monorepo."}
        </p>
        <CodeBlock>{`cd sdk && npm ci && npm run ready -- --origin ${ORIGIN}
# after publish:
# npx zakai-mandate-ready --origin ${ORIGIN}`}</CodeBlock>
      </Card>

      <Card className="p-5 mb-5">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "שלב 1ב — Python (~10 דק׳)", "Step 1b — Python (~10 min)")}
        </div>
        <p className="text-[13px] text-ink-soft mt-0 mb-3 leading-relaxed">
          {he
            ? "חבילה רשמית ב־sdk/python. אותו שער כמו Node. בלי cryptography אין READY."
            : "Official package in sdk/python. Same gate as Node. Without cryptography there is no READY."}
        </p>
        <CodeBlock>{`cd sdk/python
pip install -e '.[crypto]'
zakai-mandate-ready --origin ${ORIGIN}`}</CodeBlock>
      </Card>

      <Card className="p-5 mb-5">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "שלב 2 — בדקו את שער המכונה", "Step 2 — check the machine gate")}
        </div>
        <p className="text-[13px] text-ink-soft mt-0 mb-3 leading-relaxed">
          {he
            ? "אם המסוף הדפיס READY_FOR_PIONEER — אותו מצב ב־JSON החי:"
            : "If the terminal printed READY_FOR_PIONEER — same state in live JSON:"}
        </p>
        <CodeBlock>{`curl -sS "${ORIGIN}/api/mandate/ready" | jq .ready_for_pioneer`}</CodeBlock>
        <ul className="mt-3 mb-0 ps-5 flex flex-col gap-1 text-[12.5px] font-mono text-ink-soft break-all">
          <li>
            <a className="text-emerald" href={`${ORIGIN}/.well-known/zakai-jwks.json`}>
              /.well-known/zakai-jwks.json
            </a>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/api/mandate/test-vectors`}>
              /api/mandate/test-vectors
            </a>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/api/mandate/revocations`}>
              /api/mandate/revocations
            </a>{" "}
            <span className="font-sans">(statuslist+jwt)</span>
          </li>
        </ul>
      </Card>

      <Card className="p-5 mb-5">
        <div className="font-extrabold text-[15px] mb-1">
          {heEn(he, "אופציונלי — 3 שורות בתוך הקוד שלכם", "Optional — 3 lines in your code")}
        </div>
        <CodeBlock>{`import { verifyMandateFromUrl, verifyStatusListFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(jws, {
  audience: "your-institution-slug",
  jwksUri: "${ORIGIN}/.well-known/zakai-jwks.json",
});

await verifyStatusListFromUrl({
  statusListUri: "${ORIGIN}/api/mandate/revocations",
  issuer: "${ORIGIN}",
  jwksUri: "${ORIGIN}/.well-known/zakai-jwks.json",
});`}</CodeBlock>
        <details className="mt-3">
          <summary className="text-[12.5px] text-ink-soft cursor-pointer font-bold select-none">
            {heEn(he, "Python · ספרייה", "Python · library")}
          </summary>
          <CodeBlock className="mt-2">{`from zakai_mandate import verify_status_list_from_url

verify_status_list_from_url(
    status_list_uri="${ORIGIN}/api/mandate/revocations",
    issuer="${ORIGIN}",
    jwks_uri="${ORIGIN}/.well-known/zakai-jwks.json",
)`}</CodeBlock>
        </details>
        <details className="mt-2">
          <summary className="text-[12.5px] text-ink-soft cursor-pointer font-bold select-none">
            {heEn(he, "חבילת פיילוט (curl בלבד)", "Pilot package (curl only)")}
          </summary>
          <p className="text-[12.5px] text-ink-soft mt-2 mb-2 leading-relaxed">
            {he
              ? "דוגמת Mandate — לא מציב אתכם על קיר Pioneer."
              : "Sample Mandate — does not list you on the Pioneer wall."}
          </p>
          <CodeBlock>{`curl -sS "${ORIGIN}/api/institution/pilot-package?audience=your-institution-id" | jq .`}</CodeBlock>
        </details>
      </Card>

      <Card className="p-5 mb-8 border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.08)]">
        <div className="font-extrabold text-[15px] text-emerald mb-2">
          {heEn(he, "שלב 3 — תביעת Pioneer", "Step 3 — claim Pioneer")}
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mb-4">
          {he
            ? "רק אחרי READY_FOR_PIONEER על המכונה שלכם. עד 3 מקומות Pioneer. הקיר ריק עד לאימוץ אמיתי — אין שמות מומצאים. לא אישור רגולטורי."
            : "Only after READY_FOR_PIONEER on your machine. Max 3 Pioneer slots. Wall stays empty until a real opt-in — no invented names. Not regulatory certification."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/institutions/leader" className="no-underline">
            <Button>{heEn(he, "אשף Reference Verifier", "Reference Verifier wizard")}</Button>
          </Link>
          <Link href="/institutions/leaders" className="no-underline">
            <Button variant="ghost">{heEn(he, "קיר Pioneer", "Pioneer wall")}</Button>
          </Link>
        </div>
      </Card>

      <p className="text-[12.5px] text-ink-soft leading-relaxed mb-0">
        {he
          ? "תשתית בלי נפח צרכני נשארת יפה ולא הכרחית. הלולאה ב־/money חייבת לייצר Mandates ו־SavingsProof אמיתיים — זה מה שהופך אימות מוסדי לכדאי."
          : "Infrastructure without consumer volume stays pretty, not necessary. The /money loop must produce real Mandates and SavingsProofs — that is what makes institutional verify worth adopting."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          /money
        </Link>
      </p>
    </VerticalPageShell>
  );
}
