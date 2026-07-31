"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Textarea } from "@/components/ui";
import { assessMessage } from "@/lib/scamCheck";

/**
 * Paste a suspicious SMS/WhatsApp message, get an instant pattern check.
 * Fully client-side — nothing is sent anywhere, no login, no server call —
 * which matters doubly here since the exact audience most worth protecting
 * is the one least likely to trust "upload this to a website".
 *
 * Deliberately never says a message is safe, only that it does or doesn't
 * match a known scam pattern — see scamCheck.ts for why.
 */
export function ScamMessageChecker() {
  const t = useTranslations("scamCheck");
  const [text, setText] = useState("");

  const assessment = useMemo(() => {
    if (text.trim().length < 8) return null;
    return assessMessage(text);
  }, [text]);

  return (
    <div>
      <Card className="p-6">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          rows={6}
        />
        <p className="text-[11.5px] text-ink-soft mt-2 mb-0">{t("privacyNote")}</p>
      </Card>

      {assessment && (
        <Card
          className={`mt-5 p-6 ${
            assessment.risk === "high"
              ? "border border-[rgba(240,138,107,0.45)] bg-[rgba(240,138,107,0.08)]"
              : "border border-[rgba(255,255,255,0.08)]"
          }`}
        >
          {assessment.risk === "high" ? (
            <>
              <div className="text-[15px] font-extrabold text-[#F08A6B]">{t("riskTitle")}</div>
              <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("riskSub")}</p>
              <div className="flex flex-col gap-2">
                {assessment.matches.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-[rgba(240,138,107,0.3)] bg-[rgba(240,138,107,0.05)] px-4 py-3 text-[13.5px]"
                  >
                    {t(`patterns.${m.id}`)}
                  </div>
                ))}
              </div>
              <p className="text-[12.5px] text-ink-soft mt-4 leading-relaxed">{t("riskAdvice")}</p>
            </>
          ) : (
            <>
              <div className="text-[15px] font-extrabold">{t("unclearTitle")}</div>
              <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-0">{t("unclearSub")}</p>
            </>
          )}
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
