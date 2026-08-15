"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Button } from "@/components/ui";
import { renderDocument } from "@/lib/global/engine";
import type { JurisdictionPack, PackAction } from "@/lib/global/types";
import { OutcomeReport } from "@/components/OutcomeReport";

/**
 * The letter-generation surface for a `JurisdictionPack` right — the global-
 * engine counterpart to `ClaimDocument.tsx`, which only ever knew the
 * Israeli, closure-based catalog.
 *
 * Reuses the `claim` translation namespace (fields, buttons, disclaimer):
 * the field *keys* a pack asks for (name, municipality, period, state...)
 * are the same closed set `claimDraft.ts` already uses, just sourced from a
 * pack's own `PackAction.fields` instead of `rightsActions.ts`.
 */
export function GlobalPackClaimDocument({
  pack,
  rightId,
  action,
}: {
  pack: JurisdictionPack;
  rightId: string;
  action: PackAction;
}) {
  const t = useTranslations("claim");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (action.kind === "tool" && action.tool) {
    return (
      <a
        href={action.tool}
        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-base bg-emerald rounded-full px-3.5 py-1.5 no-underline hover:opacity-90 transition-opacity"
      >
        {t("openTool")}
      </a>
    );
  }

  // "agent" actions (a human-in-the-loop case pipeline, not yet wired for
  // any global pack) and any right with no letter template render nothing —
  // the same honesty rule ClaimDocument already applies: say nothing rather
  // than promise a document that does not exist.
  if (!action.subject || !action.body) return null;

  const set = (key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDraft(null);
  };

  const text = (key: string, maxLength = 60) => (
    <label key={key} className="block">
      <span className="text-[12px] text-ink-soft block mb-1">
        {t.has(`fields.${key}`) ? t(`fields.${key}`) : key}
      </span>
      <Input value={fields[key] ?? ""} onChange={(e) => set(key, e.target.value)} maxLength={maxLength} />
    </label>
  );

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the text is on screen and selectable.
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-[12.5px] text-ink-soft m-0 mb-3 leading-relaxed">{t("intro")}</p>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {text("name", 80)}
        {text("id", 20)}
        {(action.fields ?? []).map((f) => text(f, f === "details" ? 300 : 60))}
      </div>

      <Button
        className="mt-3.5"
        onClick={() => setDraft(renderDocument(pack, rightId, fields))}
      >
        {t("generate")}
      </Button>

      {draft && (
        <div className="mt-4">
          <div className="text-[12px] text-ink-soft mb-1.5">{t("subject")}</div>
          <div className="text-body font-extrabold mb-3">{draft.subject}</div>
          <pre tabIndex={0} className="whitespace-pre-wrap font-sans text-body leading-relaxed bg-[rgba(0,0,0,0.25)] rounded-xl p-4 m-0 max-h-80 overflow-auto">
            {draft.body}
          </pre>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button onClick={copy}>{copied ? t("copied") : t("copy")}</Button>
            <Button variant="ghost" onClick={() => window.print()}>
              {t("print")}
            </Button>
          </div>
          <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed">{t("disclaimer")}</p>
          <OutcomeReport
            market={pack.market}
            vertical="rights"
            counterparty={action.recipient ?? "unknown"}
            variantId={rightId}
          />
        </div>
      )}
    </div>
  );
}
