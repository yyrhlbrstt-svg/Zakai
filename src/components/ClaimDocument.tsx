"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { Input, Button, FieldError } from "@/components/ui";
import { buildClaimDraft, resolveAction, type ClaimFields } from "@/lib/claimDraft";
import { RIGHT_ACTIONS } from "@/lib/rightsActions";
import { OutcomeReport } from "@/components/OutcomeReport";
import { isPlausibleAmount, isPlausibleTaxYear, isValidIsraeliId } from "@/lib/claimFieldValidation";

/**
 * The fulfilment surface for a single entitlement — expanded in place, inside
 * the rights list.
 *
 * Deliberately not a route. Sending someone to /claim/<id> to fill in three
 * fields costs a page load, a back button, and the context of the list they
 * were reading; every one of those is a place people leave. The finished
 * letter appears under the right they just tapped, and they never move.
 *
 * Only the fields this particular right actually needs are asked for. A
 * universal form that collects everything for every claim is how a two-field
 * request turns into an eleven-field wall.
 */
export function ClaimDocument({ rightId }: { rightId: string }) {
  const t = useTranslations("claim");
  const action = resolveAction(rightId);
  const [fields, setFields] = useState<ClaimFields>({});
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // A right with no action defined — foreign catalogs today. Say nothing
  // rather than promise something that does not exist.
  if (!action) return null;

  if (action.kind === "tool" && action.tool) {
    return (
      <Link
        href={action.tool}
        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-base bg-emerald rounded-full px-3.5 py-1.5 no-underline hover:opacity-90 transition-opacity"
      >
        {t("openTool")}
        <ArrowLeft size={14} aria-hidden />
      </Link>
    );
  }

  if (!action.drafts) return null;

  const set = (key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDraft(null);
  };

  // Both go straight into an official letter unedited — a value that's
  // present but malformed must block "generate", not just look wrong. Empty
  // is left alone here (no separate required-field pass); this only stops
  // obvious garbage like a 10-digit ID or "6289" as a tax year.
  const idValue = (fields.id ?? "").trim();
  const idInvalid = idValue.length > 0 && !isValidIsraeliId(idValue);
  const periodValue = (fields.period ?? "").trim();
  const periodInvalid =
    action.fields.includes("period") && periodValue.length > 0 && !isPlausibleTaxYear(periodValue);
  const amountValue = (fields.amount ?? "").trim();
  const amountInvalid =
    action.fields.includes("amount") && amountValue.length > 0 && !isPlausibleAmount(amountValue);

  const text = (key: string, maxLength = 60, dir?: "ltr") => (
    <label key={key} className="block">
      <span className="text-[12px] text-ink-soft block mb-1">{t(`fields.${key}`)}</span>
      <Input
        value={fields[key as keyof ClaimFields] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        maxLength={maxLength}
        dir={dir}
      />
      {key === "id" && idInvalid && <FieldError>{t("invalidId")}</FieldError>}
      {key === "period" && periodInvalid && <FieldError>{t("invalidPeriod")}</FieldError>}
      {key === "amount" && amountInvalid && <FieldError>{t("invalidAmount")}</FieldError>}
    </label>
  );

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (older browsers, insecure contexts). The text is on
      // screen and selectable, so this is a missing convenience, not a failure
      // worth interrupting anyone with.
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-[12.5px] text-ink-soft m-0 mb-3 leading-relaxed">{t("intro")}</p>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {text("name", 80)}
        {text("id", 20, "ltr")}
        {action.fields.map((f) => text(f, f === "details" ? 300 : 60))}
      </div>

      <Button
        className="mt-3.5"
        disabled={idInvalid || periodInvalid || amountInvalid}
        onClick={() => setDraft(buildClaimDraft(rightId, fields))}
      >
        {t("generate")}
      </Button>

      {draft && (
        <div className="mt-4">
          <div className="text-[12px] text-ink-soft mb-1.5">{t("subject")}</div>
          <div className="text-[13px] font-extrabold mb-3">{draft.subject}</div>
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed bg-[rgba(0,0,0,0.25)] rounded-xl p-4 m-0 max-h-80 overflow-auto">
            {draft.body}
          </pre>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button onClick={copy}>{copied ? t("copied") : t("copy")}</Button>
            <Button variant="ghost" onClick={() => window.print()}>
              {t("print")}
            </Button>
          </div>
          <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed">{t("disclaimer")}</p>
            {/* The moat is built here, not in the letter.
                Four surfaces generate letters and only one of them fed the
                outcome graph, so three quarters of the events that could teach
                us something produced nothing. A letter is a commodity — anybody
                can draft one. Knowing which wording this counterparty actually
                pays is the asset, and it only exists if the report sits where
                the reply arrives. */}
          <OutcomeReport
            vertical="rights"
            counterparty={RIGHT_ACTIONS[rightId]?.recipient ?? "unknown"}
            variantId={rightId}
          />
        </div>
      )}
    </div>
  );
}
