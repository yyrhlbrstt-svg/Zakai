"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { bcp47, type Locale } from "@/i18n/config";
import { Card, Button, Input, FieldError } from "@/components/ui";

interface PublicAuth {
  code: string;
  status: "ACTIVE" | "REVOKED";
  principalName: string;
  principalPhoneMasked: string;
  provider: string;
  scope: string;
  issuedAt: string;
}

export function VerifyLookup({ initialCode }: { initialCode?: string }) {
  const t = useTranslations("verifyPage");
  const tp = useTranslations("providers");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<PublicAuth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const check = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/authorization/${encodeURIComponent(trimmed)}`);
      if (res.status === 404) {
        setError("notFound");
        return;
      }
      const data = await res.json();
      setResult(data.authorization);
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
          <Row label={t("principalLabel")} value={`${result.principalName} · ${result.principalPhoneMasked}`} />
          <Row label={t("providerLabel")} value={tp(result.provider)} />
          <Row label={t("issuedLabel")} value={new Date(result.issuedAt).toLocaleString(bcp47[locale])} />
          <div className="mt-3">
            <div className="text-[12px] font-bold text-ink-soft">
              {t("scopeLabel")}
            </div>
            <div className="text-[14px] mt-1 leading-relaxed">{result.scope}</div>
          </div>
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
