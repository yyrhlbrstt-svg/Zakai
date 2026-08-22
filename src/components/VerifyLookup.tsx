"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { bcp47, type Locale } from "@/i18n/config";
import { formatAgorot } from "@/lib/money";
import { Card, Button, Input, FieldError } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { heEn } from "@/lib/heEn";

interface PublicAuth {
  code: string;
  status: "ACTIVE" | "REVOKED";
  principalName: string;
  principalPhoneMasked: string;
  provider: string;
  mandateAudience?: string;
  institutionVerifierLeader?: boolean;
  scope: string;
  issuedAt: string;
  writtenDemands?: {
    recordedAt: string;
    sentAt: string | null;
    subject: string;
    delivery: "SENT" | "QUEUED" | "FAILED";
  }[];
  statutoryBasis?: { law: string; section: string; sourceUrl: string } | null;
}

interface GravityRow {
  found: boolean;
  dispatchedCases?: number;
  savedCases?: number;
  cost?: { reputationSignal?: string; unhandledEstimate?: number; deskHours?: number };
}

/** What /api/mandate/verify-settlement returns on a good record. */
interface SettlementResult {
  counterparty: string;
  market: string;
  vertical: string;
  outcome: "saved" | "no_saving";
  beforeMinor: number;
  afterMinor: number;
  recoveredMinor: number;
  days: number;
  selfReported: boolean;
  issuer: string;
  issuedAt: string;
}

/** Three base64url segments — an authorization code never looks like this. */
function looksLikeJws(v: string): boolean {
  const parts = v.split(".");
  return parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p) && p.length > 0);
}

/** What /api/mandate/inspect returns. Deliberately has no `valid` field. */
interface MandateReport {
  signatureVerified: boolean;
  jwksUri: string | null;
  keyId: string | null;
  algorithm: string | null;
  environment: "production" | "sandbox" | "unknown";
  issuer: { iss: string; registered: boolean; name: string | null; status: string | null };
  declaredAudience: string | null;
  audienceChecked: false;
  revocation: { state: string; via: string | null };
  claims: {
    jti: string | null;
    scopes: string[];
    market: string | null;
    principalName: string | null;
    principalContactMasked: string | null;
    statement: string | null;
    expiresAt: string | null;
    expired: boolean | null;
  } | null;
  verdict: string;
  reason: string;
}

/**
 * Read the JWS `typ` header without a library.
 *
 * A settlement record and a mandate are both compact JWS and both arrive in
 * the same box, because whoever was handed one does not know which kind it is
 * — and should not have to. The header says which, so we ask it rather than
 * guessing from the payload or making the reader pick a tab.
 */
function jwsTyp(token: string): string | null {
  try {
    const head = token.split(".")[0];
    const json = atob(head.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as { typ?: string };
    return typeof parsed.typ === "string" ? parsed.typ : null;
  } catch {
    return null;
  }
}

const SETTLEMENT_TYP = "zakai-settlement+jwt";

export function VerifyLookup({ initialCode }: { initialCode?: string }) {
  const t = useTranslations("verifyPage");
  const locale = useLocale() as Locale;
  const he = locale === "he" || locale === "ar";
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<PublicAuth | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [gravity, setGravity] = useState<GravityRow | null>(null);
  const [mandate, setMandate] = useState<MandateReport | null>(null);

  const check = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    setResult(null);
    setSettlement(null);
    setGravity(null);
    setMandate(null);
    try {
      /**
       * A settlement is a compact JWS, an authorization is a short ZK- code.
       * They arrive through the same box because whoever is checking one has
       * been handed a string and does not know or care which kind it is —
       * making them choose a tab first is asking the reader to know our
       * schema before they can use it.
       */
      if (looksLikeJws(trimmed) && jwsTyp(trimmed) !== SETTLEMENT_TYP) {
        /**
         * A mandate. Sent to /inspect rather than /verify because the reader
         * here is not an institution presenting a mandate addressed to itself
         * — they are a stranger asking whether the thing in their hand is
         * real. /verify would demand an audience they do not have, and refuse.
         */
        const mRes = await fetch("/api/mandate/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmed }),
        });
        const mData = await mRes.json();
        if (!mRes.ok || typeof mData.verdict !== "string") {
          setError("notFound");
          return;
        }
        setMandate(mData as MandateReport);
        return;
      }

      if (looksLikeJws(trimmed)) {
        const sRes = await fetch("/api/mandate/verify-settlement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settlement: trimmed }),
        });
        const sData = await sRes.json();
        if (!sRes.ok || sData.valid !== true) {
          // The reason matters: a forged record and a record of the wrong
          // kind are different problems for whoever is holding it.
          setError(typeof sData.reason === "string" ? sData.reason : "notFound");
          return;
        }
        setSettlement(sData as SettlementResult);
        return;
      }

      const res = await fetch(`/api/authorization/${encodeURIComponent(trimmed)}`);
      if (res.status === 404) {
        setError("notFound");
        return;
      }
      const data = await res.json();
      const auth = data.authorization as PublicAuth;
      setResult(auth);
      const institution = (auth.mandateAudience || auth.provider || "").trim();
      if (institution) {
        const gRes = await fetch(
          `/api/institution/ignore-cost?institution=${encodeURIComponent(institution)}`,
        );
        if (gRes.ok) {
          const g = (await gRes.json()) as GravityRow;
          if (g.found && (g.dispatchedCases ?? 0) > 0) setGravity(g);
        }
      }
    } catch {
      setError("notFound");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) check(initialCode);
  }, [initialCode, check]);

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-20 pt-6">
      <h1 className="font-display text-[26px] text-center mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-center text-sm mb-6 leading-relaxed">{t("sub")}</p>

      <Card className="p-5">
        <div className="flex gap-2.5">
          <Input
            value={code}
            /**
             * Upper-casing is for the ZK- code shape only. A compact JWS is
             * base64url and case-carrying: upper-casing a pasted mandate
             * silently corrupted it, so every paste failed verification and
             * looked exactly like a forgery.
             */
            onChange={(e) =>
              setCode(e.target.value.includes(".") ? e.target.value : e.target.value.toUpperCase())
            }
            placeholder={heEn(he, "ZK-XXXX-XXXX או מנדט חתום", "ZK-XXXX-XXXX or a signed mandate")}
            aria-label={t("codeLabel")}
            onKeyDown={(e) => e.key === "Enter" && check(code)}
          />
          <Button onClick={() => check(code)} disabled={pending}>
            {t("checkBtn")}
          </Button>
        </div>
        {error && <FieldError>{t(error)}</FieldError>}
      </Card>

      {settlement && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.08)] p-5 mt-4">
          <div className="font-bold text-emerald text-body-lg">{t("stTitle")}</div>
          <p className="text-caption text-ink-soft mt-1 mb-3 leading-relaxed">{t("stSub")}</p>
          <dl className="grid grid-cols-2 gap-y-2 text-body m-0">
            <dt className="text-ink-soft">{t("stCounterparty")}</dt>
            <dd className="m-0 font-bold">{settlement.counterparty}</dd>
            <dt className="text-ink-soft">{t("stOutcome")}</dt>
            <dd className="m-0 font-bold">
              {settlement.outcome === "saved" ? t("stSaved") : t("stNoSaving")}
            </dd>
            <dt className="text-ink-soft">{t("stRecovered")}</dt>
            <dd className="m-0 font-bold" dir="ltr">
              {formatAgorot(settlement.recoveredMinor, bcp47[locale])}
            </dd>
            <dt className="text-ink-soft">{t("stDays")}</dt>
            <dd className="m-0 font-bold">{settlement.days}</dd>
          </dl>
          {/* Never smoothed over: a reader weighing this as evidence has to
              know whether a pipeline documented it or a person recalled it. */}
          {settlement.selfReported && (
            <p className="text-caption text-amber font-bold mt-3 mb-0">{t("stSelfReported")}</p>
          )}
        </div>
      )}

      {mandate && <MandatePanel report={mandate} he={he} />}

      {result && (
        <Card
          className="p-6 mt-4"
          style={{
            border:
              result.status === "ACTIVE"
                ? "1px solid rgba(63,203,155,0.4)"
                : "1px solid rgba(240,138,107,0.4)",
          }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-body font-bold mb-4"
            style={{
              color: result.status === "ACTIVE" ? "#3FCB9B" : "#F08A6B",
              background: result.status === "ACTIVE" ? "rgba(63,203,155,0.13)" : "rgba(240,138,107,0.13)",
            }}
          >
            {result.status === "ACTIVE" ? `✓ ${t("found")}` : `✕ ${t("revoked")}`}
          </div>
          {result.institutionVerifierLeader && (
            <p className="text-[12.5px] text-emerald font-bold mb-3 leading-relaxed">{t("leaderBadge")}</p>
          )}
          <Row label={t("principalLabel")} value={`${result.principalName} · ${result.principalPhoneMasked}`} />
          <Row label={t("providerLabel")} value={result.provider} />
          {result.mandateAudience ? (
            <Row label={t("mandateAudienceLabel")} value={result.mandateAudience} />
          ) : null}
          <Row label={t("issuedLabel")} value={new Date(result.issuedAt).toLocaleString(bcp47[locale])} />
          <div className="mt-3">
            <div className="text-[12px] font-bold text-ink-soft">
              {t("scopeLabel")}
            </div>
            <div className="text-[14px] mt-1 leading-relaxed">{result.scope}</div>
          </div>

          {/* The written-demand trail — what turns "the code checks out" into
              "a dated paper trail you cannot dismiss as bot noise". Dates and
              delivery state come from the Outbox, which never claims SENT for
              anything that only queued; this section inherits that honesty. */}
          {result.writtenDemands && result.writtenDemands.length > 0 && (
            <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3.5 py-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                {heEn(he, "מסלול הדרישות בכתב", "Written-demand trail")}
              </div>
              <ol className="m-0 mt-2 ps-0 list-none flex flex-col gap-2">
                {result.writtenDemands.map((d, i) => (
                  <li key={`${d.recordedAt}-${i}`} className="text-[13px] leading-relaxed">
                    <span className="font-bold" dir="ltr">
                      {new Date(d.sentAt ?? d.recordedAt).toLocaleDateString(bcp47[locale])}
                    </span>
                    {" · "}
                    <span
                      className={
                        d.delivery === "SENT"
                          ? "text-emerald font-bold"
                          : d.delivery === "FAILED"
                            ? "text-[#F08A6B] font-bold"
                            : "text-ink-soft font-bold"
                      }
                    >
                      {d.delivery === "SENT"
                        ? heEn(he, "נשלח", "Sent")
                        : d.delivery === "FAILED"
                          ? heEn(he, "שליחה נכשלה", "Delivery failed")
                          : heEn(he, "נרשם, ממתין לשליחה", "Recorded, awaiting dispatch")}
                    </span>
                    {d.subject ? (
                      <span className="text-ink-soft"> — {d.subject}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.statutoryBasis && (
            <p className="text-[12.5px] text-ink-soft mt-3 mb-0 leading-relaxed">
              {heEn(he, "בסיס סטטוטורי: ", "Statutory basis: ")}
              <span className="font-bold">
                {result.statutoryBasis.law}, {result.statutoryBasis.section}
              </span>
              {" · "}
              <a
                href={result.statutoryBasis.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3EC6FF] font-bold no-underline"
              >
                {heEn(he, "לנוסח החוק →", "Consolidated text →")}
              </a>
            </p>
          )}
          {gravity?.found && gravity.dispatchedCases != null && gravity.dispatchedCases > 0 ? (
            <div className="mt-4 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-3.5 py-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald">
                {heEn(he, "נפח Mandate מתועד", "Documented Mandate volume")}
              </div>
              <p className="text-body font-bold m-0 mt-1 leading-relaxed">
                {he
                  ? `${gravity.dispatchedCases} פניות Mandate שנשלחו · ${gravity.savedCases ?? 0} SavingsProof`
                  : `${gravity.dispatchedCases} Mandate dispatches · ${gravity.savedCases ?? 0} SavingsProofs`}
              </p>
              {gravity.cost?.unhandledEstimate != null && gravity.cost.unhandledEstimate > 0 ? (
                <p className="text-[12px] text-ink-soft m-0 mt-1.5 leading-relaxed">
                  {he
                    ? `הערכת עומס שולחן: ~${gravity.cost.deskHours ?? "—"} שעות על פניות שלא נסגרו (אומדן בלבד).`
                    : `Desk-load estimate: ~${gravity.cost.deskHours ?? "—"} hours on unhandled requests (estimate only).`}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3 mt-2.5">
                <Link href="/pipe" className="text-[12.5px] font-bold text-[#3EC6FF] no-underline">
                  {heEn(he, "אימוץ Pipe / אימות →", "Adopt Pipe / verify →")}
                </Link>
                <a
                  href="/api/pipe/accept"
                  className="text-[12.5px] font-bold text-[#3EC6FF] no-underline"
                >
                  {heEn(he, "Accept registry", "Accept registry")}
                </a>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </main>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-[rgba(255,255,255,0.06)]">
      <span className="text-ink-soft text-sm">{label}</span>
      {/* Protocol values — issuer URIs, jti, timestamps — are LTR strings. In
          an RTL page the browser reorders their segments, so a reader checking
          a jti against a letter compares two different-looking strings. */}
      <span className="text-sm font-bold text-end" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
/**
 * The mandate answer, rendered so a reader can disagree with it.
 *
 * Every panel here states three things a summary alone would let a reader
 * blur together: whether the bytes are authentic, whether the issuer is one
 * this network trusts, and what was NOT checked. The JWKS link is not
 * decoration — it is the whole point. A verification you have to take on
 * faith is a press release.
 */
const reasonHe: Record<string, string> = {
  authentic_and_registered:
    "החתימה מאומתת מול המפתח הציבורי של המנפיק, והמנפיק רשום במרשם האמון. הנמען לא נבדק כאן — מוסד שפועל על סמך המנדט חייב לקרוא ל־/api/mandate/verify עם המזהה שלו.",
  authentic_sandbox_no_authority:
    "החתימה אמיתית ואפשר לאמת אותה בעצמכם מול ה־JWKS של הסביבה הבטוחה — שינוי תו אחד מפיל אותה. היא לא מעניקה שום סמכות: מנפיק ה־Sandbox נעדר במכוון ממרשם האמון, אינו נושא שם של אדם אמיתי, והמאמת הייצורי דוחה אותו.",
  authentic_but_expired:
    "החתימה אמיתית, אבל תוקף המנדט פג. אף אחד לא רשאי לפעול על פיו.",
  authentic_but_revoked:
    "החתימה אמיתית והמנפיק מוכר, אבל המנדט בוטל. מנדט מבוטל אינו מעניק דבר, גם אם הוא נראה תקין לחלוטין.",
  authentic_but_issuer_untrusted:
    "המנפיק שמופיע במנדט אינו במרשם האמון של זכאי, ולכן הוא אינו מעניק שום סמכות כאן.",
  signature_failed:
    "אף מפתח ציבורי של המנפיק אינו מאמת את הבייטים האלה. או שהמסמך שונה אחרי החתימה, או שהוא לא נחתם על ידי המנפיק הזה.",
  not_a_mandate:
    "זה לא JWS קומפקטי — מנדט מורכב משלושה מקטעי base64url מופרדים בנקודות.",
};

function MandatePanel({ report, he }: { report: MandateReport; he: boolean }) {
  const good = report.verdict === "authentic_and_registered";
  const amber =
    report.verdict === "authentic_sandbox_no_authority" ||
    report.verdict === "authentic_but_expired";
  const tone = good ? "#3FCB9B" : amber ? "#E4B363" : "#F08A6B";
  const mark = good ? "\u2713" : amber ? "!" : "\u2715";

  const headline: Record<string, [string, string]> = {
    authentic_and_registered: ["חתימה מאומתת · מנפיק רשום", "Signature verified · issuer registered"],
    authentic_sandbox_no_authority: ["חתימה אמיתית · מנדט Sandbox ללא סמכות", "Genuine signature · sandbox mandate, no authority"],
    authentic_but_expired: ["חתימה אמיתית · פג תוקף", "Genuine signature · expired"],
    authentic_but_revoked: ["חתימה אמיתית · בוטל", "Genuine signature · revoked"],
    authentic_but_issuer_untrusted: ["מנפיק שאינו במרשם האמון", "Issuer is not in the trust registry"],
    signature_failed: ["החתימה נכשלה", "Signature failed"],
    not_a_mandate: ["זה לא מנדט חתום", "Not a signed mandate"],
  };
  const title = headline[report.verdict] ?? ["תוצאה לא מוכרת", "Unrecognised result"];

  return (
    <Card className="p-6 mt-4" style={{ border: `1px solid ${tone}66` }}>
      <div
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-body font-bold mb-3"
        style={{ color: tone, background: `${tone}22` }}
      >
        {mark} {heEn(he, title[0], title[1])}
      </div>
      {/* The machine reason is authoritative and English; a Hebrew reader
          gets the same sentence in their own language, keyed on the verdict
          rather than translated at read time. An unrecognised verdict falls
          back to the server's words rather than to silence. */}
      <p className="text-caption text-ink-soft leading-relaxed m-0 mb-4">
        {reasonHe[report.verdict] && he ? reasonHe[report.verdict] : report.reason}
      </p>

      <Row
        label={heEn(he, "חתימה קריפטוגרפית", "Cryptographic signature")}
        value={
          report.signatureVerified
            ? heEn(he, "אומתה", "Verified")
            : heEn(he, "לא אומתה", "Not verified")
        }
      />
      <Row label={heEn(he, "מנפיק", "Issuer")} value={report.issuer.iss || "—"} ltr />
      <Row
        label={heEn(he, "במרשם האמון", "In trust registry")}
        value={report.issuer.registered ? heEn(he, "כן", "Yes") : heEn(he, "לא", "No")}
      />
      <Row
        label={heEn(he, "סביבה", "Environment")}
        value={
          report.environment === "sandbox"
            ? heEn(he, "Sandbox — ללא סמכות", "Sandbox — no authority")
            : report.environment
        }
      />
      {report.claims?.jti ? <Row label="jti" value={report.claims.jti} ltr /> : null}
      {report.claims && report.claims.scopes.length > 0 ? (
        <Row label={heEn(he, "היקפים", "Scopes")} value={report.claims.scopes.join(" ")} ltr />
      ) : null}
      {report.claims?.expiresAt ? (
        <Row
          label={heEn(he, "בתוקף עד", "Valid until")}
          value={new Date(report.claims.expiresAt).toISOString().replace("T", " ").slice(0, 16)}
          ltr
        />
      ) : null}
      <Row label={heEn(he, "מצב ביטול", "Revocation")} value={report.revocation.state} />

      {/* Said out loud, because the difference between "this is real" and
          "this is addressed to you" is the whole of mandate security. */}
      <div className="mt-4 rounded-xl border border-[rgba(228,179,99,0.35)] bg-[rgba(228,179,99,0.08)] px-3.5 py-3">
        <p className="text-caption leading-relaxed m-0">
          {heEn(
            he,
            `נמען מוצהר בתוך המנדט: ${report.declaredAudience ?? "—"}. הנמען לא נבדק כאן. מוסד שפועל על סמך מנדט חייב לקרוא ל־/api/mandate/verify עם המזהה שלו עצמו.`,
            `Audience declared inside the mandate: ${report.declaredAudience ?? "—"}. It was NOT checked here. An institution acting on a mandate must call /api/mandate/verify with its own audience.`,
          )}
        </p>
      </div>

      {report.jwksUri ? (
        <p className="text-caption mt-3 mb-0 leading-relaxed">
          {heEn(he, "אל תסמכו עלינו — בדקו בעצמכם: ", "Do not take our word for it — check it yourself: ")}
          <a
            href={report.jwksUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3EC6FF] font-bold no-underline break-all"
          >
            {report.jwksUri}
          </a>
        </p>
      ) : null}
    </Card>
  );
}
