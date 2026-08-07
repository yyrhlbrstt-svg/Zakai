"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button, Textarea } from "@/components/ui";
import { scanStatement } from "@/lib/subscriptions";
import {
  detectCostDrift,
  increasesOnly,
  netMonthlyDriftAgorot,
  snapshotFromCharges,
  type CostSnapshot,
  type DriftItem,
} from "@/lib/costDrift";
import {
  actionableFindings,
  addressableMonthlyAgorot,
  auditBusinessExpenses,
  type BusinessFinding,
} from "@/lib/businessExpenseAudit";
import { formatAgorot } from "@/lib/money";
import { STATEMENT_SCAN_MIN_CHARS } from "@/lib/subscriptionsDemoSample";

/**
 * A business pastes its statement and learns which recurring costs are worth
 * challenging, and who to challenge them with.
 *
 * The consumer scan already found the charges; what it could not say is which
 * of them move if you ask. For a household that gap barely matters — the
 * categories it knows are the categories it has. For a business, its largest
 * costs (clearing, bank charges, accounting software, a leased vehicle) all
 * landed in "other", so the answer was always a tidy list and no next step.
 *
 * Every number shown is a cost the business is already paying. None of it is
 * presented as a saving, because whether any of it moves is the counterparty's
 * answer to give, not ours to predict.
 */
const BASELINE_KEY = "zakai_business_baseline_v1";

export function BusinessExpenseAudit({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("businessAudit");
  const [text, setText] = useState("");
  const [findings, setFindings] = useState<BusinessFinding[] | null>(null);
  const [baseline, setBaseline] = useState<CostSnapshot | null>(null);
  const [drift, setDrift] = useState<DriftItem[] | null>(null);

  const canScan = text.trim().length >= STATEMENT_SCAN_MIN_CHARS;
  const money = (a: number) => formatAgorot(a, bcp47);

  // Kept on the device, like the consumer scan's own summary. A statement is
  // the most sensitive thing a business owns, and comparing two of them needs
  // no server — so it does not get one.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BASELINE_KEY);
      if (raw) setBaseline(JSON.parse(raw) as CostSnapshot);
    } catch {
      /* private mode, or a shape from an older version — start fresh */
    }
  }, []);

  function run() {
    const charges = scanStatement(text).recurring;
    setFindings(auditBusinessExpenses(charges));

    const snapshot = snapshotFromCharges(charges);
    // Compare before overwriting, or the first thing this feature does is
    // destroy the only evidence it needs.
    setDrift(baseline ? detectCostDrift(baseline, snapshot) : null);
    setBaseline(snapshot);
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage unavailable — the audit still works, the watch just won't */
    }
  }

  const actionable = findings ? actionableFindings(findings) : [];
  const addressable = findings ? addressableMonthlyAgorot(findings) : 0;

  return (
    <div className="mt-8">
      <h2 className="font-display text-h3 mb-2">{t("title")}</h2>
      <p className="text-ink-soft text-body-lg mb-5">{t("sub")}</p>

      <Card className="p-6">
        <label className="block">
          <span className="text-body text-ink-soft">{t("pasteLabel")}</span>
          <Textarea
            rows={6}
            dir="ltr"
            className="mt-1.5 font-mono text-caption"
            placeholder={t("pastePlaceholder")}
            aria-label={t("pasteLabel")}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (findings) setFindings(null);
            }}
          />
        </label>
        {!canScan && <p className="text-caption text-ink-soft mt-2 mb-0">{t("tooShort")}</p>}
        <Button className="mt-4 w-full sm:w-auto" onClick={run} disabled={!canScan}>
          {t("scanBtn")}
        </Button>
      </Card>

      {findings && (
        <div className="mt-5">
          {/* Above the totals: a cost that rose since last time is more
              urgent than a cost that has always been there, because nobody
              agreed to the rise. */}
          {drift && increasesOnly(drift).length > 0 && (
            <Card className="p-5 mb-4 border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.07)]">
              <div className="font-extrabold text-title">{t("driftTitle")}</div>
              <p className="text-caption text-ink-soft mt-1.5 mb-3">
                {t("driftSub", { net: money(Math.abs(netMonthlyDriftAgorot(drift))) })}
              </p>
              <div className="flex flex-col gap-2">
                {increasesOnly(drift).map((d, i) => (
                  <div
                    key={`${d.merchant}-${i}`}
                    className="flex items-baseline justify-between gap-3 flex-wrap"
                  >
                    <span className="font-bold text-body">{d.merchant}</span>
                    <span className="text-body text-amber font-bold" dir="ltr">
                      {d.kind === "new"
                        ? `+${money(d.afterAgorot)}`
                        : `${money(d.beforeAgorot)} → ${money(d.afterAgorot)}`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {findings.length === 0 ? (
            <Card className="p-6">
              <p className="text-body-lg m-0">{t("none")}</p>
            </Card>
          ) : (
            <>
              <Card className="p-6 text-center">
                <div className="text-caption text-ink-soft font-bold">{t("addressableLabel")}</div>
                <div className="font-display grad-text text-h1 mt-1.5">{money(addressable)}</div>
                {/* Said plainly, because the number above is a cost and it
                    would be easy to read it as a promise. */}
                <p className="text-caption text-ink-soft mt-3 mb-0">{t("notASaving")}</p>
              </Card>

              {/* Said once, on the first scan, so the second one is expected
                  rather than a surprise. A watch only works if someone knows
                  to come back. */}
              {drift === null && (
                <p className="text-caption text-ink-soft mt-3">{t("baselineSaved")}</p>
              )}

              <div className="mt-4 flex flex-col gap-2.5">
                {findings.map((f, i) => (
                  <Card key={`${f.charge.merchant}-${i}`} className="p-4">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <span className="font-bold text-body-lg">{f.charge.merchant}</span>
                      <span className="font-display text-title">{money(f.charge.monthlyAgorot)}</span>
                    </div>
                    <div className="text-caption text-ink-soft mt-1">{t(`kinds.${f.kind}`)}</div>
                    {f.href ? (
                      <Link href={f.href} className="no-underline">
                        <Button variant="ghost" className="!text-body mt-2.5">
                          {t("challengeCta")}
                        </Button>
                      </Link>
                    ) : (
                      // No tool exists for this cost yet. Saying so is more
                      // use than a button that goes somewhere unhelpful.
                      <p className="text-caption text-ink-soft mt-2 mb-0">{t("noToolYet")}</p>
                    )}
                  </Card>
                ))}
              </div>

              {actionable.length === 0 && (
                <p className="text-caption text-ink-soft mt-4">{t("nothingRoutable")}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
