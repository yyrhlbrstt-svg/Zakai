"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import type { WorkEventKind, WorkReach } from "@/lib/services/visibleWork";

/**
 * The one screen that answers "what has this done in my name".
 *
 * Two decisions carry the whole page:
 *
 * 1. Nothing is dressed up. A letter that has not left says it has not left,
 *    in the same size type as one that has. The counts at the top are the raw
 *    counts — if every letter is still waiting because no mail transport is
 *    configured, this page says so plainly instead of showing a green tick.
 *
 * 2. Revoked authority does not erase history. Rows taken under a withdrawn
 *    permission stay, marked. Withdrawing permission stops the next action; it
 *    does not un-take the last one, and pretending otherwise would make this
 *    page useless as a record exactly when someone needs it most.
 */

export interface LedgerRow {
  id: string;
  at: string; // ISO — the server owns the clock, the client owns the format
  kind: WorkEventKind;
  reach: WorkReach;
  counterparty: string | null;
  caseId: string | null;
  authorityCode: string | null;
  authorityRevoked: boolean;
  amountMinor: number | null;
  failure: string | null;
}

export interface LedgerSummary {
  total: number;
  delivered: number;
  waiting: number;
  failed: number;
  activeAuthorities: number;
  underRevokedAuthority: number;
}

const TONE: Record<WorkEventKind, "out" | "warn" | "bad" | "flat"> = {
  case_opened: "flat",
  consent_given: "flat",
  ownership_verified: "flat",
  authority_granted: "flat",
  authority_revoked: "warn",
  letter_queued: "warn",
  letter_delivered: "out",
  letter_failed: "bad",
  saving_documented: "out",
  fee_raised: "flat",
  fee_paid: "flat",
  terms_accepted: "flat",
};

const DOT: Record<"out" | "warn" | "bad" | "flat", string> = {
  out: "bg-emerald",
  warn: "bg-[#e0b341]",
  bad: "bg-[#ff8f8f]",
  flat: "bg-[rgba(255,255,255,0.28)]",
};

export function VisibleWorkLedger({
  rows,
  summary,
  bcp47,
}: {
  rows: LedgerRow[];
  summary: LedgerSummary;
  bcp47: string;
}) {
  const t = useTranslations("visibleWork");
  const [revoked, setRevoked] = useState<Record<string, "busy" | "done" | "error">>({});
  const [filter, setFilter] = useState<"all" | "outward" | "waiting">("all");

  const shown = useMemo(() => {
    if (filter === "outward") return rows.filter((r) => r.reach === "outward");
    if (filter === "waiting") return rows.filter((r) => r.kind === "letter_queued");
    return rows;
  }, [rows, filter]);

  async function revoke(code: string) {
    setRevoked((s) => ({ ...s, [code]: "busy" }));
    try {
      const res = await fetch("/api/authority/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setRevoked((s) => ({ ...s, [code]: res.ok ? "done" : "error" }));
    } catch {
      setRevoked((s) => ({ ...s, [code]: "error" }));
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="p-7 text-center">
        <p className="text-ink-soft text-body-lg m-0 leading-relaxed">{t("empty")}</p>
      </Card>
    );
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(bcp47, { day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <Stat label={t("statTotal")} value={String(summary.total)} />
          <Stat label={t("statDelivered")} value={String(summary.delivered)} tone="out" />
          <Stat label={t("statWaiting")} value={String(summary.waiting)} tone={summary.waiting > 0 ? "warn" : "flat"} />
          {summary.failed > 0 && <Stat label={t("statFailed")} value={String(summary.failed)} tone="bad" />}
          <Stat label={t("statAuthorities")} value={String(summary.activeAuthorities)} />
        </div>
        {summary.waiting > 0 && summary.delivered === 0 && (
          <p className="text-caption text-[#e0b341] mt-4 mb-0 leading-relaxed">
            {t("nothingLeftYet")}
          </p>
        )}
        {summary.underRevokedAuthority > 0 && (
          <p className="text-caption text-ink-soft mt-3 mb-0 leading-relaxed">
            {t("underRevoked", { count: summary.underRevokedAuthority })}
          </p>
        )}
      </Card>

      <div className="flex gap-2 flex-wrap">
        {(["all", "outward", "waiting"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-3.5 py-1.5 text-caption font-extrabold border ${
              filter === f
                ? "border-emerald text-emerald"
                : "border-[rgba(255,255,255,0.14)] text-ink-soft"
            } bg-transparent cursor-pointer`}
          >
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>

      <ol className="list-none p-0 m-0 flex flex-col gap-2.5">
        {shown.map((r) => {
          const tone = TONE[r.kind];
          const local = r.authorityCode ? revoked[r.authorityCode] : undefined;
          const isRevoked = r.authorityRevoked || local === "done";
          return (
            <li key={r.id}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-body-lg font-extrabold leading-snug">
                      {r.counterparty
                        ? t(`kind.${r.kind}.with`, { counterparty: r.counterparty })
                        : t(`kind.${r.kind}.plain`)}
                    </div>

                    {r.amountMinor !== null && (
                      <div className="text-body text-ink-soft mt-1">
                        {formatAgorot(r.amountMinor, bcp47)}
                      </div>
                    )}

                    {r.failure !== null && r.failure !== "" && (
                      <div className="text-caption text-[#ff8f8f] mt-1 break-all" dir="ltr">
                        {r.failure}
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-micro text-ink-soft">
                      <span dir="ltr">
                        {fmtDate(r.at)} · {fmtTime(r.at)}
                      </span>
                      {r.authorityCode && (
                        <span
                          dir="ltr"
                          className="rounded-full border border-[rgba(255,255,255,0.12)] px-2 py-0.5"
                        >
                          {r.authorityCode}
                          {isRevoked ? ` · ${t("revokedTag")}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.kind === "authority_granted" && r.authorityCode && !isRevoked && (
                    <Button
                      variant="ghost"
                      disabled={local === "busy"}
                      onClick={() => revoke(r.authorityCode!)}
                      className="!text-caption !px-3 !py-1.5 shrink-0"
                    >
                      {local === "busy" ? t("revoking") : t("revoke")}
                    </Button>
                  )}
                </div>

                {local === "error" && (
                  <p role="alert" className="text-caption text-[#ff8f8f] mt-2.5 mb-0">
                    {t("revokeFailed")}
                  </p>
                )}
                {local === "done" && (
                  <p className="text-caption text-emerald mt-2.5 mb-0 leading-relaxed">
                    {t("revokedNote")}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      {shown.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-ink-soft text-body m-0">{t("filterEmpty")}</p>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "flat",
}: {
  label: string;
  value: string;
  tone?: "out" | "warn" | "bad" | "flat";
}) {
  const color =
    tone === "out" ? "text-emerald" : tone === "warn" ? "text-[#e0b341]" : tone === "bad" ? "text-[#ff8f8f]" : "";
  return (
    <div>
      <div className={`font-display text-h3 leading-none ${color}`} dir="ltr">
        {value}
      </div>
      <div className="text-micro text-ink-soft mt-1.5">{label}</div>
    </div>
  );
}
