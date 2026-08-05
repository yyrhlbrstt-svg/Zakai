"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Input, Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { matchIntent } from "@/lib/intentRouter";
import { heEn } from "@/lib/heEn";

/**
 * "Tell me what happened" — one free-text box instead of a wall of buttons.
 * See intentRouter.ts for why this is deterministic keyword matching, not an
 * AI call: instant, free, works with no AI key configured, and fully
 * testable — a wrong guess here silently sends someone to the wrong Case.
 */
export function IntentTriage() {
  const t = useTranslations("intentTriage");
  const locale = useLocale();
  const [text, setText] = useState("");
  const match = useMemo(
    () => (text.trim().length >= 4 ? matchIntent(text, locale === "en" ? "en" : "he") : null),
    [text, locale],
  );
  const he = locale === "he" || locale === "ar";
  const showNoMatch = text.trim().length >= 12 && !match;

  return (
    <SpotlightCard className="p-5 mb-6">
      <div className="text-[13px] font-extrabold text-emerald mb-2">{t("label")}</div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("label")}
      />
      {match && (
        <div className="mt-3.5 rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11.5px] text-ink-soft font-bold uppercase tracking-wide">
              {t("matchedLabel")}
            </div>
            <div className="font-extrabold text-[15px] mt-0.5">
              {he ? match.titleHe : match.titleEn}
            </div>
          </div>
          <Link href={match.href} className="no-underline shrink-0">
            <Button className="!py-2 !px-4 !text-[13.5px]">{t("go")}</Button>
          </Link>
        </div>
      )}
      {showNoMatch && (
        <p className="text-ink-soft text-[12.5px] mt-3 mb-0 leading-relaxed">
          {t("noMatch")}{" "}
          <Link href="/money#zakai-money-scan" className="text-emerald font-bold no-underline">
            {heEn(he, "לכסף שלי", "My money")}
          </Link>
        </p>
      )}
    </SpotlightCard>
  );
}
