"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button, Textarea, Input } from "@/components/ui";
import { scanStatement } from "@/lib/subscriptions";
import { UNIVERSAL_CANCEL_DEMO_CSV } from "@/lib/subscriptionsDemoSample";
import { buildCancelLetter } from "@/lib/cancelLetter";
import { withFooter } from "@/lib/letterFooter";
import { formatAgorot } from "@/lib/money";
import { openMailto } from "@/lib/mailto";
import {
  pickOutreachEmail,
  resolveSubscriptionCompany,
} from "@/lib/normalizeSubscriptionProvider";
import { ShareResult } from "@/components/ShareResult";
import {
  buildUniversalCancelShareMessage,
  universalCancelShareKicker,
  universalCancelSharePath,
} from "@/lib/monopoly/universalCancelShare";

const MIN_CHARS = 12;

/**
 * Universal cancel — client-only parse, then real send actions:
 * mailto (user's mail client) or deep-link into agent cancel case.
 */
export function UniversalCancelTool({
  bcp47,
  referralCode,
}: {
  bcp47: string;
  referralCode?: string;
}) {
  const t = useTranslations("universalCancel");
  const locale = useLocale();
  const footerLocale = locale === "he" || locale === "ar" ? "he" : "en";
  const [text, setText] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  /** Per-merchant override for provider cancel inbox. */
  const [contactByMerchant, setContactByMerchant] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  const canAnalyze = trimmed.length >= MIN_CHARS;
  const result = analyzed && canAnalyze ? scanStatement(trimmed) : null;
  const nameForLetter = customerName.trim() || t("placeholderName");

  const letters = useMemo(() => {
    if (!result?.recurring.length) return [];
    return result.recurring.map((r) => {
      const resolved = resolveSubscriptionCompany(r.merchant, r.merchant);
      const letter = buildCancelLetter({
        customerName: nameForLetter,
        company: resolved.displayName,
        product: resolved.displayName,
        intent: "cancel",
        monthlyShekels: Math.round(r.monthlyAgorot / 100),
      });
      const override = contactByMerchant[r.merchant]?.trim();
      const outreach =
        pickOutreachEmail({
          contactEmail: override || undefined,
          defaultContactEmail: resolved.defaultContactEmail,
        }) ?? "";
      return {
        key: r.merchant,
        monthly: r.monthlyAgorot,
        company: resolved.displayName,
        subject: letter.subject,
        body: withFooter(letter.body, footerLocale),
        outreach,
        defaultEmail: resolved.defaultContactEmail ?? "",
        monthlyShekels: Math.round(r.monthlyAgorot / 100),
      };
    });
  }, [result, nameForLetter, contactByMerchant, footerLocale]);

  async function onFile(file?: File | null) {
    if (!file) return;
    const body = await file.text();
    setText(body);
    setAnalyzed(false);
  }

  function runAnalyze() {
    if (!canAnalyze) return;
    setAnalyzed(true);
  }

  function loadDemo() {
    setText(UNIVERSAL_CANCEL_DEMO_CSV);
    setAnalyzed(true);
  }

  async function copyLetter(key: string, subject: string, body: string) {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  }

  function sendMailto(key: string, to: string, subject: string, body: string) {
    if (!openMailto(to, subject, body)) return;
    setOpenedKey(key);
    setTimeout(() => setOpenedKey(null), 2500);
  }

  function agentHref(company: string, monthlyShekels: number, outreach: string) {
    const q = new URLSearchParams({
      company,
      product: company,
      intent: "cancel",
      monthly: String(monthlyShekels),
    });
    if (customerName.trim()) q.set("name", customerName.trim());
    if (outreach) q.set("contactEmail", outreach);
    return `/cancel?${q.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <p className="text-[13.5px] text-ink-soft leading-relaxed m-0">{t("privacy")}</p>

      <Card className="p-5 flex flex-col gap-3">
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={t("namePlaceholder")}
          autoComplete="name"
        />
        <p className="text-[12px] text-ink-soft m-0 -mt-1">{t("nameHint")}</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="ghost" className="w-full" onClick={() => fileRef.current?.click()}>
          {t("uploadCsv")}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAnalyzed(false);
          }}
          rows={5}
          placeholder={t("pastePlaceholder")}
        />
        <Button className="w-full" disabled={!canAnalyze} onClick={runAnalyze}>
          {t("analyzeBtn")}
        </Button>
        <Button variant="ghost" className="w-full !text-[13px]" type="button" onClick={loadDemo}>
          {t("loadDemo")}
        </Button>
        {!canAnalyze && trimmed.length > 0 && (
          <p className="text-[12px] text-ink-soft m-0">{t("tooShort")}</p>
        )}
      </Card>

      {analyzed && canAnalyze && result && result.recurring.length > 0 && (
        <Card className="p-5">
          <div className="font-extrabold text-[15px]">
            {t("found", { count: result.recurring.length })}
          </div>
          <p className="text-[12px] text-ink-soft mt-1">
            {t("totalMonthly", { amount: formatAgorot(result.totalMonthlyAgorot, bcp47) })}
          </p>
          <p className="text-[13px] text-ink-soft mt-3 mb-0 leading-relaxed">{t("actionsExplain")}</p>
          <div className="mt-4">
            <ShareResult
              message={buildUniversalCancelShareMessage(locale, {
                letterCount: result.recurring.length,
                amountLabel: formatAgorot(result.totalMonthlyAgorot, bcp47),
              })}
              path={universalCancelSharePath()}
              referralCode={referralCode}
              kicker={universalCancelShareKicker(locale)}
            />
          </div>
        </Card>
      )}

      {analyzed && canAnalyze && result && result.recurring.length === 0 && (
        <Card className="p-5 border-[rgba(255,180,80,0.35)] bg-[rgba(255,180,80,0.06)]">
          <p className="text-[13.5px] leading-relaxed m-0 mb-3">{t("noRecurring")}</p>
          <Link href="/cancel">
            <Button variant="ghost" className="w-full">
              {t("agentLink")}
            </Button>
          </Link>
        </Card>
      )}

      {letters.map((l) => {
        const canMailto = Boolean(l.outreach);
        return (
          <Card key={l.key} className="p-5">
            <div className="font-extrabold">{l.key}</div>
            <div className="text-[12px] text-ink-soft">
              {formatAgorot(l.monthly, bcp47)} / {t("month")}
            </div>

            <label className="block mt-3 text-[12px] text-ink-soft font-bold">
              {t("providerEmailLabel")}
            </label>
            <Input
              type="email"
              className="mt-1"
              dir="ltr"
              value={contactByMerchant[l.key] ?? l.defaultEmail}
              onChange={(e) =>
                setContactByMerchant((prev) => ({ ...prev, [l.key]: e.target.value }))
              }
              placeholder={t("providerEmailPlaceholder")}
            />
            {!canMailto && (
              <p className="text-[12px] text-amber mt-1 mb-0 leading-relaxed">
                {t("providerEmailRequired")}
              </p>
            )}

            <pre className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed bg-[#060b12] rounded-xl p-3 border border-[rgba(255,255,255,0.08)] max-h-[320px] overflow-y-auto">
              <strong className="block mb-2 text-[12px] text-ink-soft">{l.subject}</strong>
              {l.body}
            </pre>

            <div className="mt-3 flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={!canMailto}
                onClick={() => sendMailto(l.key, l.outreach, l.subject, l.body)}
              >
                {openedKey === l.key ? t("mailOpened") : t("sendMailto")}
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => copyLetter(l.key, l.subject, l.body)}
              >
                {copiedKey === l.key ? t("copied") : t("copySendYours")}
              </Button>
              <Link href={agentHref(l.company, l.monthlyShekels, l.outreach)} className="no-underline">
                <Button variant="ghost" className="w-full !text-[13px]">
                  {t("agentSendCta")}
                </Button>
              </Link>
            </div>
          </Card>
        );
      })}

      {letters.length > 0 && (
        <p className="text-[12px] text-ink-soft text-center leading-relaxed">
          {t("agentOptional")}{" "}
          <Link href="/cancel" className="text-emerald font-bold">
            {t("agentLink")}
          </Link>
        </p>
      )}
    </div>
  );
}
