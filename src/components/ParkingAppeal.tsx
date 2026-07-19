"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input, Button } from "@/components/ui";

const REASONS = ["signage", "machine", "loading", "disabled", "details", "other"] as const;
type Reason = (typeof REASONS)[number];

/**
 * Parking-ticket appeal letter generator. Pure client-side (nothing stored) —
 * builds a ready-to-send objection the citizen sends in their own name, same
 * self-help pattern as the flight demand letter. Not legal advice.
 */
export function ParkingAppeal() {
  const t = useTranslations("parking");
  const [name, setName] = useState("");
  const [ticket, setTicket] = useState("");
  const [city, setCity] = useState("");
  const [reason, setReason] = useState<Reason>("signage");
  const [details, setDetails] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  function generate() {
    const reasonText = t(`reasons.${reason}.body`);
    const body = `לכבוד
מחלקת הפיקוח / הגבייה, עיריית ${city || "____"}

הנדון: ערעור על דוח חניה מספר ${ticket || "____"}

שמי ${name || "____"}, ואני מבקש/ת לערער על דוח החניה שבנדון.

${reasonText}${details ? `\n\nפירוט נוסף: ${details}` : ""}

לאור האמור, אבקש לבטל את הדוח. ככל שהבקשה תידחה, אבקש לקבל הנמקה מפורטת ואת זכותי להישפט בבית המשפט לעניינים מקומיים.

בכבוד רב,
${name || "____"}
תאריך: ${new Date().toLocaleDateString("he-IL")}`;
    setLetter(body);
  }

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("ticket")}</span>
            <Input value={ticket} onChange={(e) => setTicket(e.target.value)} maxLength={40} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("city")}</span>
            <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} />
          </label>
        </div>

        <div>
          <span className="text-[13px] text-ink-soft block mb-2">{t("reasonQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("reasonQ")}>
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r}
                onClick={() => setReason(r)} className={chip(reason === r)}>
                {t(`reasons.${r}.label`)}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-[13px] text-ink-soft block mb-1.5">{t("details")}</span>
          <Input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={300} />
        </label>

        <div>
          <Button onClick={generate}>{t("generate")}</Button>
        </div>
      </Card>

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={16}
            dir="rtl"
            className="w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-[13px] leading-relaxed text-ink outline-none box-border"
          />
          <div className="flex gap-3 mt-3 flex-wrap items-center">
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(letter);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* selectable */
                }
              }}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
            <span className="text-[12px] text-ink-soft">{t("sendHint")}</span>
          </div>
          <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
            {t("legal")}
          </p>
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
