"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { formatAgorot } from "@/lib/money";

/**
 * The instant estimate — value before signature.
 *
 * The old order asked for a signed Mandate and then showed what it was worth.
 * This inverts it: connect a read-only feed, see the number, and only then
 * decide whether to hand over any authority at all. The signature is the
 * expensive act; the number is the reason to perform it.
 *
 * THE LABEL IS NOT DECORATION
 *
 * While the mock provider is in play these figures are fixtures. Rendering
 * them as if they were somebody's real account would be inventing an amount,
 * which is the first thing this product may not do — so `isLive` comes back
 * on the response and the demo banner is rendered from it, not from a build
 * flag a screen could get wrong.
 */

interface Claim {
  merchant: string;
  monthlyAgorot: number;
  category: string;
  occurrences: number;
}

interface Rise {
  merchant: string;
  fromAgorot: number;
  toAgorot: number;
  deltaAgorot: number;
  claimable: boolean;
}

interface Estimate {
  monthlyAgorot: number;
  transactionsRead: number;
  claimable: Claim[];
  heldBackCount: number;
  priceIncreases: Rise[];
}

export function LinkAccountEstimate({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("openBanking");
  const [busy, setBusy] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");

  async function link() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/open-banking/estimate", { method: "POST" });
      if (!res.ok) {
        setError(t("empty"));
        return;
      }
      const data = await res.json();
      setIsLive(Boolean(data.isLive));
      setEstimate(data.estimate as Estimate);
    } catch {
      setError(t("empty"));
    } finally {
      setBusy(false);
    }
  }

  const money = (agorot: number) => formatAgorot(agorot, bcp47);

  return (
    <Card className="p-6" id="zakai-link-account">
      <div className="font-display text-xl mb-1">{t("title")}</div>
      <p className="text-ink-soft text-body mt-0 mb-4 leading-relaxed">{t("sub")}</p>

      {!estimate && (
        <Button onClick={link} disabled={busy} className="w-full">
          {busy ? t("busy") : t("cta")}
        </Button>
      )}

      {error && <p className="text-body text-amber mt-3 mb-0">{error}</p>}

      {estimate && (
        <div className="mt-2">
          {!isLive && (
            <div
              className="rounded-xl border border-[rgba(240,180,92,0.4)] bg-[rgba(240,180,92,0.08)] px-4 py-3 mb-4"
              data-testid="demo-data-banner"
            >
              <div className="text-amber font-extrabold text-caption uppercase tracking-wide">
                {t("demoBadge")}
              </div>
              <p className="text-ink-soft text-caption mt-1 mb-0 leading-relaxed">{t("demoNote")}</p>
            </div>
          )}

          <div className="text-body text-ink-soft font-bold">{t("monthlyLabel")}</div>
          <div className="font-display grad-text text-4xl mt-1" data-testid="estimate-total">
            {money(estimate.monthlyAgorot)}
          </div>
          <div className="text-caption text-ink-soft mt-1">{t("perMonth")}</div>
          <p className="text-micro text-ink-soft mt-2 mb-0">
            {t("readCount", { count: estimate.transactionsRead })}
          </p>

          {estimate.claimable.length > 0 && (
            <ul className="mt-4 mb-0 ps-5 flex flex-col gap-1.5 text-body">
              {estimate.claimable.map((c) => (
                <li key={c.merchant}>
                  <span className="font-bold">{c.merchant}</span> — {money(c.monthlyAgorot)}{" "}
                  {t("perMonth")}
                </li>
              ))}
            </ul>
          )}

          {estimate.heldBackCount > 0 && (
            <p className="text-caption text-ink-soft mt-3 mb-0 leading-relaxed">
              {t("heldBack", { count: estimate.heldBackCount })}
            </p>
          )}

          {estimate.priceIncreases.length > 0 && (
            <div className="mt-5 rounded-xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.07)] p-4">
              <div className="font-extrabold text-body">{t("riseTitle")}</div>
              <ul className="mt-2 mb-0 ps-5 flex flex-col gap-1.5 text-body">
                {estimate.priceIncreases.map((r) => (
                  <li key={r.merchant}>
                    {t("riseLine", {
                      merchant: r.merchant,
                      from: money(r.fromAgorot),
                      to: money(r.toAgorot),
                      delta: money(r.deltaAgorot),
                    })}
                    {!r.claimable && (
                      <span className="block text-caption text-ink-soft mt-0.5">
                        {t("riseFactOnly")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link href="/money#zakai-money-scan" className="no-underline">
            <Button className="w-full mt-5">{t("nextCta")}</Button>
          </Link>
        </div>
      )}

      {/* The legal basis, stated where the consent is asked rather than buried
          in a policy page. Needs a lawyer's eye before this goes live — the
          structure is right, the wording is not yet reviewed. */}
      <p className="text-micro text-ink-soft mt-5 mb-0 leading-relaxed">{t("legalBasis")}</p>
    </Card>
  );
}
