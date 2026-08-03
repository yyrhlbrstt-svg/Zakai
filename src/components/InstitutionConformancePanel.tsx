"use client";

import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";

const ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

type Step = "idle" | "running" | "ok" | "fail";

/**
 * Self-serve institutional path: test vectors + conformance spec + registered issuer steps.
 * No sales call — complements ReferenceVerifierWizard.
 */
export function InstitutionConformancePanel() {
  const t = useTranslations("institutionConformance");
  const locale = useLocale();
  const [vectors, setVectors] = useState<Step>("idle");

  const runVectors = useCallback(async () => {
    setVectors("running");
    try {
      const res = await fetch("/api/mandate/test-vectors", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const ok =
        res.ok &&
        data &&
        typeof data === "object" &&
        Array.isArray((data as { vectors?: unknown }).vectors);
      setVectors(ok ? "ok" : "fail");
    } catch {
      setVectors("fail");
    }
  }, []);

  const mark = (s: Step) => (s === "ok" ? "✓" : s === "fail" ? "✗" : s === "running" ? "…" : "—");

  return (
    <Card className="p-6 mb-8 border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.06)]">
      <h2 className="font-display text-xl m-0 mb-2">{t("title")}</h2>
      <p className="text-[13.5px] text-ink-soft leading-relaxed m-0 mb-4">{t("sub")}</p>
      <ol className="list-decimal ps-5 flex flex-col gap-2 text-[13.5px] leading-relaxed mb-4">
        <li>
          <a
            className="text-emerald font-bold no-underline"
            href={`${ORIGIN}/.well-known/zakai-conformance.json`}
            target="_blank"
            rel="noopener noreferrer"
          >
            zakai-conformance.json
          </a>
          {" — "}
          {t("step1")}
        </li>
        <li>
          <span className="font-bold">{t("step2Label")}</span>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button type="button" variant="ghost" className="!text-[12px] !py-1.5" onClick={runVectors}>
              {t("runVectors")}
            </Button>
            <span aria-hidden>{mark(vectors)}</span>
            <a
              className="text-[12px] text-emerald underline"
              href={`${ORIGIN}/api/mandate/test-vectors`}
              target="_blank"
              rel="noopener noreferrer"
            >
              JSON
            </a>
          </div>
        </li>
        <li>
          {t("step3")}{" "}
          <code className="text-[11px]">POST {ORIGIN}/api/mandate/conformance/probe</code>
        </li>
        <li>
          <Link href="/institutions#registered-issuer" className="text-emerald font-bold no-underline">
            {t("step4")}
          </Link>
        </li>
      </ol>
      <p className="text-[12px] text-ink-soft m-0">{t("footnote")}</p>
    </Card>
  );
}
