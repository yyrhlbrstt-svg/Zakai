"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Textarea } from "@/components/ui";
import type { ContractAnalysis } from "@/lib/contractAnalysis";

/**
 * Paste a contract, see which clauses favour you and which should give you
 * pause — no signup, no upload plumbing, because the entire appeal is trying
 * it the moment you're actually staring at a lease. Text-paste only for now;
 * a photo/PDF path is a real, separate piece of work for later, not something
 * to half-build alongside this.
 */
export function ContractRedFlagChecker() {
  const t = useTranslations("contractCheck");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ContractAnalysis | null>(null);

  async function check() {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contract/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503) {
        setErr(t("aiUnavailable"));
        return;
      }
      if (res.status === 429) {
        setErr(t("tooManyRequests"));
        return;
      }
      if (!res.ok) {
        setErr(t("genericError"));
        return;
      }
      const data = (await res.json()) as ContractAnalysis;
      setResult(data);
    } catch {
      setErr(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 20;

  return (
    <Card className="p-6">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("placeholder")}
        rows={10}
        maxLength={20000}
      />
      {tooShort && <p className="text-danger text-[12.5px] mt-2">{t("tooShort")}</p>}
      {err && <p className="text-danger text-[12.5px] mt-2">{err}</p>}

      <Button
        className="mt-4"
        disabled={busy || trimmed.length < 20}
        onClick={check}
      >
        {busy ? t("checking") : t("checkCta")}
      </Button>

      {result && !result.readable && result.clauses.length === 0 && (
        <p className="text-ink-soft text-[13.5px] mt-5 leading-relaxed">{t("notReadable")}</p>
      )}

      {result && result.clauses.length > 0 && (
        <div className="flex flex-col gap-3 mt-6">
          {result.clauses.map((c, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                c.risk === "red"
                  ? "border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.06)]"
                  : "border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.06)]"
              }`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden>{c.risk === "red" ? "🔴" : "🟢"}</span>
                <div>
                  <p className="text-[13.5px] font-bold leading-relaxed">{c.quote}</p>
                  <p className="text-ink-soft text-[13px] mt-1 leading-relaxed">{c.explanation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
