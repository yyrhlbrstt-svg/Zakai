"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";

/**
 * The canonical public origin, on both server and client.
 *
 * This used to read `window.location.origin` in the browser and fall back to
 * the configured URL on the server, evaluated once at module load. The two
 * disagree by construction, so the server sent one endpoint and React
 * rendered another — a hydration mismatch (React #418) on the page aimed at
 * institutional integrators, the audience least willing to forgive a page
 * that logs errors.
 *
 * Deterministic is also simply more correct here: this is documentation
 * telling an institution which endpoint to POST to. It should name the
 * production endpoint, never whichever host the reader happens to be viewing
 * from. Every other institutional page already does it this way.
 */
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

type Step = "idle" | "running" | "ok" | "fail";

/**
 * Self-serve institutional path: test vectors + READY_FOR_PIONEER + conformance.
 * No sales call — complements ReferenceVerifierWizard.
 */
export function InstitutionConformancePanel() {
  const t = useTranslations("institutionConformance");
  const [vectors, setVectors] = useState<Step>("idle");
  const [ready, setReady] = useState<Step>("idle");
  const [readyLabel, setReadyLabel] = useState<string | null>(null);

  const runVectors = useCallback(async () => {
    setVectors("running");
    try {
      // Same machine gate as Pioneer listing — not "JSON shape exists".
      const res = await fetch("/api/mandate/ready", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        vectors?: { passed?: boolean; total?: number };
      };
      const ok = res.ok && data.vectors?.passed === true;
      setVectors(ok ? "ok" : "fail");
    } catch {
      setVectors("fail");
    }
  }, []);

  const runReady = useCallback(async () => {
    setReady("running");
    setReadyLabel(null);
    try {
      const res = await fetch("/api/mandate/ready", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        ready_for_pioneer?: boolean;
      };
      const ok = res.ok && data.ready_for_pioneer === true;
      setReady(ok ? "ok" : "fail");
      setReadyLabel(ok ? t("readyOk") : t("readyFail"));
    } catch {
      setReady("fail");
      setReadyLabel(t("readyFail"));
    }
  }, [t]);

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
          <span className="font-bold">{t("stepReadyLabel")}</span>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button type="button" variant="ghost" className="!text-[12px] !py-1.5" onClick={runReady}>
              {t("runReady")}
            </Button>
            <span aria-hidden>{mark(ready)}</span>
            {readyLabel ? <span className="text-[12px] font-extrabold text-emerald">{readyLabel}</span> : null}
            <a
              className="text-[12px] text-emerald underline"
              href={`${ORIGIN}/api/mandate/ready`}
              target="_blank"
              rel="noopener noreferrer"
            >
              /api/mandate/ready
            </a>
          </div>
        </li>
        <li>
          {t("step3")}{" "}
          {/* A full endpoint is longer than a phone is wide. Wrapping keeps it
              readable; letting it run off the edge hides the path an
              integrator came here to copy. */}
          {/* [overflow-wrap:anywhere] on top of break-all: before the webfont
              lands, the fallback mono can measure wider than the box for a
              frame — anywhere-wrap holds at any font metric. */}
          <code className="text-[11px] block break-all [overflow-wrap:anywhere]" dir="ltr">
            POST {ORIGIN}/api/mandate/conformance/probe
          </code>
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
