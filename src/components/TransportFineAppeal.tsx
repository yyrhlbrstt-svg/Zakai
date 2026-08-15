"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Input, Button, RadioChips } from "@/components/ui";
import { MissingFields } from "@/components/MissingFields";
import { OutcomeReport } from "@/components/OutcomeReport";
import { VerticalOutcomeStat } from "@/components/VerticalOutcomeStat";
import type { VerticalOutcomeStat as Stat } from "@/lib/strategy/insights";
import { resolveTransportContactEmail } from "@/lib/utilityContacts";
import { heEn } from "@/lib/heEn";
import { moneyCaseHref } from "@/lib/moneyCaseHref";

const REASONS = ["validator", "balance", "notime", "details", "student", "other"] as const;
type Reason = (typeof REASONS)[number];

export function TransportFineAppeal({ stat, bcp47 }: { stat?: Stat | null; bcp47?: string }) {
  const t = useTranslations("transportFine");
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_TransportFineAppeal = useTranslations("inline_components_TransportFineAppeal");
  const tFlow = useTranslations("agentFlow");
  const router = useRouter();
  const [name, setName] = useState("");
  const [report, setReport] = useState("");
  const [operator, setOperator] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [reason, setReason] = useState<Reason>("validator");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const knownInbox = resolveTransportContactEmail(operator);
  const agentReady =
    report.trim().length > 0 &&
    operator.trim().length > 0 &&
    (Boolean(knownInbox) || hasOutreachEmail(operatorEmail));

  function generate() {
    const reasonText = t(`reasons.${reason}.body`);
    const body = `לכבוד
מחלקת הערעורים / קנסות, ${operator || "מפעיל התחבורה הציבורית"}

הנדון: ערעור על דו"ח קנס מספר ${report || "____"}

שמי זכאי, סוכן דיגיטלי הפועל מטעם ${name || "____"} (Mandate). אינני הלקוח/ה עצמו/ה.
בשם הלקוח/ה אני מערער על דו"ח הקנס שבנדון בגין נסיעה ללא כרטיס/תיקוף תקף.

${reasonText}${details ? `\n\nפירוט נוסף: ${details}` : ""}

לאור האמור, אבקש לבטל את הדו"ח. אם הבקשה תידחה, אבקש לקבל הנמקה מפורטת ואת פירוט זכותי להישפט או לפנות לוועדת הערר.

בכבוד רב,
${name || "____"}
תאריך: ${new Date().toLocaleDateString("he-IL")}`;
    setLetter(body);
  }

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/transport-fine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          report,
          operator,
          reason,
          details: details || undefined,
          amountShekels: amount ? Number(amount) : undefined,
          operatorEmail: operatorEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/transport-fine`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        if (data.error === "needsOutreachEmail") {
          setError(tFlow("errorNeedsEmail"));
          return;
        }
        setError(
          data.error === "caseLimit" ? tFlow("errorCaseLimit") : tFlow("errorGeneric"),
        );
        return;
      }
      setLetter(data.body || "");
      setCaseId(data.caseId);
      router.push(moneyCaseHref(data.caseId, { delivered: data.delivered }));
    } catch {
      setError(tFlow("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {stat && bcp47 && <VerticalOutcomeStat stat={stat} bcp47={bcp47} />}
      <Card className="p-6 flex flex-col gap-4">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("report")}</span>
            <Input value={report} onChange={(e) => setReport(e.target.value)} maxLength={40} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{t("operator")}</span>
            <Input value={operator} onChange={(e) => setOperator(e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className="text-body text-ink-soft block mb-1.5">{tIcomponents_TransportFineAppeal("t_b573e9ed")}</span>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>

        <div>
          <span className="text-body text-ink-soft block mb-2">{t("reasonQ")}</span>
          <RadioChips
            value={reason}
            onChange={setReason}
            ariaLabel={t("reasonQ")}
            options={REASONS.map((r) => ({ value: r, label: t(`reasons.${r}.label`) }))}
          />
        </div>

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{t("details")}</span>
          <Input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={300} />
        </label>

        <label className="block">
          <span className="text-body text-ink-soft block mb-1.5">{tIcomponents_TransportFineAppeal("operatorEmail")}</span>
          <Input
            type="email"
            value={operatorEmail}
            onChange={(e) => setOperatorEmail(e.target.value)}
            maxLength={120}
            dir="ltr"
          />
        </label>

        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{tFlow("honestNote")}</p>

        <div className="flex flex-col gap-2">
          <MissingFields
            items={[
              { ok: report.trim().length > 0, label: t("report") },
              { ok: operator.trim().length > 0, label: t("operator") },
              {
                ok: Boolean(knownInbox) || hasOutreachEmail(operatorEmail),
                label: tIcomponents_TransportFineAppeal("operatorEmail"),
              },
            ]}
          />
          <Button onClick={sendWithAgent} disabled={!agentReady || busy}>
            {busy ? tFlow("opening") : tFlow("openCase")}
          </Button>
          <details className="text-body text-ink-soft">
            <summary className="cursor-pointer font-bold select-none">
              {heEn(he, "חלופה — מכתב להעתקה בלבד", "Alternative — copy-only letter")}
            </summary>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={generate}
              disabled={!report.trim() || !operator.trim() || busy}
            >
              {tIcomponents_TransportFineAppeal("t_b4c9b341")}
            </Button>
          </details>
        </div>
        {error && <p className="text-body text-amber m-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="mt-5 p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">
            {tIcomponents_TransportFineAppeal("t_360e126e")}
          </div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">
            {tIcomponents_TransportFineAppeal("t_013fe61d")}
          </p>
          <Link href={`/money?case=${caseId}`}>
            <Button className="w-full">{tIcomponents_TransportFineAppeal("t_8ae29d51")}</Button>
          </Link>
        </Card>
      )}

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={16}
            dir="rtl"
            className="w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-body leading-relaxed text-ink box-border"
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
          <OutcomeReport vertical="transport-fine" counterparty="transport_operator" variantId="firm_statutory" />
          <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
            {t("legal")}
          </p>
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
