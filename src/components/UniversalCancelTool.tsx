"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button, Textarea } from "@/components/ui";
import { scanStatement } from "@/lib/subscriptions";
import { buildCancelLetter } from "@/lib/cancelLetter";
import { withFooter } from "@/lib/letterFooter";
import { formatAgorot } from "@/lib/money";

/**
 * Universal cancel — client-only. Parses statement export, drafts one letter per
 * recurring charge. User copies and sends from their own email (Word doctrine).
 */
export function UniversalCancelTool({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("universalCancel");
  const locale = useLocale();
  const footerLocale = locale === "he" || locale === "ar" ? "he" : "en";
  const [text, setText] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = text.trim().length > 20 ? scanStatement(text) : null;

  const letters =
    result?.recurring.map((r) => {
      const letter = buildCancelLetter({
        customerName: t("placeholderName"),
        company: r.merchant,
        product: r.merchant,
        intent: "cancel",
        monthlyShekels: Math.round(r.monthlyAgorot / 100),
      });
      return {
        key: r.merchant,
        monthly: r.monthlyAgorot,
        subject: letter.subject,
        body: withFooter(letter.body, footerLocale),
      };
    }) ?? [];

  async function onFile(file?: File | null) {
    if (!file) return;
    setText(await file.text());
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] text-ink-soft leading-relaxed m-0">{t("privacy")}</p>

      <Card className="p-5 flex flex-col gap-3">
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
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t("pastePlaceholder")}
        />
      </Card>

      {result && (
        <Card className="p-5">
          <div className="font-extrabold text-[15px]">
            {t("found", { count: result.recurring.length })}
          </div>
          <p className="text-[12px] text-ink-soft mt-1">
            {t("totalMonthly", { amount: formatAgorot(result.totalMonthlyAgorot, bcp47) })}
          </p>
        </Card>
      )}

      {letters.map((l) => (
        <Card key={l.key} className="p-5">
          <div className="font-extrabold">{l.key}</div>
          <div className="text-[12px] text-ink-soft">
            {formatAgorot(l.monthly, bcp47)} / {t("month")}
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed bg-[#060b12] rounded-xl p-3 border border-[rgba(255,255,255,0.08)] max-h-[200px] overflow-y-auto">
            {l.body.slice(0, 600)}
            {l.body.length > 600 ? "…" : ""}
          </pre>
          <Button
            className="mt-3 w-full"
            variant="ghost"
            onClick={() => copyLetter(l.key, l.subject, l.body)}
          >
            {copiedKey === l.key ? t("copied") : t("copySendYours")}
          </Button>
        </Card>
      ))}

      {letters.length > 0 && (
        <p className="text-[12px] text-ink-soft text-center">
          {t("agentOptional")}{" "}
          <Link href="/cancel" className="text-emerald font-bold">
            {t("agentLink")}
          </Link>
        </p>
      )}
    </div>
  );
}
