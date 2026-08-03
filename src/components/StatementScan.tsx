"use client";

import { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Textarea } from "@/components/ui";
import { scanStatement, type ScanResult, type ChargeCategory, type RecurringCharge } from "@/lib/subscriptions";
import { formatAgorot } from "@/lib/money";
import { UNIVERSAL_CANCEL_DEMO_CSV, STATEMENT_SCAN_MIN_CHARS } from "@/lib/subscriptionsDemoSample";

import { ShareResult } from "@/components/ShareResult";
import {
  buildScanShareMessage,
  scanShareKicker,
  scanShareLandingPath,
} from "@/lib/monopoly/scanShare";

const CATEGORY_COLOR: Record<ChargeCategory, string> = {
  cellular: "#3FCB9B",
  tv_internet: "#3EC6FF",
  electricity: "#F0B45C",
  insurance: "#8B5CF6",
  fitness: "#F08A6B",
  digital: "#93A6A5",
  other: "#93A6A5",
};

/**
 * Recurring-charges scan for logged-in users.
 * Privacy-first: parse in browser. After scan → one-click agent Case (same path as MoneyHub).
 */
export function StatementScan({
  fullScan,
  bcp47,
  screenshotEnabled = false,
  referralCode,
}: {
  fullScan: boolean;
  bcp47: string;
  screenshotEnabled?: boolean;
  referralCode?: string;
}) {
  const t = useTranslations("scan");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_StatementScan = useTranslations("inline_components_StatementScan");
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotError, setShotError] = useState(false);
  const [busyMerchant, setBusyMerchant] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);

  function runScan(input: string) {
    setResult(scanStatement(input));
    setErr(null);
  }

  const canScan = text.trim().length >= STATEMENT_SCAN_MIN_CHARS;

  function loadDemo() {
    setText(UNIVERSAL_CANCEL_DEMO_CSV);
    runScan(UNIVERSAL_CANCEL_DEMO_CSV);
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    const content = await file.text();
    setText(content);
    runScan(content);
  }

  async function onScreenshot(file?: File | null) {
    if (!file) return;
    setShotError(false);
    setShotBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const res = await fetch("/api/scan/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: btoa(bin), mediaType: file.type || "image/jpeg" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.csv) {
        setShotError(true);
        return;
      }
      const merged = text.trim() ? `${text}\n${data.csv}` : data.csv;
      setText(merged);
      runScan(merged);
    } catch {
      setShotError(true);
    } finally {
      setShotBusy(false);
    }
  }

  async function openCase(r: RecurringCharge) {
    setErr(null);
    setBusyMerchant(r.merchant);
    try {
      const monthlyShekels = Math.max(1, Math.round(r.monthlyAgorot / 100));
      const res = await fetch("/api/cases/from-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: r.merchant,
          product: r.merchant,
          monthlyShekels,
          category: r.category,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/scan`);
        return;
      }
      if (!res.ok) {
        setErr(
          data.error === "caseLimit"
            ? he
              ? "הגעת למגבלת התיקים. שדרג או סגור תיק."
              : "Case limit reached."
            : he
              ? "משהו השתבש."
              : "Something went wrong.",
        );
        return;
      }
      router.push("/dashboard");
    } catch {
      setErr(he ? "משהו השתבש." : "Something went wrong.");
    } finally {
      setBusyMerchant(null);
    }
  }

  const visible = result ? (fullScan ? result.recurring : result.recurring.slice(0, 3)) : [];
  const hidden = result ? result.recurring.length - visible.length : 0;
  const best =
    result && result.recurring.length > 0
      ? [...result.recurring].sort((a, b) => b.monthlyAgorot - a.monthlyAgorot)[0]
      : null;

  return (
    <div className="pb-28">
      <Card className="p-6">
        <div className="flex items-start gap-2.5 text-[13px] text-emerald font-bold bg-[rgba(63,203,155,0.08)] border border-[rgba(63,203,155,0.25)] rounded-xl px-4 py-3 mb-5">
          <span aria-hidden>🔒</span>
          <span>{t("privacyNote")}</span>
        </div>

        <label className="block">
          <span className="text-[13.5px] text-ink-soft">{t("pasteLabel")}</span>
          <Textarea
            rows={7}
            dir="ltr"
            className="mt-1.5 font-mono text-[12.5px]"
            placeholder={t("pastePlaceholder")}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (result) setResult(null);
            }}
          />
        </label>

        <div className="flex gap-3 mt-4 flex-wrap">
          <Button className="flex-1 min-w-[140px]" onClick={() => runScan(text)} disabled={!canScan}>
            {t("scanBtn")}
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            {t("uploadBtn")}
          </Button>
          <Button variant="ghost" className="!text-[13px]" type="button" onClick={loadDemo}>
            {t("loadDemo")}
          </Button>
          {screenshotEnabled && (
            <Button variant="ghost" disabled={shotBusy} onClick={() => shotRef.current?.click()}>
              {shotBusy ? t("shotBusy") : t("screenshotBtn")}
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <input
            ref={shotRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onScreenshot(e.target.files?.[0])}
          />
        </div>
        {shotError && (
          <p className="text-danger text-[13px] font-semibold mt-3 mb-0">{t("shotError")}</p>
        )}
        {!canScan && text.trim().length > 0 && (
          <p className="text-[12px] text-ink-soft mt-2 mb-0">{t("tooShort")}</p>
        )}

        <details className="mt-5 text-[13px] text-ink-soft">
          <summary className="cursor-pointer font-bold text-emerald">{t("exportGuideTitle")}</summary>
          <ul className="mt-2.5 ps-4 list-disc space-y-2 leading-relaxed">
            {(t.raw("exportGuide") as string[]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </Card>

      {!result && canScan && (
        <div className="fixed inset-x-3 bottom-3 z-[9990] mx-auto max-w-[520px] md:hidden">
          <Button className="w-full shadow-lg" onClick={() => runScan(text)}>
            {t("scanBtn")}
          </Button>
        </div>
      )}

      {result && (
        <div className="mt-6">
          {result.recurring.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="font-display text-xl">{t("noneFound")}</div>
              <div className="text-ink-soft text-[13.5px] mt-2">
                {t("parsed", { count: result.transactions })}
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-6 text-center">
                <div className="text-[13px] text-ink-soft font-bold">{t("totalLabel")}</div>
                <div className="font-display grad-text text-4xl mt-1.5">
                  {formatAgorot(result.totalMonthlyAgorot, bcp47)}
                </div>
                <div className="text-[12px] text-ink-soft mt-1.5">
                  {t("totalSub", { count: result.recurring.length })}
                </div>
                <div className="mt-4 text-start">
                  <ShareResult
                    message={buildScanShareMessage(locale, {
                      amountLabel: formatAgorot(result.totalMonthlyAgorot, bcp47),
                      recurringCount: result.recurring.length,
                    })}
                    path={scanShareLandingPath()}
                    amountLabel={formatAgorot(result.totalMonthlyAgorot, bcp47)}
                    kicker={scanShareKicker(locale)}
                    referralCode={referralCode}
                  />
                </div>
              </Card>

              {best && (
                <Card className="mt-4 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
                  <div className="text-[12px] font-extrabold text-emerald uppercase tracking-wide">
                    {tIcomponents_StatementScan("t_49d491c5")}
                  </div>
                  <div className="font-extrabold text-[17px] mt-1.5">{best.merchant}</div>
                  <div className="text-ink-soft text-[13px] mt-0.5">
                    {formatAgorot(best.monthlyAgorot, bcp47)} {t("perMonth")}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    disabled={busyMerchant === best.merchant}
                    onClick={() => openCase(best)}
                  >
                    {busyMerchant === best.merchant
                      ? he
                        ? "פותח תיק…"
                        : "Opening…"
                      : he
                        ? "הסוכן פותח תיק עכשיו"
                        : "Agent opens case now"}
                  </Button>
                </Card>
              )}

              {err && <p className="text-[13px] text-amber font-semibold mt-3">{err}</p>}

              <Card className="mt-4 py-1.5">
                {visible.map((r, i) => (
                  <div
                    key={`${r.merchant}-${i}`}
                    className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
                    style={{
                      borderBottom:
                        i < visible.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
                    }}
                  >
                    <div className="flex-1 basis-[150px]">
                      <div className="font-extrabold text-[15px]">{r.merchant}</div>
                      <div className="text-[11.5px] text-ink-soft mt-0.5">
                        {t("occurrences", { count: r.occurrences })}
                      </div>
                    </div>
                    <div
                      className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
                      style={{
                        color: CATEGORY_COLOR[r.category],
                        background: `${CATEGORY_COLOR[r.category]}18`,
                        border: `1px solid ${CATEGORY_COLOR[r.category]}44`,
                      }}
                    >
                      {t(`categories.${r.category}`)}
                    </div>
                    <div className="font-display text-lg">
                      {formatAgorot(r.monthlyAgorot, bcp47)}
                      <span className="text-ink-soft text-[12px] font-sans"> {t("perMonth")}</span>
                    </div>
                    <Button
                      variant="ghost"
                      className="!px-4 !py-2 !text-[13px]"
                      disabled={busyMerchant === r.merchant}
                      onClick={() => openCase(r)}
                    >
                      {busyMerchant === r.merchant
                        ? he
                          ? "פותח…"
                          : "…"
                        : he
                          ? "הסוכן פותח תיק"
                          : "Open case"}
                    </Button>
                  </div>
                ))}
              </Card>

              {hidden > 0 && (
                <Card className="mt-4 p-6 text-center border-[rgba(63,203,155,0.35)]">
                  <div className="font-extrabold text-[15px]">
                    {t("upgradeTitle", { count: hidden })}
                  </div>
                  <div className="text-ink-soft text-[13px] mt-1.5">{t("upgradeSub")}</div>
                  <Link href="/pricing" className="no-underline">
                    <Button className="mt-4 !px-6 !py-3 !text-[15px]">{t("upgradeCta")}</Button>
                  </Link>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
