"use client";

import { useTranslations } from "next-intl";
import { ReasonBasedAppealForm, type ReasonBasedAppealConfig } from "@/components/ReasonBasedAppealForm";
import type { VerticalOutcomeStat as Stat } from "@/lib/strategy/insights";
import { resolveTransportContactEmail } from "@/lib/utilityContacts";

const REASONS = ["validator", "balance", "notime", "details", "student", "other"] as const;

export function TransportFineAppeal({ stat, bcp47 }: { stat?: Stat | null; bcp47?: string }) {
  const t = useTranslations("transportFine");
  const tInline = useTranslations("inline_components_TransportFineAppeal");
  const tFlow = useTranslations("agentFlow");

  const config: ReasonBasedAppealConfig = {
    t,
    tFlow,
    referenceFieldLabel: t("report"),
    counterpartyFieldLabel: t("operator"),
    amountFieldLabel: tInline("t_b573e9ed"),
    counterpartyEmailFieldLabel: tInline("operatorEmail"),
    copyOnlyButtonLabel: tInline("t_b4c9b341"),
    caseOpenedTitle: tInline("t_360e126e"),
    caseOpenedSub: tInline("t_013fe61d"),
    dashboardButtonLabel: tInline("t_8ae29d51"),
    reasons: REASONS.map((r) => ({
      value: r,
      label: t(`reasons.${r}.label`),
      body: t(`reasons.${r}.body`),
    })),
    defaultReason: "validator",
    apiEndpoint: "/api/cases/transport-fine",
    loginReturnPath: "/transport-fine",
    resolveKnownInbox: (counterpartyName) => resolveTransportContactEmail(counterpartyName) ?? undefined,
    buildRequestBody: (f) => ({
      customerName: f.customerName,
      report: f.referenceNumber,
      operator: f.counterpartyName,
      reason: f.reason,
      details: f.details,
      amountShekels: f.amountShekels,
      operatorEmail: f.counterpartyEmail,
    }),
    composeLetter: (f) => `לכבוד
מחלקת הערעורים / קנסות, ${f.counterpartyName || "מפעיל התחבורה הציבורית"}

הנדון: ערעור על דו"ח קנס מספר ${f.referenceNumber || "____"}

שמי זכאי, סוכן דיגיטלי הפועל מטעם ${f.customerName || "____"} (Mandate). אינני הלקוח/ה עצמו/ה.
בשם הלקוח/ה אני מערער על דו"ח הקנס שבנדון בגין נסיעה ללא כרטיס/תיקוף תקף.

${f.reasonText}${f.details ? `\n\nפירוט נוסף: ${f.details}` : ""}

לאור האמור, אבקש לבטל את הדו"ח. אם הבקשה תידחה, אבקש לקבל הנמקה מפורטת ואת פירוט זכותי להישפט או לפנות לוועדת הערר.

בכבוד רב,
${f.customerName || "____"}
תאריך: ${new Date().toLocaleDateString("he-IL")}`,
    outcomeVertical: "transport-fine",
    outcomeCounterparty: "transport_operator",
  };

  return <ReasonBasedAppealForm config={config} stat={stat} bcp47={bcp47} />;
}
