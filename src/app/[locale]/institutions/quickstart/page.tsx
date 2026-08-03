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
    title: he ? "Quickstart — אימות Mandate ב־15 דקות" : "Quickstart — verify a Mandate in 15 minutes",
    description: he
      ? "JWKS, test vectors, Status List, SDK — בלי שיחת מכירות. עברת = מוכן ל־Pioneer."
      : "JWKS, test vectors, Status List, SDK — no sales call. Pass = ready for Pioneer.",
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
      kicker={heEn(he, "מוסדות · בלי שיחת מכירות", "Institutions · no sales call")}
      title={heEn(he, "אימות Mandate ב־15 דקות", "Verify a Mandate in 15 minutes")}
      sub={
        he
          ? "המטרה: להגיע ל־READY_FOR_PIONEER על המכונה שלכם — ואז לתבוע מקום Pioneer באשף. לא אישור רגולטורי. לא לקוחות מומצאים."
          : "Goal: hit READY_FOR_PIONEER on your machine — then claim a Pioneer slot in the wizard. Not regulatory certification. No invented customers."
      }
    >
      <EmeraldInfoPanel className="mb-6">
        <strong className="text-emerald">
          {heEn(he, "כלל ברור:", "Clear rule:")}
        </strong>{" "}
        {he
          ? "עברת את ה־test vectors + Status List מאומת = אתה מוכן ל־Pioneer. בלי זה — אל תטענו תמיכה."
          : "Pass test vectors + verified Status List = ready for Pioneer. Without that — do not claim support."}
      </EmeraldInfoPanel>

      <Card className="p-5 mb-6">
        <div className="font-extrabold text-[15px] mb-2">
          {heEn(he, "1) Node — שורה אחת", "1) Node — one command")}
        </div>
        <CodeBlock>{`cd sdk && npm run ready
# or, after publish:
npx zakai-mandate-ready --origin ${ORIGIN}`}</CodeBlock>
        <p className="text-[13px] text-ink-soft mt-3 mb-0 leading-relaxed">
          {he
            ? "מריץ את כל ה־authorization vectors + מאמת את ה־statuslist+jwt החתום (ניתן לקאש אופליין)."
            : "Runs every authorization vector + verifies the signed statuslist+jwt (cacheable offline)."}
        </p>
      </Card>

      <Card className="p-5 mb-6">
        <div className="font-extrabold text-[15px] mb-2">
          {heEn(he, "2) Python — בלי npm", "2) Python — no npm")}
        </div>
        <CodeBlock>{`cd reference/python
pip install -r requirements-sdk.txt
python3 zakai_verify.py --ready --origin ${ORIGIN}`}</CodeBlock>
        <p className="text-[13px] text-ink-soft mt-3 mb-0 leading-relaxed">
          {he
            ? "מאמת statuslist+jwt מול JWKS (Ed25519) — אותו שער כמו Node. בלי cryptography אין READY_FOR_PIONEER."
            : "Verifies statuslist+jwt against JWKS (Ed25519) — same gate as Node. Without cryptography there is no READY_FOR_PIONEER."}
        </p>
      </Card>

      <Card className="p-5 mb-6">
        <div className="font-extrabold text-[15px] mb-2">
          {heEn(he, "3) SDK בשורות בודדות", "3) SDK in a few lines")}
        </div>
        <CodeBlock>{`import { verifyMandateFromUrl } from "@zakai/mandate-sdk";
import { verifyStatusListFromUrl } from "@zakai/mandate-sdk";

const claims = await verifyMandateFromUrl(jws, {
  audience: "your-institution-slug",
  jwksUri: "${ORIGIN}/.well-known/zakai-jwks.json",
});

const list = await verifyStatusListFromUrl({
  statusListUri: "${ORIGIN}/api/mandate/revocations",
  issuer: "${ORIGIN}",
  jwksUri: "${ORIGIN}/.well-known/zakai-jwks.json",
});
// list.isRevoked(statusIndex) — offline after one fetch`}</CodeBlock>
      </Card>

      <Card className="p-5 mb-6">
        <div className="font-extrabold text-[15px] mb-2">
          {heEn(he, "4) נקודות חובה", "4) Must-hit endpoints")}
        </div>
        <ul className="m-0 ps-5 flex flex-col gap-1.5 text-[13.5px] font-mono break-all text-ink-soft">
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
            <a className="text-emerald" href={`${ORIGIN}/api/mandate/ready`}>
              /api/mandate/ready
            </a>{" "}
            <span className="font-sans text-[12px]">
              {heEn(he, "(שער מכונה → ready_for_pioneer)", "(machine gate → ready_for_pioneer)")}
            </span>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/api/mandate/revocations`}>
              /api/mandate/revocations
            </a>{" "}
            <span className="font-sans text-[12px]">(statuslist+jwt, Cache-Control 15m)</span>
          </li>
          <li>
            <a className="text-emerald" href={`${ORIGIN}/.well-known/zakai-conformance.json`}>
              /.well-known/zakai-conformance.json
            </a>
          </li>
          <li>POST /api/mandate/verify · POST /api/mandate/decide · POST /api/mandate/conformance/probe</li>
        </ul>
      </Card>

      <Card className="p-5 mb-8 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.06)]">
        <div className="font-extrabold text-[15px] text-emerald mb-2">
          {heEn(he, "5) אחרי READY_FOR_PIONEER", "5) After READY_FOR_PIONEER")}
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mb-4">
          {he
            ? "תבעו מקום Pioneer (עד 3) באשף — רק אחרי שהמכונה עברה. הקיר ריק עד שאימוץ אמיתי נרשם. אין שמות מומצאים."
            : "Claim a Pioneer slot (max 3) in the wizard — only after the machine passed. Wall stays empty until a real opt-in. No invented names."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/institutions/leader" className="no-underline">
            <Button>{heEn(he, "אשף Reference Verifier", "Reference Verifier wizard")}</Button>
          </Link>
          <Link href="/institutions/leaders" className="no-underline">
            <Button variant="ghost">{heEn(he, "קיר Pioneer", "Pioneer wall")}</Button>
          </Link>
          <Link href="/pipe" className="no-underline">
            <Button variant="ghost">Pipe</Button>
          </Link>
        </div>
      </Card>

      <p className="text-[12px] text-ink-soft leading-relaxed">
        {he
          ? "תשתית בלי נפח צרכני נשארת יפה ולא הכרחית. אחרי Quickstart — הלולאה ב־/money חייבת לייצר Mandates ו־SavingsProof אמיתיים."
          : "Infrastructure without consumer volume stays pretty, not necessary. After Quickstart — the /money loop must produce real Mandates and SavingsProofs."}{" "}
        <Link href="/money" className="text-emerald font-extrabold no-underline hover:underline">
          /money
        </Link>
      </p>
    </VerticalPageShell>
  );
}
