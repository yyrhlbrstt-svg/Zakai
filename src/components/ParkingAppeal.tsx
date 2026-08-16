"use client";

import { useTranslations } from "next-intl";
import { ReasonBasedAppealForm, type ReasonBasedAppealConfig } from "@/components/ReasonBasedAppealForm";
import type { VerticalOutcomeStat as Stat } from "@/lib/strategy/insights";

const REASONS = ["signage", "machine", "loading", "disabled", "details", "other"] as const;

export function ParkingAppeal({ stat, bcp47 }: { stat?: Stat | null; bcp47?: string }) {
  const t = useTranslations("parking");
  const tInline = useTranslations("inline_components_ParkingAppeal");
  const tFlow = useTranslations("agentFlow");

  const config: ReasonBasedAppealConfig = {
    t,
    tFlow,
    referenceFieldLabel: t("ticket"),
    counterpartyFieldLabel: t("city"),
    amountFieldLabel: tInline("t_e3b93d14"),
    counterpartyEmailFieldLabel: tInline("authorityEmail"),
    copyOnlyButtonLabel: tInline("t_b4c9b341"),
    caseOpenedTitle: tInline("t_360e126e"),
    caseOpenedSub: tInline("t_d489aedc"),
    dashboardButtonLabel: tInline("t_8ae29d51"),
    reasons: REASONS.map((r) => ({
      value: r,
      label: t(`reasons.${r}.label`),
      body: t(`reasons.${r}.body`),
    })),
    defaultReason: "signage",
    apiEndpoint: "/api/cases/parking",
    loginReturnPath: "/parking",
    buildRequestBody: (f) => ({
      customerName: f.customerName,
      ticket: f.referenceNumber,
      city: f.counterpartyName,
      reason: f.reason,
      details: f.details,
      amountShekels: f.amountShekels,
      authorityEmail: f.counterpartyEmail,
    }),
    composeLetter: (f) => `לכבוד
מחלקת הפיקוח / הגבייה, עיריית ${f.counterpartyName || "____"}

הנדון: ערעור על דוח חניה מספר ${f.referenceNumber || "____"}

שמי זכאי, סוכן דיגיטלי הפועל מטעם ${f.customerName || "____"} (Mandate). אינני הלקוח/ה עצמו/ה.
בשם הלקוח/ה אני מערער על דוח החניה שבנדון.

${f.reasonText}${f.details ? `\n\nפירוט נוסף: ${f.details}` : ""}

לאור האמור, אבקש לבטל את הדוח. ככל שהבקשה תידחה, אבקש לקבל הנמקה מפורטת ואת זכותי להישפט בבית המשפט לעניינים מקומיים.

בכבוד רב,
${f.customerName || "____"}
תאריך: ${new Date().toLocaleDateString("he-IL")}`,
    outcomeVertical: "parking",
    outcomeCounterparty: "municipality",
  };

  return <ReasonBasedAppealForm config={config} stat={stat} bcp47={bcp47} />;
}
