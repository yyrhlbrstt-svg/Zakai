"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { bcp47, type Locale } from "@/i18n/config";
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
}

interface GravityRow {
  found: boolean;
  dispatchedCases?: number;
  savedCases?: number;
  cost?: { reputationSignal?: string; unhandledEstimate?: number; deskHours?: number };
}

export function VerifyLookup({ initialCode }: { initialCode?: string }) {
  const t = useTranslations("verifyPage");
  const locale = useLocale() as Locale;
  const he = locale === "he" || locale === "ar";
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<PublicAuth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [gravity, setGravity] = useState<GravityRow | null>(null);

  const check = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    setResult(null);
    setGravity(null);
    try {
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
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ZK-XXXX-XXXX"
            aria-label={t("codeLabel")}
            onKeyDown={(e) => e.key === "Enter" && check(code)}
          />
          <Button onClick={() => check(code)} disabled={pending}>
            {t("checkBtn")}
          </Button>
        </div>
        {error && <FieldError>{t(error)}</FieldError>}
      </Card>

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
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold mb-4"
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
          {gravity?.found && gravity.dispatchedCases != null && gravity.dispatchedCases > 0 ? (
            <div className="mt-4 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-3.5 py-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald">
                {heEn(he, "נפח Mandate מתועד", "Documented Mandate volume")}
              </div>
              <p className="text-[13px] font-bold m-0 mt-1 leading-relaxed">
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-[rgba(255,255,255,0.06)]">
      <span className="text-ink-soft text-sm">{label}</span>
      <span className="text-sm font-bold text-end">{value}</span>
    </div>
  );
}
